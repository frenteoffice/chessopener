"""Tests for pgn_validator.py — TDD §10.3"""

import io
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import chess.pgn
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pgn_validator import validate_against_pgn, is_named_variation


def make_pgn_game(opening_header: str, moves: list[str]) -> str:
    """Helper: produce a PGN string for testing."""
    import chess
    game = chess.pgn.Game()
    game.headers["Opening"] = opening_header
    board = game.board()
    node = game
    for san in moves:
        move = board.parse_san(san)
        node = node.add_main_variation(move)
        board.push(move)
    return str(game)


def test_validator_flags_missing_named_variation(tmp_path):
    """Named variation in PGN with >= min_count games but absent from DB -> flagged."""
    pgn_content = "\n\n".join(
        make_pgn_game("Italian Game: Giuoco Piano", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"])
        for _ in range(10)
    )
    pgn_file = tmp_path / "test.pgn"
    pgn_file.write_text(pgn_content)

    mock_conn = MagicMock()
    with patch("pgn_validator.get_node_by_fen", return_value=None):
        results = validate_against_pgn(mock_conn, [pgn_file], min_games=10)

    assert any("Italian" in r.opening_name for r in results)


def test_validator_ignores_low_frequency_variations(tmp_path):
    """Variation appearing in fewer than min_count games -> not flagged."""
    pgn_content = "\n\n".join(
        make_pgn_game("Italian Game: Giuoco Piano", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"])
        for _ in range(5)
    )
    pgn_file = tmp_path / "test.pgn"
    pgn_file.write_text(pgn_content)

    mock_conn = MagicMock()
    with patch("pgn_validator.get_node_by_fen", return_value=None):
        results = validate_against_pgn(mock_conn, [pgn_file], min_games=10)

    assert len(results) == 0


def test_validator_no_false_positives_on_known_nodes(tmp_path):
    """Positions already in DB -> not flagged."""
    pgn_content = make_pgn_game("Italian Game", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"])
    pgn_file = tmp_path / "test.pgn"
    pgn_file.write_text(pgn_content)

    mock_node = MagicMock()
    mock_conn = MagicMock()
    with patch("pgn_validator.get_node_by_fen", return_value=mock_node):
        results = validate_against_pgn(mock_conn, [pgn_file], min_games=1)

    assert len(results) == 0


def test_is_named_variation_returns_true_for_named_lines():
    assert is_named_variation("Italian Game: Giuoco Piano") is True
    assert is_named_variation("Ruy Lopez: Berlin Defense") is True


def test_is_named_variation_returns_false_for_empty():
    assert is_named_variation("") is False
    assert is_named_variation(None) is False
