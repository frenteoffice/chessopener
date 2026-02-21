#!/usr/bin/env python3
"""
Phase 6 — Transposition Resolution

Populates node_transpositions for positions reachable via multiple move orders.
Nodes with the same FEN from different parent lineages are linked.

Usage:
  python transposition_resolver.py
"""

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import get_connection, upsert_transposition


def resolve_transpositions(conn) -> int:
    """Link nodes that share the same FEN (transpositions). Returns links created."""
    with conn.cursor() as cur:
        # Find nodes that have multiple parents (reached via different paths)
        cur.execute(
            """
            SELECT child_id, array_agg(parent_id) as parent_ids
            FROM node_children
            GROUP BY child_id
            HAVING COUNT(DISTINCT parent_id) > 1
            """
        )
        rows = cur.fetchall()

    links_created = 0
    for child_id, parent_ids in rows:
        # Each pair of parents represents different paths to same position
        parents = list(parent_ids) if hasattr(parent_ids, "__iter__") else [parent_ids]
        for i in range(len(parents)):
            for j in range(i + 1, len(parents)):
                upsert_transposition(conn, parents[i], parents[j])
                links_created += 1

    return links_created


def main():
    with get_connection() as conn:
        n = resolve_transpositions(conn)
    print(f"Created {n} transposition links.")


if __name__ == "__main__":
    main()
