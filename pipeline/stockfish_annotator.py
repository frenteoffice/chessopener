#!/usr/bin/env python3
"""
Phase 4 — Stockfish Annotation

Annotates branching nodes with Stockfish evaluations at depth 22+.
Populates stockfish_eval, stockfish_depth, best_move, is_dubious, is_busted.

Usage:
  python stockfish_annotator.py
  STOCKFISH_PATH=/usr/bin/stockfish python stockfish_annotator.py
"""

import argparse
import os
import sys
from pathlib import Path

import chess
import chess.engine

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_connection, get_nodes, get_leaf_nodes, update_node, log_node_change


def is_dubious(eval_cp: float, side: str) -> bool:
    """Eval is from White's perspective. Side is who just moved."""
    if side == "W":
        return eval_cp <= -50
    return eval_cp >= 50


def is_busted(eval_cp: float, side: str) -> bool:
    if side == "W":
        return eval_cp <= -150
    return eval_cp >= 150


def score_to_cp(score: chess.engine.PovScore) -> float:
    """Convert Stockfish PovScore to centipawns from White's perspective. Cap mate at ±1000."""
    white_score = score.white()
    if white_score.is_mate():
        m = white_score.mate()
        return 1000 if m > 0 else -1000
    return white_score.score(mate_score=10000)


def annotate_nodes(conn, stockfish_path: str = "stockfish", max_nodes: int | None = None) -> int:
    """Annotate branching and terminal nodes. Returns count annotated."""
    branching = get_nodes(conn, is_branching=True, order_by="game_count DESC", limit=max_nodes)
    leaves = get_leaf_nodes(conn, limit=max_nodes)
    nodes_to_annotate = branching + leaves

    depth_branching = 22
    depth_high_freq = 26
    depth_leaf = 18
    annotated = 0

    try:
        with chess.engine.SimpleEngine.popen_uci(stockfish_path) as engine:
            for node in nodes_to_annotate:
                if node.stockfish_eval is not None:
                    continue
                depth = depth_high_freq if node.game_count >= 1000 else depth_branching
                if not node.is_branching_node:
                    depth = depth_leaf

                board = chess.Board(node.fen)
                try:
                    info = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=1)
                except chess.engine.EngineError:
                    continue
                if not info:
                    continue

                score = info[0].get("score")
                if score is None:
                    continue
                eval_cp = score_to_cp(score)
                pv = info[0].get("pv", [])
                best_uci = pv[0].uci() if pv else None
                best_san = board.san(pv[0]) if pv and len(pv) > 0 else None

                update_node(
                    conn,
                    node.node_id,
                    stockfish_eval=eval_cp,
                    stockfish_depth=depth,
                    best_move=best_san or best_uci,
                    is_dubious=is_dubious(eval_cp, node.side),
                    is_busted=is_busted(eval_cp, node.side),
                )
                log_node_change(conn, node.node_id, "stockfish_eval", None, eval_cp)
                log_node_change(conn, node.node_id, "stockfish_depth", None, depth)
                annotated += 1
                if annotated % 100 == 0:
                    conn.commit()
                    print(f"Annotated {annotated} nodes...", file=sys.stderr)
    except FileNotFoundError:
        print("Stockfish not found. Install it or set STOCKFISH_PATH.", file=sys.stderr)
        sys.exit(1)

    return annotated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-nodes", type=int, default=None)
    parser.add_argument(
        "--parallel",
        action="store_true",
        help="Enqueue Celery tasks instead of running locally (requires Redis)",
    )
    args = parser.parse_args()
    path = os.environ.get("STOCKFISH_PATH", "stockfish")

    if args.parallel:
        from celery_app import annotate_node_task

        with get_connection() as conn:
            branching = get_nodes(conn, is_branching=True, order_by="game_count DESC", limit=args.max_nodes)
            leaves = get_leaf_nodes(conn, limit=args.max_nodes)
        enqueued = 0
        for node in branching + leaves:
            if node.stockfish_eval is not None:
                continue
            depth = 26 if node.game_count >= 1000 else (22 if node.is_branching_node else 18)
            annotate_node_task.delay(str(node.node_id), path, depth)
            enqueued += 1
        print(f"Enqueued {enqueued} annotation tasks.")
    else:
        with get_connection() as conn:
            n = annotate_nodes(conn, path, args.max_nodes)
        print(f"Annotated {n} nodes.")


if __name__ == "__main__":
    main()
