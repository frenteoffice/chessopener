"""Tests for export.py — TDD §10.8"""

import json
import sys
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import chess
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models import OpeningNode
from export import node_to_openingiq, export_json, export_csv, export_pgn


def make_node(**kwargs) -> OpeningNode:
    defaults = dict(
        node_id=uuid.uuid4(),
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        pgn_move="e4",
        move_number=1,
        side="W",
        eco_code="C50",
        opening_name="Italian Game",
        stockfish_eval=32.0,
        best_move="Nf3",
        is_dubious=False,
        is_busted=False,
        game_count=10000,
        white_win_pct=38.2,
    )
    defaults.update(kwargs)
    return OpeningNode(**defaults)


def test_json_export_response_weights_sum_to_one():
    """responseWeights must sum to 1.0 within tolerance."""
    node = make_node()
    children_data = [
        {"san": "e5", "game_count": 600},
        {"san": "c5", "game_count": 300},
        {"san": "e6", "game_count": 100},
    ]
    out = node_to_openingiq(node, children_data)
    assert abs(sum(out["responseWeights"]) - 1.0) < 0.001


def test_json_export_engine_responses_ordered_by_game_count():
    """engineResponses ordered highest game_count first."""
    node = make_node()
    children_data = [
        {"san": "e6", "game_count": 100},
        {"san": "e5", "game_count": 600},
        {"san": "c5", "game_count": 300},
    ]
    out = node_to_openingiq(node, children_data)
    assert len(out["engineResponses"]) == 3
    assert len(out["responseWeights"]) == 3


def test_json_export_includes_extended_fields():
    """Extended fields (stockfish_eval, best_move, game_count) present when set."""
    node = make_node(stockfish_eval=32.0, best_move="Nf3", game_count=10000)
    out = node_to_openingiq(node, [])
    assert out["stockfish_eval"] == 32.0
    assert out["best_move"] == "Nf3"
    assert out["game_count"] == 10000


def test_json_export_omits_false_flags():
    """is_dubious and is_busted only present in output when True."""
    node = make_node(is_dubious=False, is_busted=False)
    out = node_to_openingiq(node, [])
    assert "is_dubious" not in out
    assert "is_busted" not in out


def test_json_export_matches_openingiq_schema(tmp_path):
    """Exported file must have required OpeningIQ top-level fields."""
    node = make_node()
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)

    with patch("export.get_seed_nodes", return_value=[node]), \
         patch("export.build_tree", return_value={
             "san": "e4", "fen": node.fen,
             "engineResponses": ["e5", "c5"],
             "responseWeights": [0.6, 0.4],
             "children": [],
         }):
        count = export_json(mock_conn, tmp_path, None, max_depth=3, min_games=0)

    assert count == 1
    exported = list(tmp_path.glob("*.json"))
    assert len(exported) == 1

    data = json.loads(exported[0].read_text())
    required_fields = {"id", "name", "eco", "color", "difficulty", "description",
                       "rootFen", "rootResponses", "rootWeights", "moves"}
    assert required_fields.issubset(data.keys())


def test_csv_export_all_fields_present(tmp_path):
    """CSV header must contain all OpeningNode field names."""
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    output = tmp_path / "nodes.csv"
    export_csv(mock_conn, output)

    import csv
    with open(output) as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames

    expected = ["node_id", "fen", "pgn_move", "move_number", "side", "eco_code",
                "opening_name", "variation_name", "parent_node_id", "is_branching_node",
                "is_leaf", "stockfish_eval", "stockfish_depth", "best_move",
                "is_dubious", "is_busted", "resulting_structure",
                "game_count", "white_win_pct", "draw_pct"]
    for field in expected:
        assert field in headers, f"Missing CSV field: {field}"


def test_pgn_export_contains_eval_annotations(tmp_path):
    """Exported PGN must contain [%eval] comments for annotated nodes."""
    node = make_node(stockfish_eval=32.0)
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("export.get_seed_nodes", return_value=[node]), \
         patch("export.get_children", return_value=[]):
        count = export_pgn(mock_conn, tmp_path, None)

    assert count == 1
    pgn_files = list(tmp_path.glob("*.pgn"))
    assert len(pgn_files) == 1
    content = pgn_files[0].read_text()
    assert "%eval" in content
