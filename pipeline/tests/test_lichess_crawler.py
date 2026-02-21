"""Tests for lichess_crawler.py — TDD §10.2"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lichess_crawler import lichess_master_moves, expand_tree


@pytest.fixture
def mock_db_conn():
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=MagicMock())
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn


def make_lichess_response(moves: list[dict]) -> dict:
    return {"moves": moves}


def make_move(san: str, white: int, draws: int, black: int) -> dict:
    return {"san": san, "white": white, "draws": draws, "black": black}


@pytest.mark.asyncio
async def test_crawler_prunes_below_min_game_count(mock_db_conn):
    """Moves with total games below threshold are not added."""
    import chess
    from models import OpeningNode
    import uuid

    seed = OpeningNode(
        node_id=uuid.uuid4(),
        fen=chess.Board().fen(),
        pgn_move="",
        eco_code="A00",
        opening_name="Test",
    )

    # 30 total games — below default 50
    lichess_resp = make_lichess_response([make_move("e4", 10, 10, 10)])

    import httpx
    mock_session = AsyncMock(spec=httpx.AsyncClient)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = lichess_resp
    mock_session.get = AsyncMock(return_value=mock_response)

    with patch("lichess_crawler.get_seed_nodes", return_value=[seed]), \
         patch("lichess_crawler.get_node_by_fen", return_value=None), \
         patch("lichess_crawler.upsert_node", side_effect=lambda conn, n: n), \
         patch("lichess_crawler.add_child"), \
         patch("lichess_crawler.set_branching"), \
         patch("lichess_crawler.upsert_transposition"):

        semaphore = asyncio.Semaphore(1)
        added = await expand_tree(mock_db_conn, mock_session, min_games=50, max_depth=1,
                                  token=None, semaphore=semaphore)
        assert added == 0  # Below threshold, not added


@pytest.mark.asyncio
async def test_crawler_respects_depth_limit(mock_db_conn):
    """Crawl does not expand nodes at or beyond max_depth."""
    import chess
    from models import OpeningNode
    import uuid

    seed = OpeningNode(
        node_id=uuid.uuid4(),
        fen=chess.Board().fen(),
        pgn_move="",
        eco_code="A00",
        opening_name="Test",
    )

    import httpx
    mock_session = AsyncMock(spec=httpx.AsyncClient)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = make_lichess_response([make_move("e4", 40, 30, 30)])
    mock_session.get = AsyncMock(return_value=mock_response)

    call_count = 0

    async def fake_lichess(fen, session, token=None):
        nonlocal call_count
        call_count += 1
        return make_lichess_response([make_move("e4", 40, 30, 30)])

    with patch("lichess_crawler.lichess_master_moves", side_effect=fake_lichess), \
         patch("lichess_crawler.get_seed_nodes", return_value=[seed]), \
         patch("lichess_crawler.get_node_by_fen", return_value=None), \
         patch("lichess_crawler.upsert_node", side_effect=lambda conn, n: n), \
         patch("lichess_crawler.add_child"), \
         patch("lichess_crawler.set_branching"), \
         patch("lichess_crawler.upsert_transposition"):

        semaphore = asyncio.Semaphore(1)
        added = await expand_tree(mock_db_conn, mock_session, min_games=50, max_depth=0,
                                  token=None, semaphore=semaphore)
        assert added == 0
        assert call_count == 0


@pytest.mark.asyncio
async def test_crawler_records_win_rates(mock_db_conn):
    """game_count, white_win_pct, draw_pct populated from API response."""
    import chess
    from models import OpeningNode
    import uuid

    seed = OpeningNode(
        node_id=uuid.uuid4(),
        fen=chess.Board().fen(),
        pgn_move="",
        eco_code="A00",
        opening_name="Test",
    )

    captured_nodes = []

    def capture_upsert(conn, node):
        if node.pgn_move:
            captured_nodes.append(node)
        if not node.node_id:
            node.node_id = uuid.uuid4()
        return node

    async def fake_lichess(fen, session, token=None):
        return make_lichess_response([make_move("e4", 60, 25, 15)])

    with patch("lichess_crawler.lichess_master_moves", side_effect=fake_lichess), \
         patch("lichess_crawler.get_seed_nodes", return_value=[seed]), \
         patch("lichess_crawler.get_node_by_fen", return_value=None), \
         patch("lichess_crawler.upsert_node", side_effect=capture_upsert), \
         patch("lichess_crawler.add_child"), \
         patch("lichess_crawler.set_branching"), \
         patch("lichess_crawler.upsert_transposition"):

        semaphore = asyncio.Semaphore(1)
        await expand_tree(mock_db_conn, AsyncMock(), min_games=50, max_depth=1,
                          token=None, semaphore=semaphore)

        assert len(captured_nodes) == 1
        n = captured_nodes[0]
        assert n.game_count == 100
        assert abs(n.white_win_pct - 60.0) < 0.1
        assert abs(n.draw_pct - 25.0) < 0.1


@pytest.mark.asyncio
async def test_crawler_retries_on_429(mock_db_conn):
    """429 response causes node to be re-queued; eventual success adds node."""
    import chess
    from models import OpeningNode
    import uuid

    seed = OpeningNode(
        node_id=uuid.uuid4(),
        fen=chess.Board().fen(),
        pgn_move="",
        eco_code="A00",
        opening_name="Test",
    )

    call_count = 0

    async def fake_lichess_with_429(fen, session, token=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("Rate limited (429)")
        return make_lichess_response([make_move("e4", 40, 30, 30)])

    with patch("lichess_crawler.lichess_master_moves", side_effect=fake_lichess_with_429), \
         patch("lichess_crawler.get_seed_nodes", return_value=[seed]), \
         patch("lichess_crawler.get_node_by_fen", return_value=None), \
         patch("lichess_crawler.upsert_node", side_effect=lambda conn, n: n), \
         patch("lichess_crawler.add_child"), \
         patch("lichess_crawler.set_branching"), \
         patch("lichess_crawler.upsert_transposition"), \
         patch("asyncio.sleep", new_callable=AsyncMock):

        semaphore = asyncio.Semaphore(1)
        added = await expand_tree(mock_db_conn, AsyncMock(), min_games=50, max_depth=1,
                                  token=None, semaphore=semaphore)
        assert call_count == 2
        assert added == 1


@pytest.mark.asyncio
async def test_crawler_deduplicates_transposed_positions(mock_db_conn):
    """When two paths reach the same FEN, upsert_transposition is called."""
    import chess
    from models import OpeningNode
    import uuid

    existing_node_id = uuid.uuid4()
    seed_id = uuid.uuid4()
    seed = OpeningNode(
        node_id=seed_id,
        fen=chess.Board().fen(),
        pgn_move="",
        eco_code="A00",
        opening_name="Test",
        parent_node_id=uuid.uuid4(),
    )

    existing = OpeningNode(
        node_id=existing_node_id,
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        pgn_move="e4",
        parent_node_id=uuid.uuid4(),
    )

    transposition_calls = []

    async def fake_lichess(fen, session, token=None):
        return make_lichess_response([make_move("e4", 40, 30, 30)])

    with patch("lichess_crawler.lichess_master_moves", side_effect=fake_lichess), \
         patch("lichess_crawler.get_seed_nodes", return_value=[seed]), \
         patch("lichess_crawler.get_node_by_fen", return_value=existing), \
         patch("lichess_crawler.upsert_node"), \
         patch("lichess_crawler.add_child"), \
         patch("lichess_crawler.set_branching"), \
         patch("lichess_crawler.upsert_transposition",
               side_effect=lambda conn, a, b: transposition_calls.append((a, b))):

        semaphore = asyncio.Semaphore(1)
        await expand_tree(mock_db_conn, AsyncMock(), min_games=50, max_depth=1,
                          token=None, semaphore=semaphore)

        assert len(transposition_calls) == 1
