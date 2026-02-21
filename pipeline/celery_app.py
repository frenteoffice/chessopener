"""Celery application for parallel Stockfish annotation."""

import os
from celery import Celery

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery("annotator", broker=REDIS_URL, backend=REDIS_URL)
app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


@app.task(bind=True, max_retries=3)
def annotate_node_task(self, node_id_str: str, stockfish_path: str, depth: int):
    """Celery task: annotate a single node with Stockfish."""
    import uuid
    from db import get_connection, get_node_by_id, update_node, log_node_change
    from stockfish_annotator import is_dubious, is_busted, score_to_cp
    import chess
    import chess.engine

    node_id = uuid.UUID(node_id_str)
    try:
        with get_connection() as conn:
            node = get_node_by_id(conn, node_id)
            if node is None or node.stockfish_eval is not None:
                return

            board = chess.Board(node.fen)
            with chess.engine.SimpleEngine.popen_uci(stockfish_path) as engine:
                info = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=1)

            if not info:
                return
            score = info[0].get("score")
            if score is None:
                return

            eval_cp = score_to_cp(score)
            pv = info[0].get("pv", [])
            best_san = board.san(pv[0]) if pv else None

            update_node(
                conn, node_id,
                stockfish_eval=eval_cp,
                stockfish_depth=depth,
                best_move=best_san,
                is_dubious=is_dubious(eval_cp, node.side),
                is_busted=is_busted(eval_cp, node.side),
            )
            log_node_change(conn, node_id, "stockfish_eval", None, eval_cp)
            log_node_change(conn, node_id, "stockfish_depth", None, depth)
            conn.commit()
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)
