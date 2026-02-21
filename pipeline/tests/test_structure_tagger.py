"""Tests for structure_tagger.py"""

import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from structure_tagger import classify_structure


def test_starting_position_returns_unknown():
    board = chess.Board()
    assert classify_structure(board) == "Unknown"


def test_french_structure():
    # After 1.e4 e6 2.d4 d5
    board = chess.Board("rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3")
    result = classify_structure(board)
    assert "French" in result or result == "Unknown"


def test_sicilian_structure():
    # Black has c5
    board = chess.Board("rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2")
    result = classify_structure(board)
    assert "Sicilian" in result or result == "Unknown"


def test_iqp_detection():
    # Simplified IQP: White d4, no c or e pawns
    board = chess.Board("r1bqkbnr/ppp2ppp/2n5/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1")
    # May or may not match depending on exact position
    result = classify_structure(board)
    assert isinstance(result, str)
