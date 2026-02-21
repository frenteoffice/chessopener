"""Data models for the Chess Opening Knowledge Base pipeline."""

from dataclasses import dataclass, field
from typing import Literal
from uuid import UUID


@dataclass
class OpeningNode:
    """Atomic unit: every tracked position in the move tree."""

    node_id: UUID | None = None
    fen: str = ""
    pgn_move: str = ""
    move_number: int = 0
    side: Literal["W", "B"] = "W"
    eco_code: str = ""
    opening_name: str = ""
    variation_name: str | None = None
    parent_node_id: UUID | None = None
    child_node_ids: list[UUID] = field(default_factory=list)
    is_branching_node: bool = False
    stockfish_eval: float | None = None
    stockfish_depth: int | None = None
    best_move: str | None = None
    is_dubious: bool = False
    is_busted: bool = False
    transposition_ids: list[UUID] = field(default_factory=list)
    resulting_structure: str | None = None
    game_count: int = 0
    white_win_pct: float | None = None
    draw_pct: float | None = None
    is_leaf: bool = False


@dataclass
class OpeningEntry:
    """Named opening or variation — logical grouping from root to resolution."""

    opening_id: UUID | None = None
    eco_code: str = ""
    name: str = ""
    aliases: list[str] = field(default_factory=list)
    category: Literal["opening", "defense", "gambit", "structure", "system"] = "opening"
    root_node_id: UUID | None = None
    resolution_node_ids: list[UUID] = field(default_factory=list)
    primary_color: Literal["W", "B"] = "W"
    related_opening_ids: list[UUID] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


@dataclass
class PawnStructure:
    """Named middlegame pawn configurations arising from multiple openings."""

    structure_id: UUID | None = None
    name: str = ""
    description: str = ""
    arising_from_opening_ids: list[UUID] = field(default_factory=list)
    typical_plans_white: list[str] = field(default_factory=list)
    typical_plans_black: list[str] = field(default_factory=list)


@dataclass
class MissingVariation:
    """Variation present in master games but absent from the tree."""

    fen: str
    opening_name: str
    pgn_source: str
    game_count: int
