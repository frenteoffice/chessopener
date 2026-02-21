"""
FastAPI Query API for Chess Opening Knowledge Base

Endpoints:
  GET /node/fen/{fen}  - Lookup by FEN
  GET /opening/eco/{eco_code}  - Tree by ECO
  GET /opening/search?q=...  - Fuzzy name search
  GET /structure/{name}/openings  - Openings by pawn structure
  POST /node/pgn  - Walk tree by PGN moves
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import chess
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from db import get_connection, get_node_by_fen, get_children, get_seed_nodes
from export import build_tree

app = FastAPI(title="Chess Opening Knowledge Base API", version="1.0.0")


class PgnWalkRequest(BaseModel):
    moves: str  # e.g. "1.e4 e5 2.Nf3 Nc6 3.Bc4"


def node_to_response(conn, node, include_children: bool = True, include_transpositions: bool = True):
    """Convert node to API response dict."""
    children = []
    if include_children and node.node_id:
        for child_id, _ in get_children(conn, node.node_id):
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT node_id, pgn_move, game_count FROM opening_nodes WHERE node_id = %s",
                    (child_id,),
                )
                r = cur.fetchone()
            if r:
                children.append({"node_id": str(r[0]), "pgn_move": r[1], "game_count": r[2] or 0})

    transpositions = []
    if include_transpositions and node.node_id:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT n.node_id, n.opening_name, n.eco_code
                FROM opening_nodes n
                WHERE n.node_id IN (
                    SELECT node_id_b FROM node_transpositions WHERE node_id_a = %s
                    UNION
                    SELECT node_id_a FROM node_transpositions WHERE node_id_b = %s
                )
                """,
                (node.node_id, node.node_id),
            )
            for row in cur.fetchall():
                transpositions.append({
                    "node_id": str(row[0]),
                    "opening_name": row[1],
                    "eco_code": row[2],
                })

    return {
        "node_id": str(node.node_id) if node.node_id else None,
        "fen": node.fen,
        "pgn_move": node.pgn_move,
        "eco_code": node.eco_code,
        "opening_name": node.opening_name,
        "variation_name": node.variation_name,
        "stockfish_eval": node.stockfish_eval,
        "stockfish_depth": node.stockfish_depth,
        "best_move": node.best_move,
        "is_dubious": node.is_dubious,
        "is_busted": node.is_busted,
        "game_count": node.game_count,
        "white_win_pct": node.white_win_pct,
        "draw_pct": node.draw_pct,
        "resulting_structure": node.resulting_structure,
        "children": children,
        "transpositions": transpositions,
    }


@app.get("/node/fen/{fen:path}")
def get_node_by_fen_endpoint(fen: str):
    """Lookup node by FEN."""
    fen = fen.replace("_", " ")
    with get_connection() as conn:
        node = get_node_by_fen(conn, fen)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        return node_to_response(conn, node)


@app.get("/opening/eco/{eco_code}")
def get_opening_by_eco(
    eco_code: str,
    depth: int = Query(15, le=15),
    min_games: int = Query(50),
):
    """Get full opening tree by ECO code, up to specified depth."""
    with get_connection() as conn:
        seeds = get_seed_nodes(conn)
        seeds = [s for s in seeds if s.eco_code == eco_code]
        if not seeds:
            raise HTTPException(status_code=404, detail=f"ECO {eco_code} not found")
        seed = seeds[0]
        tree = build_tree(conn, seed.node_id, depth, 0, min_games)
        if not tree:
            raise HTTPException(status_code=404, detail="Opening tree is empty")

        return {
            "eco_code": seed.eco_code,
            "opening_name": seed.opening_name,
            "rootFen": seed.fen,
            "tree": tree,
        }


@app.get("/opening/{opening_id}/tree")
def get_opening_tree(
    opening_id: str,
    depth: int = Query(15, le=15),
    min_games: int = Query(50),
):
    """
    Return the complete opening tree for a given opening_id in OpeningIQ-compatible JSON.
    opening_id matches the 'id' field in exported JSON files (e.g. 'c50-italian-game').
    Falls back to ECO code prefix match if no exact id match.
    """
    with get_connection() as conn:
        eco_guess = opening_id.split("-")[0].upper() if "-" in opening_id else opening_id.upper()
        seeds = get_seed_nodes(conn)
        matches = [s for s in seeds if s.eco_code == eco_guess]
        if not matches:
            name_guess = opening_id.replace("-", " ").lower()
            matches = [s for s in seeds if name_guess in s.opening_name.lower()]
        if not matches:
            raise HTTPException(status_code=404, detail=f"Opening '{opening_id}' not found")

        seed = matches[0]
        tree = build_tree(conn, seed.node_id, depth, 0, min_games)
        if not tree:
            raise HTTPException(status_code=404, detail="Opening tree is empty")

        return {
            "id": opening_id,
            "name": seed.opening_name,
            "eco": seed.eco_code,
            "rootFen": seed.fen,
            "rootResponses": tree.get("engineResponses", []),
            "rootWeights": tree.get("responseWeights", []),
            "moves": tree.get("children", []),
        }


@app.get("/opening/search")
def search_openings(q: str = Query(..., min_length=1), limit: int = Query(20, le=100)):
    """Fuzzy search by opening name."""
    with get_connection() as conn:
        seeds = get_seed_nodes(conn)
        q_lower = q.lower()
        matches = [s for s in seeds if q_lower in s.opening_name.lower()][:limit]
        return [
            {"opening_id": str(s.node_id), "eco_code": s.eco_code, "name": s.opening_name}
            for s in matches
        ]


@app.get("/structure/{structure_name}/openings")
def get_openings_by_structure(structure_name: str):
    """Get openings that resolve to a pawn structure."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT eco_code, opening_name FROM opening_nodes
                WHERE resulting_structure ILIKE %s
                """,
                (f"%{structure_name}%",),
            )
            rows = cur.fetchall()
        return [{"eco_code": r[0], "opening_name": r[1]} for r in rows]


@app.post("/node/pgn")
def walk_pgn(body: PgnWalkRequest):
    """Walk tree by PGN move sequence, return final node."""
    import re
    # Strip move numbers (1. 2. etc) and parse SAN moves
    pgn_clean = re.sub(r"\d+\.\s*", "", body.moves)
    moves = pgn_clean.split()
    if not moves:
        raise HTTPException(status_code=400, detail="Invalid PGN")
    board = chess.Board()
    for san in moves:
        try:
            move = board.parse_san(san)
            board.push(move)
        except (chess.InvalidMoveError, chess.AmbiguousMoveError):
            raise HTTPException(status_code=400, detail=f"Invalid move: {san}")
    fen = board.fen()
    with get_connection() as conn:
        node = get_node_by_fen(conn, fen)
        if not node:
            raise HTTPException(status_code=404, detail="Position not in database")
        return node_to_response(conn, node)


@app.get("/health")
def health():
    return {"status": "ok"}
