"""Integration tests for the full pipeline — TDD §10.9"""

import sys
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import chess
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_eco_ingest_parse_and_fen_generation():
    """
    End-to-end unit-level integration: parse ECO row -> play moves -> get FEN.
    Does not require a DB connection.
    """
    from eco_ingest import parse_eco_row
    eco, name, moves = parse_eco_row("C50", "Italian Game", "1. e4 e5 2. Nf3 Nc6 3. Bc4")

    board = chess.Board()
    for san in moves:
        board.push_san(san)

    fen = board.fen()
    assert "- 0 3" in fen or "- 3" in fen
    assert "-" in fen.split()[3]
    assert eco == "C50"
    assert name == "Italian Game"
    assert len(moves) == 5


def test_structure_tagger_labels_match_classifystructure_typescript_labels():
    """
    Verify Python structure labels are a superset of the TypeScript StructureLabel union.
    TDD §11.3 requires alignment between Python and TypeScript classifiers.
    """
    from structure_tagger import PAWN_STRUCTURE_RULES

    ts_labels = {
        "open-center", "closed-center", "isolated-queens-pawn", "hanging-pawns",
        "caro-kann-structure", "slav-structure", "french-structure",
        "kings-indian-structure", "london-structure", "sicilian-structure", "unknown",
    }

    python_labels = {label for _, label in PAWN_STRUCTURE_RULES}
    python_labels_normalized = {
        label.lower().replace(" ", "-").replace("'", "") for label in python_labels
    }

    missing_in_python = set()
    for ts_label in ts_labels:
        if ts_label == "unknown":
            continue
        if ts_label not in python_labels_normalized:
            missing_in_python.add(ts_label)

    assert missing_in_python == set(), (
        f"TypeScript labels missing Python counterparts: {missing_in_python}. "
        "TDD §11.3 requires Python and TypeScript classifiers to be aligned."
    )


def test_node_to_openingiq_roundtrip():
    """node_to_openingiq output can be parsed back and weights sum to 1."""
    from export import node_to_openingiq
    from models import OpeningNode

    node = OpeningNode(
        node_id=uuid.uuid4(),
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        pgn_move="e4",
        eco_code="C50",
        opening_name="Italian Game",
        game_count=10000,
    )
    children = [
        {"san": "e5", "game_count": 6000},
        {"san": "c5", "game_count": 3000},
        {"san": "e6", "game_count": 1000},
    ]
    out = node_to_openingiq(node, children)

    assert out["san"] == "e4"
    assert out["fen"] == node.fen
    assert out["engineResponses"] == ["e5", "c5", "e6"]
    assert abs(sum(out["responseWeights"]) - 1.0) < 0.001
    assert abs(out["responseWeights"][0] - 0.6) < 0.01
    assert abs(out["responseWeights"][1] - 0.3) < 0.01
    assert abs(out["responseWeights"][2] - 0.1) < 0.01
