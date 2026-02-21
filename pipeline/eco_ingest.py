#!/usr/bin/env python3
"""
Phase 1 — ECO Skeleton Ingestion

Ingests ECO A00–E99 taxonomy from lichess-org/chess-openings TSV files.
Creates OpeningEntry and seed OpeningNode for each ECO row.

Usage:
  python eco_ingest.py --source data/eco
  python eco_ingest.py --source https://raw.githubusercontent.com/lichess-org/chess-openings/master
"""

import argparse
import csv
import re
import sys
from pathlib import Path

import chess

# Add parent for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_connection, upsert_entry, upsert_node
from models import OpeningEntry, OpeningNode


def parse_pgn_moves(pgn: str) -> list[str]:
    """
    Parse PGN move string (e.g. "1. e4 e5 2. Nf3 Nc6") into list of SAN moves.
    """
    moves = []
    for token in pgn.split():
        token = token.strip()
        if not token:
            continue
        if token.startswith("{") or token.startswith("("):
            continue
        if re.match(r"^\d+\.$", token):
            continue
        if re.match(r"^\d+\.", token):
            token = re.sub(r"^\d+\.", "", token)
        if token and token not in ("1-0", "0-1", "1/2-1/2", "*"):
            moves.append(token)
    return moves


def parse_eco_row(eco: str, name: str, pgn: str) -> tuple[str, str, list[str]]:
    """Parse one ECO TSV row. Returns (eco_code, opening_name, moves)."""
    moves = parse_pgn_moves(pgn)
    return eco.strip(), name.strip(), moves


def ingest_eco(conn, source: str | Path) -> tuple[int, int]:
    """
    Ingest ECO taxonomy. Returns (nodes_created, entries_created).
    """
    source = Path(source) if isinstance(source, str) else source
    nodes_created = 0
    entries_created = 0

    # Collect TSV files (a.tsv through e.tsv)
    if source.is_dir():
        tsv_files = sorted(source.glob("*.tsv"))
    else:
        tsv_files = [source]

    if not tsv_files:
        raise FileNotFoundError(f"No TSV files found in {source}")

    for tsv_path in tsv_files:
        with open(tsv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                eco = row.get("eco", "")
                name = row.get("name", "")
                pgn = row.get("pgn", "")
                if not eco or not name or not pgn:
                    continue

                try:
                    eco_code, opening_name, moves = parse_eco_row(eco, name, pgn)
                except Exception as e:
                    print(f"Warning: skip row {eco} {name}: {e}", file=sys.stderr)
                    continue

                if not moves:
                    continue

                board = chess.Board()
                last_san = ""
                for san in moves:
                    try:
                        move = board.parse_san(san)
                        board.push(move)
                        last_san = san
                    except (chess.InvalidMoveError, chess.AmbiguousMoveError) as e:
                        print(f"Warning: invalid move {san} in {eco} {name}: {e}", file=sys.stderr)
                        break

                if not last_san:
                    continue

                root_fen = board.fen()
                # Side that just moved: if it's Black's turn, White just moved
                side = "W" if board.turn == chess.BLACK else "B"

                # Extract variation name (part after ":")
                variation_name = None
                if ":" in opening_name:
                    parts = opening_name.split(":", 1)
                    variation_name = parts[1].strip() if len(parts) > 1 else None

                node = OpeningNode(
                    fen=root_fen,
                    pgn_move=last_san,
                    move_number=board.fullmove_number,
                    side=side,
                    eco_code=eco_code,
                    opening_name=opening_name,
                    variation_name=variation_name,
                    parent_node_id=None,
                    is_branching_node=False,
                    game_count=0,
                )
                node = upsert_node(conn, node)
                nodes_created += 1

                entry = OpeningEntry(
                    eco_code=eco_code,
                    name=opening_name,
                    root_node_id=node.node_id,
                    primary_color="W",
                )
                upsert_entry(conn, entry)
                entries_created += 1

    return nodes_created, entries_created


def main():
    parser = argparse.ArgumentParser(description="ECO Skeleton Ingestion")
    parser.add_argument(
        "--source",
        default="data/eco",
        help="Path to ECO TSV files or directory (a.tsv, b.tsv, ...)",
    )
    args = parser.parse_args()

    source = Path(args.source)
    if not source.exists():
        print(f"Error: source {source} does not exist.", file=sys.stderr)
        print("Download ECO data from https://github.com/lichess-org/chess-openings", file=sys.stderr)
        print("  mkdir -p data/eco && curl -o data/eco/a.tsv https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv", file=sys.stderr)
        sys.exit(1)

    with get_connection() as conn:
        nodes, entries = ingest_eco(conn, source)
        print(f"Ingested {nodes} nodes, {entries} entries.")


if __name__ == "__main__":
    main()
