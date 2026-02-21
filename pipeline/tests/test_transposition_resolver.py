"""Tests for transposition_resolver.py — TDD §10.6"""

import sys
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from transposition_resolver import resolve_transpositions


def make_uuid():
    return uuid.uuid4()


def test_known_transposition_is_linked():
    """Nodes with multiple parents -> transposition link created between parents."""
    child_id = make_uuid()
    parent_a = make_uuid()
    parent_b = make_uuid()

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [(child_id, [parent_a, parent_b])]
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    transposition_calls = []
    with patch("transposition_resolver.upsert_transposition",
               side_effect=lambda conn, a, b: transposition_calls.append((a, b))):
        links = resolve_transpositions(mock_conn)

    assert links == 1
    assert len(transposition_calls) == 1


def test_no_self_transposition():
    """A node with only one parent never creates a transposition link."""
    child_id = make_uuid()
    parent_a = make_uuid()

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("transposition_resolver.upsert_transposition") as mock_upsert:
        links = resolve_transpositions(mock_conn)

    assert links == 0
    mock_upsert.assert_not_called()


def test_three_parents_creates_three_links():
    """Three parents for one child -> C(3,2) = 3 transposition pairs."""
    child_id = make_uuid()
    parents = [make_uuid(), make_uuid(), make_uuid()]

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [(child_id, parents)]
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    transposition_calls = []
    with patch("transposition_resolver.upsert_transposition",
               side_effect=lambda conn, a, b: transposition_calls.append((a, b))):
        links = resolve_transpositions(mock_conn)

    assert links == 3
    assert len(transposition_calls) == 3
    assert len(set(frozenset(p) for p in transposition_calls)) == 3
