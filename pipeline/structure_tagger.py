#!/usr/bin/env python3
"""
Phase 5 — Structure Tagging

Tags terminal/leaf nodes with pawn structure labels.
Uses rule-based classification against known pawn skeletons.

Usage:
  python structure_tagger.py
"""

import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_connection, get_leaf_nodes, update_node


def get_pawns(board: chess.Board, color: chess.Color) -> list[tuple[int, int]]:
    """Get (file, rank) of pawns for color. Standard 0-7 coordinates."""
    return [
        (chess.square_file(sq), chess.square_rank(sq))
        for sq in chess.SQUARES
        if board.piece_at(sq) == chess.Piece(chess.PAWN, color)
    ]


def is_isolated_queens_pawn(board: chess.Board) -> bool:
    """White or Black has an isolated queen's pawn (d-file with no pawns on c/e)."""
    for color in (chess.WHITE, chess.BLACK):
        pawns = get_pawns(board, color)
        files = [f for f, _ in pawns]
        if 3 in files:  # d-file (0-indexed)
            if 2 not in files and 4 not in files:  # no c or e pawns
                return True
    return False


def is_hanging_pawns(board: chess.Board) -> bool:
    """Two adjacent pawns (e.g. c4-d4) with no pawns on adjacent files."""
    for color in (chess.WHITE, chess.BLACK):
        pawns = get_pawns(board, color)
        files = sorted(set(f for f, _ in pawns))
        for i in range(len(files) - 1):
            if files[i + 1] - files[i] == 1:
                if files[i] - 1 not in files and files[i + 1] + 1 not in files:
                    return True
    return False


def is_hedgehog(board: chess.Board) -> bool:
    """Hedgehog: pawns on 6th rank (Black) or 3rd (White), flexible structure."""
    w_pawns = get_pawns(board, chess.WHITE)
    b_pawns = get_pawns(board, chess.BLACK)
    w_ranks = [r for _, r in w_pawns]
    b_ranks = [r for _, r in b_pawns]
    if not w_ranks or not b_ranks:
        return False
    # Simplified: Black pawns advanced (rank 2-3 in our coords = 5-6 on board)
    return False  # Complex to detect; conservative


def is_maroczy_bind(board: chess.Board) -> bool:
    """White has pawns on c4 and e4 (Maroczy Bind) - advanced, not on 2nd rank."""
    w_pawns = get_pawns(board, chess.WHITE)
    # c4 = file 2, rank 3; e4 = file 4, rank 3
    return (2, 3) in w_pawns and (4, 3) in w_pawns


def is_carlsbad(board: chess.Board) -> bool:
    """Carlsbad: typical QGD Exchange structure - both sides have c,d,e pawns advanced."""
    w = set((f, r) for f, r in get_pawns(board, chess.WHITE) if r >= 2)
    b = set((f, r) for f, r in get_pawns(board, chess.BLACK) if r <= 5)
    wf, bf = {f for f, _ in w}, {f for f, _ in b}
    return 2 in wf and 3 in wf and 4 in wf and 2 in bf and 3 in bf and 4 in bf


def is_caro_kann_structure(board: chess.Board) -> bool:
    """Black has e6-d5 pawn chain (advanced from starting position)."""
    b_pawns = get_pawns(board, chess.BLACK)
    # e6 = file 4 rank 2, d5 = file 3 rank 4 (Black's side)
    b_advanced = [(f, r) for f, r in b_pawns if r <= 5]  # past 7th rank
    return (3, 4) in b_advanced and (4, 2) in b_advanced


def is_french_structure(board: chess.Board) -> bool:
    """French: e6-d5 chain, White has e5 or d4."""
    b_pawns = get_pawns(board, chess.BLACK)
    w_pawns = get_pawns(board, chess.WHITE)
    b_set = set((f, r) for f, r in b_pawns if r <= 5)
    w_set = set((f, r) for f, r in w_pawns if r >= 2)
    return (3, 4) in b_set and (4, 2) in b_set and ((4, 3) in w_set or (3, 4) in w_set)


def is_sicilian_structure(board: chess.Board) -> bool:
    """Sicilian: Black c5 (advanced)."""
    b_pawns = get_pawns(board, chess.BLACK)
    return (2, 4) in b_pawns  # c5


def is_kings_indian_structure(board: chess.Board) -> bool:
    """King's Indian: Black pawns on d6, e5, g6 (advanced)."""
    b_pawns = set((f, r) for f, r in get_pawns(board, chess.BLACK) if r <= 5)
    return (3, 2) in b_pawns and (4, 3) in b_pawns and (6, 2) in b_pawns


PAWN_STRUCTURE_RULES: list[tuple[callable, str]] = [
    (is_isolated_queens_pawn, "Isolated Queen's Pawn"),
    (is_hanging_pawns, "Hanging Pawns"),
    (is_maroczy_bind, "Maroczy Bind"),  # Must be after IQP/hanging - more specific
    (is_carlsbad, "Carlsbad"),
    (is_caro_kann_structure, "Caro-Kann Structure"),
    (is_french_structure, "French Structure"),
    (is_sicilian_structure, "Sicilian Structure"),
    (is_kings_indian_structure, "King's Indian Structure"),
]


def classify_structure(board: chess.Board) -> str:
    """Classify pawn structure. Returns label or 'Unknown'."""
    for predicate, label in PAWN_STRUCTURE_RULES:
        try:
            if predicate(board):
                return label
        except Exception:
            continue
    return "Unknown"


def main():
    with get_connection() as conn:
        leaves = get_leaf_nodes(conn, limit=None)
        # Re-fetch: get_leaf_nodes filters stockfish_eval IS NULL; we want all leaves
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT node_id, fen FROM opening_nodes n
                WHERE NOT EXISTS (SELECT 1 FROM node_children WHERE parent_id = n.node_id)
                AND n.resulting_structure IS NULL
                """
            )
            rows = cur.fetchall()

        tagged = 0
        for node_id, fen in rows:
            try:
                board = chess.Board(fen)
                label = classify_structure(board)
                update_node(conn, node_id, resulting_structure=label)
                tagged += 1
            except Exception as e:
                print(f"Error tagging {fen[:50]}: {e}", file=sys.stderr)
        conn.commit()
        print(f"Tagged {tagged} terminal nodes.")


if __name__ == "__main__":
    main()
