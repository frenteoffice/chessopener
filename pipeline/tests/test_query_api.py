"""Tests for api/main.py — TDD §10.7"""

import sys
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models import OpeningNode


def make_node(**kwargs) -> OpeningNode:
    defaults = dict(
        node_id=uuid.uuid4(),
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        pgn_move="e4",
        move_number=1,
        side="W",
        eco_code="C50",
        opening_name="Italian Game",
        variation_name=None,
        is_branching_node=True,
        is_leaf=False,
        stockfish_eval=32.0,
        stockfish_depth=22,
        best_move="Nf3",
        is_dubious=False,
        is_busted=False,
        resulting_structure=None,
        game_count=10000,
        white_win_pct=38.2,
        draw_pct=34.1,
    )
    defaults.update(kwargs)
    return OpeningNode(**defaults)


@pytest.fixture
def client():
    from api.main import app
    return TestClient(app)


def test_fen_lookup_returns_correct_node(client):
    node = make_node()
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)

    with patch("api.main.get_connection", return_value=mock_conn), \
         patch("api.main.get_node_by_fen", return_value=node), \
         patch("api.main.get_children", return_value=[]):
        resp = client.get(f"/node/fen/{node.fen.replace(' ', '_')}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["eco_code"] == "C50"
    assert data["opening_name"] == "Italian Game"


def test_fen_lookup_returns_children(client):
    node = make_node()
    child_id = uuid.uuid4()

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = (child_id, "Nf3", 5000)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("api.main.get_connection", return_value=mock_conn), \
         patch("api.main.get_node_by_fen", return_value=node), \
         patch("api.main.get_children", return_value=[(child_id, 0)]):
        resp = client.get(f"/node/fen/{node.fen.replace(' ', '_')}")

    assert resp.status_code == 200
    assert len(resp.json()["children"]) == 1
    assert resp.json()["children"][0]["pgn_move"] == "Nf3"


def test_unknown_fen_returns_404(client):
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)

    with patch("api.main.get_connection", return_value=mock_conn), \
         patch("api.main.get_node_by_fen", return_value=None):
        resp = client.get("/node/fen/rnbqkbnr_pppppppp_8_8_8_8_PPPPPPPP_RNBQKBNR_w_KQkq_-_0_1")

    assert resp.status_code == 404


def test_name_search_returns_fuzzy_matches(client):
    nodes = [
        make_node(eco_code="C60", opening_name="Ruy Lopez"),
        make_node(eco_code="C61", opening_name="Ruy Lopez: Bird's Defense"),
        make_node(eco_code="C50", opening_name="Italian Game"),
    ]
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)

    with patch("api.main.get_connection", return_value=mock_conn), \
         patch("api.main.get_seed_nodes", return_value=nodes):
        resp = client.get("/opening/search?q=ruy")

    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 2
    assert all("Ruy" in r["name"] for r in results)


def test_invalid_pgn_returns_400(client):
    resp = client.post("/node/pgn", json={"moves": "1. INVALID_MOVE"})
    assert resp.status_code == 400


def test_pgn_walk_returns_correct_final_node(client):
    node = make_node(eco_code="C50", opening_name="Italian Game")
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)

    with patch("api.main.get_connection", return_value=mock_conn), \
         patch("api.main.get_node_by_fen", return_value=node), \
         patch("api.main.get_children", return_value=[]):
        resp = client.post("/node/pgn", json={"moves": "1.e4 e5 2.Nf3 Nc6 3.Bc4"})

    assert resp.status_code == 200
    assert resp.json()["eco_code"] == "C50"


def test_fen_lookup_returns_transpositions(client):
    """Transpositions array is populated (not empty TODO list)."""
    node = make_node()
    trans_node_id = uuid.uuid4()

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [(trans_node_id, "Four Knights Game", "C47")]
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("api.main.get_connection", return_value=mock_conn), \
         patch("api.main.get_node_by_fen", return_value=node), \
         patch("api.main.get_children", return_value=[]):
        resp = client.get(f"/node/fen/{node.fen.replace(' ', '_')}")

    assert resp.status_code == 200
    assert len(resp.json()["transpositions"]) == 1
    assert resp.json()["transpositions"][0]["eco_code"] == "C47"
