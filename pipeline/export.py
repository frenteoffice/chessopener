#!/usr/bin/env python3
"""
Export CLI — Output Knowledge Base in various formats

Formats: json (OpeningIQ-compatible), pgn, polyglot, csv

Usage:
  python export.py --format json --output ./openings/ --eco C50-C99
  python export.py --format csv --output nodes.csv
"""

import argparse
import csv
import json
import sys
from pathlib import Path

import chess
import chess.polyglot

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_connection, get_node_by_fen, get_children, get_seed_nodes


def node_to_openingiq(node, children_data: list) -> dict:
    """Convert Knowledge Base node to OpeningIQ schema."""
    engine_responses = [c["san"] for c in children_data]
    total = sum(c.get("game_count", 0) for c in children_data) or 1
    response_weights = [c.get("game_count", 0) / total for c in children_data]
    if response_weights and abs(sum(response_weights) - 1.0) > 0.001:
        s = sum(response_weights)
        response_weights = [w / s for w in response_weights]

    out = {
        "san": node.pgn_move,
        "fen": node.fen,
        "engineResponses": engine_responses,
        "responseWeights": response_weights,
    }
    if node.stockfish_eval is not None:
        out["stockfish_eval"] = node.stockfish_eval
    if node.best_move:
        out["best_move"] = node.best_move
    if node.is_dubious:
        out["is_dubious"] = True
    if node.is_busted:
        out["is_busted"] = True
    if node.game_count:
        out["game_count"] = node.game_count
    if node.white_win_pct is not None:
        out["white_win_pct"] = node.white_win_pct
    if node.resulting_structure:
        out["resulting_structure"] = node.resulting_structure
    return out


def build_tree(conn, node_id, max_depth: int, current_depth: int, min_games: int) -> dict | None:
    """Recursively build OpeningIQ tree from node."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT node_id, fen, pgn_move, move_number, side, eco_code, opening_name,
                variation_name, parent_node_id, is_branching_node, is_leaf, stockfish_eval,
                stockfish_depth, best_move, is_dubious, is_busted, resulting_structure,
                game_count, white_win_pct, draw_pct
            FROM opening_nodes WHERE node_id = %s
            """,
            (node_id,),
        )
        r = cur.fetchone()
    if not r:
        return None

    from models import OpeningNode
    node = OpeningNode(
        node_id=r[0], fen=r[1], pgn_move=r[2], move_number=r[3], side=r[4],
        eco_code=r[5] or "", opening_name=r[6] or "", variation_name=r[7],
        parent_node_id=r[8], is_branching_node=r[9], is_leaf=r[10],
        stockfish_eval=r[11], stockfish_depth=r[12], best_move=r[13],
        is_dubious=r[14], is_busted=r[15], resulting_structure=r[16],
        game_count=r[17] or 0, white_win_pct=r[18], draw_pct=r[19],
    )

    child_pairs = get_children(conn, node_id)
    children_data = []
    for child_id, _ in child_pairs:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pgn_move, game_count FROM opening_nodes WHERE node_id = %s",
                (child_id,),
            )
            row = cur.fetchone()
        if row:
            children_data.append({"san": row[0], "game_count": row[1] or 0, "child_id": child_id})

    # Filter by min_games
    children_data = [c for c in children_data if c.get("game_count", 0) >= min_games]
    children_data.sort(key=lambda x: -x.get("game_count", 0))

    out = node_to_openingiq(node, children_data)

    if current_depth < max_depth and children_data:
        out["children"] = []
        for c in children_data:
            child_node = build_tree(conn, c["child_id"], max_depth, current_depth + 1, min_games)
            if child_node:
                out["children"].append(child_node)

    return out


