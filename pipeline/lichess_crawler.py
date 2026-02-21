#!/usr/bin/env python3
"""
Phase 2 — Move Tree Expansion via Lichess API

Expands the move tree to depth 15 using Lichess Opening Explorer API.
Each node gets game_count, white_win_pct, draw_pct from master games.

Usage:
  python lichess_crawler.py --min-games 50 --depth 15
  LICHESS_TOKEN=xxx python lichess_crawler.py  # for higher rate limit
"""

import argparse
import asyncio
import os
import sys
from collections import deque
from pathlib import Path

import chess
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import (
    add_child,
    get_connection,
    get_node_by_fen,
    get_seed_nodes,
    set_branching,
    upsert_node,
    upsert_transposition,
)
from models import OpeningNode

LICHESS_API = "https://explorer.lichess.ovh/masters"
MIN_GAME_COUNT = 50
MAX_DEPTH = 15
RATE_LIMIT = 8 if os.environ.get("LICHESS_TOKEN") else 1  # req/sec


async def lichess_master_moves(fen: str, session: httpx.AsyncClient, token: str | None = None) -> dict:
    """Fetch master moves for a position from Lichess Opening Explorer."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    from urllib.parse import quote
    url = f"{LICHESS_API}?fen={quote(fen)}"
    resp = await session.get(url, headers=headers or None)
    if resp.status_code == 429:
        raise Exception("Rate limited (429)")
    resp.raise_for_status()
    return resp.json()


def is_named_variation(opening_header: str) -> bool:
    """Check if opening header indicates a named variation."""
    return bool(opening_header and opening_header.strip())


async def expand_tree(
    conn,
    session: httpx.AsyncClient,
    min_games: int,
    max_depth: int,
    token: str | None,
    semaphore: asyncio.Semaphore,
    max_seeds: int | None = None,
) -> int:
    """Expand tree from seed nodes. Returns nodes added."""
    seed_nodes = get_seed_nodes(conn, limit=max_seeds)
    if not seed_nodes:
        print("No seed nodes found. Run eco_ingest.py first.", file=sys.stderr)
        return 0

    nodes_added = 0
    queue = deque((n, 0) for n in seed_nodes)

    while queue:
        node, depth = queue.popleft()
        if depth >= max_depth:
            continue

        async with semaphore:
            try:
                data = await lichess_master_moves(node.fen, session, token)
            except Exception as e:
                print(f"API error for {node.fen[:50]}...: {e}", file=sys.stderr)
                if "429" in str(e):
                    await asyncio.sleep(2)
                    queue.append((node, depth))
                continue

        moves = data.get("moves", [])
        if len(moves) >= 2:
            set_branching(conn, node.node_id, True)

        for i, move_data in enumerate(moves):
            white = move_data.get("white", 0)
            draws = move_data.get("draws", 0)
            black = move_data.get("black", 0)
            total = white + draws + black
            if total < min_games:
                continue

            san = move_data.get("san", "")
            if not san:
                continue

            try:
                board = chess.Board(node.fen)
                board.push_san(san)
                child_fen = board.fen()
            except (chess.InvalidMoveError, chess.AmbiguousMoveError):
                continue

            existing = get_node_by_fen(conn, child_fen)
            if existing:
                child_node = existing
                if node.node_id != existing.parent_node_id:
                    upsert_transposition(conn, node.node_id, existing.node_id)
            else:
                white_win_pct = (white / total * 100) if total else None
                draw_pct = (draws / total * 100) if total else None
                child_node = OpeningNode(
                    fen=child_fen,
                    pgn_move=san,
                    move_number=board.fullmove_number,
                    side="W" if board.turn == chess.BLACK else "B",
                    parent_node_id=node.node_id,
                    game_count=total,
                    white_win_pct=white_win_pct,
                    draw_pct=draw_pct,
                    eco_code=node.eco_code or "",
                    opening_name=node.opening_name or "",
                )
                child_node = upsert_node(conn, child_node)
                nodes_added += 1

            add_child(conn, node.node_id, child_node.node_id, sort_order=i)
            queue.append((child_node, depth + 1))

        conn.commit()

    return nodes_added


async def main_async():
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-games", type=int, default=50)
    parser.add_argument("--depth", type=int, default=15)
    parser.add_argument("--max-seeds", type=int, default=None, help="Limit seeds (default: all)")
    args = parser.parse_args()

    token = os.environ.get("LICHESS_TOKEN")
    semaphore = asyncio.Semaphore(RATE_LIMIT)

    with get_connection() as conn:
        async with httpx.AsyncClient(timeout=30.0) as session:
            n = await expand_tree(
                conn, session, args.min_games, args.depth, token, semaphore, args.max_seeds
            )
            print(f"Added {n} nodes.")


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
