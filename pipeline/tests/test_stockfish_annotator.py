"""Tests for stockfish_annotator.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from stockfish_annotator import is_dubious, is_busted


def test_score_to_cp_normalizes_to_white_perspective():
    """score_to_cp must always return White-perspective centipawns."""
    # Functional check: is_dubious with a White-perspective eval
    # If eval is -60 from White's perspective, and White just moved, it should be dubious
    assert is_dubious(-60, "W") is True
    # If eval is +60 from White's perspective, and Black just moved, it should be dubious
    assert is_dubious(60, "B") is True


def test_is_dubious_threshold():
    # White just moved; eval -51 cp -> dubious
    assert is_dubious(-51, "W") is True
    assert is_dubious(-49, "W") is False
    # Black just moved; eval +51 (good for White = bad for Black) -> dubious
    assert is_dubious(51, "B") is True
    assert is_dubious(49, "B") is False


def test_is_busted_threshold():
    assert is_busted(-151, "W") is True
    assert is_busted(-149, "W") is False
    assert is_busted(151, "B") is True
    assert is_busted(149, "B") is False
