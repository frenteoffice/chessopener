"""Tests for eco_ingest.py"""

import tempfile
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from eco_ingest import parse_pgn_moves, parse_eco_row


def test_parse_pgn_moves_simple():
    assert parse_pgn_moves("1. e4") == ["e4"]
    assert parse_pgn_moves("1. Nh3") == ["Nh3"]


def test_parse_pgn_moves_sequence():
    assert parse_pgn_moves("1. e4 e5 2. Nf3 Nc6") == ["e4", "e5", "Nf3", "Nc6"]


def test_parse_pgn_moves_longer():
    moves = parse_pgn_moves("1. e4 e6 2. d4 d5 3. exd5 exd5 4. Nf3")
    assert moves == ["e4", "e6", "d4", "d5", "exd5", "exd5", "Nf3"]


def test_parse_eco_row():
    eco, name, moves = parse_eco_row("C50", "Italian Game", "1. e4 e5 2. Nf3 Nc6 3. Bc4")
    assert eco == "C50"
    assert name == "Italian Game"
    assert moves == ["e4", "e5", "Nf3", "Nc6", "Bc4"]


@pytest.mark.integration
def test_eco_ingest_creates_nodes_in_db(tmp_path):
    """Create sample TSV and run full ingest against a real DB."""
    import os
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL not set — skipping DB integration test")
    tsv = tmp_path / "c.tsv"
    tsv.write_text("eco\tname\tpgn\nC50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4\n")
    from db import get_connection
    from eco_ingest import ingest_eco
    with get_connection() as conn:
        n, e = ingest_eco(conn, tmp_path)
        assert n >= 1
        assert e >= 1
