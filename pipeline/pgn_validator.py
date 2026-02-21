#!/usr/bin/env python3
"""
Phase 3 — PGN Corpus Validation

Validates the Knowledge Base move tree against TWIC/master PGN archives.
Flags named variations present in master games but absent from the tree.

Usage:
  python pgn_validator.py --pgn data/twic/*.pgn --min-games 10
"""

import argparse
import sys
from collections import defaultdict
from pathlib import Path

import chess
import chess.pgn

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_connection, get_node_by_fen
from models import MissingVariation


def is_named_variation(opening_header: str) -> bool:
    """Check if opening header indicates a named variation."""
    return bool(opening_header and opening_header.strip() and opening_header != "?")


def validate_against_pgn(
    conn, pgn_paths: list[Path], min_games: int
) -> list[MissingVariation]:
    """Find positions from master games not in the tree."""
    fen_counts: dict[str, dict] = defaultdict(lambda: {"count": 0, "names": set(), "sources": set()})

    for pgn_path in pgn_paths:
        if not pgn_path.exists():
            print(f"Warning: {pgn_path} not found", file=sys.stderr)
            continue
        try:
            with open(pgn_path, encoding="utf-8", errors="replace") as f:
                while True:
                    game = chess.pgn.read_game(f)
                    if game is None:
                        break
                    try:
                        board = game.board()
                        opening_header = game.headers.get("Opening", "")
                        for node in game.mainline():
                            board.push(node.move)
                            fen = board.fen()
                            if not get_node_by_fen(conn, fen) and is_named_variation(opening_header):
                                fen_counts[fen]["count"] += 1
                                fen_counts[fen]["names"].add(opening_header)
                                fen_counts[fen]["sources"].add(str(pgn_path))
                    except (chess.InvalidMoveError, chess.AmbiguousMoveError):
                        continue
        except Exception as e:
            print(f"Error reading {pgn_path}: {e}", file=sys.stderr)

    missing = []
    for fen, data in fen_counts.items():
        if data["count"] >= min_games:
            missing.append(
                MissingVariation(
                    fen=fen,
                    opening_name="; ".join(sorted(data["names"])[:3]),
                    pgn_source="; ".join(sorted(data["sources"])[:3]),
                    game_count=data["count"],
                )
            )
    return sorted(missing, key=lambda m: -m.game_count)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pgn", nargs="+", required=True, help="PGN file paths")
    parser.add_argument("--min-games", type=int, default=10)
    args = parser.parse_args()

    pgn_paths = [Path(p) for p in args.pgn]
    with get_connection() as conn:
        missing = validate_against_pgn(conn, pgn_paths, args.min_games)

    print(f"Found {len(missing)} missing variations (game_count >= {args.min_games}):")
    for m in missing[:50]:
        print(f"  {m.game_count:6d} games | {m.opening_name[:60]}...")
    if len(missing) > 50:
        print(f"  ... and {len(missing) - 50} more")


if __name__ == "__main__":
    main()