def export_json(conn, output_dir: Path, eco_filter: str | None, max_depth: int, min_games: int) -> int:
    """Export per-opening JSON files in OpeningIQ schema."""
    seeds = get_seed_nodes(conn)
    if eco_filter and "-" in eco_filter:
        lo, hi = eco_filter.split("-")
        seeds = [s for s in seeds if lo <= s.eco_code <= hi]
    elif eco_filter:
        seeds = [s for s in seeds if s.eco_code.startswith(eco_filter)]

    output_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for seed in seeds:
        tree = build_tree(conn, seed.node_id, max_depth, 0, min_games)
        if not tree:
            continue
        safe_name = seed.opening_name.replace("/", "-").replace(":", "-")[:80]
        fname = f"{seed.eco_code}_{safe_name}.json".replace(" ", "_")
        # OpeningIQ OpeningData format
        opening_data = {
            "id": f"{seed.eco_code}-{safe_name}".lower().replace(" ", "-")[:60],
            "name": seed.opening_name,
            "eco": seed.eco_code,
            "color": "white",
            "difficulty": "intermediate",
            "description": f"{seed.opening_name} ({seed.eco_code})",
            "rootFen": seed.fen,
            "rootResponses": tree.get("engineResponses", []),
            "rootWeights": tree.get("responseWeights", []),
            "moves": tree.get("children", []),
        }
        path = output_dir / fname
        with open(path, "w", encoding="utf-8") as f:
            json.dump(opening_data, f, indent=2)
        count += 1
    return count


def export_csv(conn, output_path: Path) -> int:
    """Export all nodes to CSV."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT node_id, fen, pgn_move, move_number, side, eco_code, opening_name,
                variation_name, parent_node_id, is_branching_node, is_leaf, stockfish_eval,
                stockfish_depth, best_move, is_dubious, is_busted, resulting_structure,
                game_count, white_win_pct, draw_pct
            FROM opening_nodes
            """
        )
        rows = cur.fetchall()
    fields = ["node_id", "fen", "pgn_move", "move_number", "side", "eco_code", "opening_name",
              "variation_name", "parent_node_id", "is_branching_node", "is_leaf", "stockfish_eval",
              "stockfish_depth", "best_move", "is_dubious", "is_busted", "resulting_structure",
              "game_count", "white_win_pct", "draw_pct"]
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(fields)
        w.writerows(rows)
    return len(rows)


def _add_pgn_node(
    conn,
    pgn_node: chess.pgn.GameNode,
    board: chess.Board,
    db_node_id,
    current_depth: int,
    max_depth: int,
    min_games: int,
) -> None:
    """Recursively add moves and variations to a chess.pgn game node."""
    if current_depth >= max_depth:
        return

    child_pairs = get_children(conn, db_node_id)
    child_rows = []
    for child_id, _ in child_pairs:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT node_id, pgn_move, game_count, stockfish_eval
                   FROM opening_nodes WHERE node_id = %s""",
                (child_id,),
            )
            row = cur.fetchone()
        if row and (row[2] or 0) >= min_games:
            child_rows.append(row)
    child_rows.sort(key=lambda r: -(r[2] or 0))

    for i, row in enumerate(child_rows):
        child_id, san, game_count, sf_eval = row[0], row[1], row[2], row[3]
        try:
            move = board.parse_san(san)
        except (chess.InvalidMoveError, chess.AmbiguousMoveError):
            continue

        if i == 0:
            next_node = pgn_node.add_main_variation(move)
        else:
            next_node = pgn_node.add_variation(move)

        if sf_eval is not None:
            next_node.comment = f"[%eval {sf_eval / 100:.2f}]"

        board.push(move)
        _add_pgn_node(conn, next_node, board, child_id, current_depth + 1, max_depth, min_games)
        board.pop()


def export_pgn(
    conn,
    output_dir: Path,
    eco_filter: str | None,
    max_depth: int = 15,
    min_games: int = 50,
) -> int:
    """Export PGN files with full variation trees and [%eval] annotations."""
    import chess.pgn

    seeds = get_seed_nodes(conn)
    if eco_filter and eco_filter != "ALL":
        if "-" in eco_filter:
            lo, hi = eco_filter.split("-")
            seeds = [s for s in seeds if lo <= s.eco_code <= hi]
        else:
            seeds = [s for s in seeds if s.eco_code.startswith(eco_filter)]

    output_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for seed in seeds:
        game = chess.pgn.Game.from_board(chess.Board(seed.fen))
        game.headers["Event"] = seed.opening_name
        game.headers["ECO"] = seed.eco_code
        game.headers["Site"] = "Chess Opening Knowledge Base"
        game.headers["Result"] = "*"

        if seed.stockfish_eval is not None:
            game.comment = f"[%eval {seed.stockfish_eval / 100:.2f}]"

        board = chess.Board(seed.fen)
        _add_pgn_node(conn, game, board, seed.node_id, 0, max_depth, min_games)

        safe_eco = seed.eco_code.replace(" ", "_")
        safe_name = seed.opening_name.replace("/", "-").replace(":", "-")[:60].replace(" ", "_")
        path = output_dir / f"{safe_eco}_{safe_name}.pgn"
        with open(path, "w", encoding="utf-8") as f:
            print(game, file=f, end="\n\n")
        count += 1

    return count


def _collect_polyglot_entries(
    conn,
    node_id,
    current_depth: int,
    max_depth: int,
    min_games: int,
    entries: list,
) -> None:
    """Recursively collect (fen, san, weight) tuples for Polyglot export."""
    if current_depth >= max_depth:
        return

    child_pairs = get_children(conn, node_id)
    child_rows = []
    for child_id, _ in child_pairs:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT node_id, fen, pgn_move, game_count FROM opening_nodes WHERE node_id = %s",
                (child_id,),
            )
            row = cur.fetchone()
        if row and (row[3] or 0) >= min_games:
            child_rows.append(row)

    if not child_rows:
        return

    with conn.cursor() as cur:
        cur.execute("SELECT fen FROM opening_nodes WHERE node_id = %s", (node_id,))
        parent_row = cur.fetchone()
    if not parent_row:
        return
    parent_fen = parent_row[0]

    total_games = sum(r[3] or 0 for r in child_rows)
    if total_games == 0:
        total_games = 1

    for row in child_rows:
        child_id, child_fen, san, game_count = row[0], row[1], row[2], row[3]
        weight = int(((game_count or 0) / total_games) * 65535)
        weight = max(1, min(65535, weight))
        entries.append((parent_fen, san, weight))
        _collect_polyglot_entries(conn, child_id, current_depth + 1, max_depth, min_games, entries)


def export_polyglot(
    conn,
    output_dir: Path,
    eco_filter: str | None,
    max_depth: int = 15,
    min_games: int = 50,
) -> int:
    """Export Polyglot .bin opening books. One file per seed opening."""
    import struct

    output_dir.mkdir(parents=True, exist_ok=True)
    seeds = get_seed_nodes(conn)
    if eco_filter and eco_filter != "ALL":
        if "-" in eco_filter:
            lo, hi = eco_filter.split("-")
            seeds = [s for s in seeds if lo <= s.eco_code <= hi]
        else:
            seeds = [s for s in seeds if s.eco_code.startswith(eco_filter)]

    count = 0
    for seed in seeds:
        entries = []
        _collect_polyglot_entries(conn, seed.node_id, 0, max_depth, min_games, entries)
        if not entries:
            continue

        safe_eco = seed.eco_code.replace(" ", "_")
        safe_name = seed.opening_name.replace("/", "-").replace(":", "-")[:40].replace(" ", "_")
        path = output_dir / f"{safe_eco}_{safe_name}.bin"

        poly_entries = []
        for fen, san, weight in entries:
            try:
                board = chess.Board(fen)
                move = board.parse_san(san)
                key = chess.polyglot.zobrist_hash(board)
                poly_entries.append((key, move, weight))
            except (chess.InvalidMoveError, chess.AmbiguousMoveError, ValueError):
                continue

        poly_entries.sort(key=lambda e: e[0])

        with open(path, "wb") as f:
            for key, move, weight in poly_entries:
                move_int = (
                    move.to_square
                    | (move.from_square << 6)
                    | ((move.promotion - 1 if move.promotion else 0) << 12)
                )
                entry_bytes = struct.pack(">QHHI", key, move_int, weight, 0)
                f.write(entry_bytes)

        count += 1

    return count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=["json", "csv", "pgn", "polyglot"], default="json")
    parser.add_argument("--output", "-o", required=True)
    parser.add_argument("--eco", default=None, help="ECO range e.g. C50-C99 or ALL")
    parser.add_argument("--max-depth", type=int, default=15)
    parser.add_argument("--min-games", type=int, default=50)
    args = parser.parse_args()

    out = Path(args.output)
    with get_connection() as conn:
        if args.format == "json":
            n = export_json(conn, out, args.eco, args.max_depth, args.min_games)
            print(f"Exported {n} JSON files to {out}")
        elif args.format == "csv":
            n = export_csv(conn, out)
            print(f"Exported {n} rows to {out}")
        elif args.format == "pgn":
            n = export_pgn(conn, out, args.eco, args.max_depth, args.min_games)
            print(f"Exported {n} PGN files to {out}")
        elif args.format == "polyglot":
            n = export_polyglot(conn, out, args.eco, args.max_depth, args.min_games)
            print(f"Exported {n} Polyglot files to {out}")


if __name__ == "__main__":
    main()
