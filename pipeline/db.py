"""Database layer for the Chess Opening Knowledge Base."""

import os
from contextlib import contextmanager
from typing import Iterator
from uuid import UUID

import psycopg
from psycopg.rows import class_row

from models import OpeningEntry, OpeningNode


def get_connection_string() -> str:
    """Get database connection string from environment."""
    return os.environ.get(
        "DATABASE_URL",
        "postgresql://localhost:5432/chess_openings?user=postgres&password=postgres",
    )


@contextmanager
def get_connection():
    """Context manager for database connections."""
    conn = psycopg.connect(get_connection_string())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def upsert_node(conn: psycopg.Connection, node: OpeningNode) -> OpeningNode:
    """
    Insert or update a node. Uses FEN as conflict key.
    Returns the node with node_id populated.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO opening_nodes (
                fen, pgn_move, move_number, side, eco_code, opening_name, variation_name,
                parent_node_id, is_branching_node, is_leaf, stockfish_eval, stockfish_depth,
                best_move, is_dubious, is_busted, resulting_structure, game_count,
                white_win_pct, draw_pct
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (fen) DO UPDATE SET
                pgn_move = COALESCE(EXCLUDED.pgn_move, opening_nodes.pgn_move),
                move_number = COALESCE(EXCLUDED.move_number, opening_nodes.move_number),
                side = COALESCE(EXCLUDED.side, opening_nodes.side),
                eco_code = COALESCE(NULLIF(EXCLUDED.eco_code, ''), opening_nodes.eco_code),
                opening_name = COALESCE(NULLIF(EXCLUDED.opening_name, ''), opening_nodes.opening_name),
                variation_name = COALESCE(EXCLUDED.variation_name, opening_nodes.variation_name),
                parent_node_id = COALESCE(EXCLUDED.parent_node_id, opening_nodes.parent_node_id),
                is_branching_node = opening_nodes.is_branching_node OR EXCLUDED.is_branching_node,
                is_leaf = opening_nodes.is_leaf OR EXCLUDED.is_leaf,
                stockfish_eval = COALESCE(EXCLUDED.stockfish_eval, opening_nodes.stockfish_eval),
                stockfish_depth = COALESCE(EXCLUDED.stockfish_depth, opening_nodes.stockfish_depth),
                best_move = COALESCE(EXCLUDED.best_move, opening_nodes.best_move),
                is_dubious = opening_nodes.is_dubious OR EXCLUDED.is_dubious,
                is_busted = opening_nodes.is_busted OR EXCLUDED.is_busted,
                resulting_structure = COALESCE(EXCLUDED.resulting_structure, opening_nodes.resulting_structure),
                game_count = GREATEST(opening_nodes.game_count, COALESCE(EXCLUDED.game_count, 0)),
                white_win_pct = COALESCE(EXCLUDED.white_win_pct, opening_nodes.white_win_pct),
                draw_pct = COALESCE(EXCLUDED.draw_pct, opening_nodes.draw_pct),
                updated_at = NOW()
            RETURNING node_id, fen, pgn_move, move_number, side, eco_code, opening_name,
                variation_name, parent_node_id, is_branching_node, is_leaf, stockfish_eval,
                stockfish_depth, best_move, is_dubious, is_busted, resulting_structure,
                game_count, white_win_pct, draw_pct
            """,
            (
                node.fen,
                node.pgn_move,
                node.move_number,
                node.side,
                node.eco_code or None,
                node.opening_name or None,
                node.variation_name,
                node.parent_node_id,
                node.is_branching_node,
                node.is_leaf,
                node.stockfish_eval,
                node.stockfish_depth,
                node.best_move,
                node.is_dubious,
                node.is_busted,
                node.resulting_structure,
                node.game_count,
                node.white_win_pct,
                node.draw_pct,
            ),
        )
        row = cur.fetchone()
        if row:
            return OpeningNode(
                node_id=row[0],
                fen=row[1],
                pgn_move=row[2],
                move_number=row[3],
                side=row[4],
                eco_code=row[5] or "",
                opening_name=row[6] or "",
                variation_name=row[7],
                parent_node_id=row[8],
                is_branching_node=row[9],
                is_leaf=row[10],
                stockfish_eval=row[11],
                stockfish_depth=row[12],
                best_move=row[13],
                is_dubious=row[14],
                is_busted=row[15],
                resulting_structure=row[16],
                game_count=row[17] or 0,
                white_win_pct=row[18],
                draw_pct=row[19],
            )
    raise RuntimeError("upsert_node failed to return row")


def add_child(conn: psycopg.Connection, parent_id: UUID, child_id: UUID, sort_order: int = 0) -> None:
    """Add a parent-child relationship."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO node_children (parent_id, child_id, sort_order)
            VALUES (%s, %s, %s)
            ON CONFLICT (parent_id, child_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
            """,
            (parent_id, child_id, sort_order),
        )


def set_branching(conn: psycopg.Connection, node_id: UUID, is_branching: bool) -> None:
    """Mark a node as branching."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE opening_nodes SET is_branching_node = %s, updated_at = NOW() WHERE node_id = %s",
            (is_branching, node_id),
        )


def get_node_by_id(conn: psycopg.Connection, node_id: UUID) -> OpeningNode | None:
    """Fetch a single node by node_id UUID."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT node_id, fen, pgn_move, move_number, side, eco_code, opening_name,
                variation_name, parent_node_id, is_branching_node, is_leaf, stockfish_eval,
                stockfish_depth, best_move, is_dubious, is_busted, resulting_structure,
                game_count, white_win_pct, draw_pct
            FROM opening_nodes WHERE node_id = %s
            """,
            (node_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return OpeningNode(
        node_id=row[0], fen=row[1], pgn_move=row[2], move_number=row[3], side=row[4],
        eco_code=row[5] or "", opening_name=row[6] or "", variation_name=row[7],
        parent_node_id=row[8], is_branching_node=row[9], is_leaf=row[10],
        stockfish_eval=row[11], stockfish_depth=row[12], best_move=row[13],
        is_dubious=row[14], is_busted=row[15], resulting_structure=row[16],
        game_count=row[17] or 0, white_win_pct=row[18], draw_pct=row[19],
    )


def get_node_by_fen(conn: psycopg.Connection, fen: str) -> OpeningNode | None:
    """Get a node by FEN."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT node_id, fen, pgn_move, move_number, side, eco_code, opening_name,
                variation_name, parent_node_id, is_branching_node, is_leaf, stockfish_eval,
                stockfish_depth, best_move, is_dubious, is_busted, resulting_structure,
                game_count, white_win_pct, draw_pct
            FROM opening_nodes WHERE fen = %s
            """,
            (fen,),
        )
        row = cur.fetchone()
        if row:
            return OpeningNode(
                node_id=row[0],
                fen=row[1],
                pgn_move=row[2],
                move_number=row[3],
                side=row[4],
                eco_code=row[5] or "",
                opening_name=row[6] or "",
                variation_name=row[7],
                parent_node_id=row[8],
                is_branching_node=row[9],
                is_leaf=row[10],
                stockfish_eval=row[11],
                stockfish_depth=row[12],
                best_move=row[13],
                is_dubious=row[14],
                is_busted=row[15],
                resulting_structure=row[16],
                game_count=row[17] or 0,
                white_win_pct=row[18],
                draw_pct=row[19],
            )
        return None


def log_node_change(
    conn: psycopg.Connection,
    node_id: UUID,
    field_name: str,
    old_value,
    new_value,
) -> None:
    """Record a field change in the node_changelog table."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO node_changelog (node_id, field_name, old_value, new_value)
            VALUES (%s, %s, %s, %s)
            """,
            (
                node_id,
                field_name,
                str(old_value) if old_value is not None else None,
                str(new_value) if new_value is not None else None,
            ),
        )


def update_node(
    conn: psycopg.Connection,
    node_id: UUID,
    *,
    stockfish_eval: float | None = None,
    stockfish_depth: int | None = None,
    best_move: str | None = None,
    is_dubious: bool | None = None,
    is_busted: bool | None = None,
    resulting_structure: str | None = None,
) -> None:
    """Update node annotation fields."""
    updates = []
    params = []
    if stockfish_eval is not None:
        updates.append("stockfish_eval = %s")
        params.append(stockfish_eval)
    if stockfish_depth is not None:
        updates.append("stockfish_depth = %s")
        params.append(stockfish_depth)
    if best_move is not None:
        updates.append("best_move = %s")
        params.append(best_move)
    if is_dubious is not None:
        updates.append("is_dubious = %s")
        params.append(is_dubious)
    if is_busted is not None:
        updates.append("is_busted = %s")
        params.append(is_busted)
    if resulting_structure is not None:
        updates.append("resulting_structure = %s")
        params.append(resulting_structure)
    if not updates:
        return
    params.append(node_id)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE opening_nodes SET {', '.join(updates)}, updated_at = NOW() WHERE node_id = %s",
            params,
        )


def get_nodes(
    conn: psycopg.Connection,
    *,
    is_branching: bool | None = None,
    is_leaf: bool | None = None,
    order_by: str = "game_count DESC",
    limit: int | None = None,
) -> list[OpeningNode]:
    """Get nodes with optional filters."""
    conditions = []
    params = []
    if is_branching is not None:
        conditions.append("is_branching_node = %s")
        params.append(is_branching)
    if is_leaf is not None:
        conditions.append("is_leaf = %s")
        params.append(is_leaf)
    where = " AND ".join(conditions) if conditions else "TRUE"
    sql = f"""
        SELECT node_id, fen, pgn_move, move_number, side, eco_code, opening_name,
            variation_name, parent_node_id, is_branching_node, is_leaf, stockfish_eval,
            stockfish_depth, best_move, is_dubious, is_busted, resulting_structure,
            game_count, white_win_pct, draw_pct
        FROM opening_nodes WHERE {where}
        ORDER BY {order_by}
    """
    if limit:
        sql += f" LIMIT {limit}"
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [
            OpeningNode(
                node_id=r[0],
                fen=r[1],
                pgn_move=r[2],
                move_number=r[3],
                side=r[4],
                eco_code=r[5] or "",
                opening_name=r[6] or "",
                variation_name=r[7],
                parent_node_id=r[8],
                is_branching_node=r[9],
                is_leaf=r[10],
                stockfish_eval=r[11],
                stockfish_depth=r[12],
                best_move=r[13],
                is_dubious=r[14],
                is_busted=r[15],
                resulting_structure=r[16],
                game_count=r[17] or 0,
                white_win_pct=r[18],
                draw_pct=r[19],
            )
            for r in rows
        ]


def get_children(conn: psycopg.Connection, parent_id: UUID) -> list[tuple[UUID, int]]:
    """Get child node IDs and sort order for a parent."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT child_id, sort_order FROM node_children WHERE parent_id = %s ORDER BY sort_order",
            (parent_id,),
        )
        return [(r[0], r[1]) for r in cur.fetchall()]


def upsert_transposition(conn: psycopg.Connection, node_id_a: UUID, node_id_b: UUID) -> None:
    """Add a transposition link (ensures a < b)."""
    a, b = (node_id_a, node_id_b) if node_id_a < node_id_b else (node_id_b, node_id_a)
    if a == b:
        return
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO node_transpositions (node_id_a, node_id_b) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (a, b),
        )


def upsert_entry(conn: psycopg.Connection, entry: OpeningEntry) -> OpeningEntry:
    """Insert or update an opening entry."""
    resolution_ids = entry.resolution_node_ids or []
    related_ids = entry.related_opening_ids or []
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO opening_entries (eco_code, name, aliases, category, root_node_id, primary_color, tags, resolution_node_ids, related_opening_ids)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (eco_code, name) DO UPDATE SET
                root_node_id = EXCLUDED.root_node_id,
                resolution_node_ids = COALESCE(EXCLUDED.resolution_node_ids, opening_entries.resolution_node_ids),
                related_opening_ids = COALESCE(EXCLUDED.related_opening_ids, opening_entries.related_opening_ids),
                updated_at = NOW()
            RETURNING opening_id
            """,
            (
                entry.eco_code,
                entry.name,
                entry.aliases,
                entry.category,
                entry.root_node_id,
                entry.primary_color,
                entry.tags,
                resolution_ids,
                related_ids,
            ),
        )
        row = cur.fetchone()
        if row:
            entry.opening_id = row[0]
    return entry


def get_seed_nodes(conn: psycopg.Connection, limit: int | None = None) -> list[OpeningNode]:
    """Get root nodes with ECO codes (from Phase 1)."""
    sql = """
        SELECT node_id, fen, pgn_move, move_number, side, eco_code, opening_name,
            variation_name, parent_node_id, is_branching_node, is_leaf, stockfish_eval,
            stockfish_depth, best_move, is_dubious, is_busted, resulting_structure,
            game_count, white_win_pct, draw_pct
        FROM opening_nodes
        WHERE parent_node_id IS NULL AND eco_code IS NOT NULL AND eco_code != ''
    """
    if limit:
        sql += f" LIMIT {limit}"
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
        return [
            OpeningNode(
                node_id=r[0],
                fen=r[1],
                pgn_move=r[2],
                move_number=r[3],
                side=r[4],
                eco_code=r[5] or "",
                opening_name=r[6] or "",
                variation_name=r[7],
                parent_node_id=r[8],
                is_branching_node=r[9],
                is_leaf=r[10],
                stockfish_eval=r[11],
                stockfish_depth=r[12],
                best_move=r[13],
                is_dubious=r[14],
                is_busted=r[15],
                resulting_structure=r[16],
                game_count=r[17] or 0,
                white_win_pct=r[18],
                draw_pct=r[19],
            )
            for r in rows
        ]


def get_leaf_nodes(conn: psycopg.Connection, limit: int | None = None) -> list[OpeningNode]:
    """Get leaf nodes (no children) that lack Stockfish eval."""
    sql = """
        SELECT n.node_id, n.fen, n.pgn_move, n.move_number, n.side, n.eco_code, n.opening_name,
            n.variation_name, n.parent_node_id, n.is_branching_node, n.is_leaf, n.stockfish_eval,
            n.stockfish_depth, n.best_move, n.is_dubious, n.is_busted, n.resulting_structure,
            n.game_count, n.white_win_pct, n.draw_pct
        FROM opening_nodes n
        WHERE NOT EXISTS (SELECT 1 FROM node_children WHERE parent_id = n.node_id)
        AND n.stockfish_eval IS NULL
        ORDER BY n.game_count DESC
    """
    if limit:
        sql += f" LIMIT {limit}"
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
        return [
            OpeningNode(
                node_id=r[0], fen=r[1], pgn_move=r[2], move_number=r[3], side=r[4],
                eco_code=r[5] or "", opening_name=r[6] or "", variation_name=r[7],
                parent_node_id=r[8], is_branching_node=r[9], is_leaf=r[10],
                stockfish_eval=r[11], stockfish_depth=r[12], best_move=r[13],
                is_dubious=r[14], is_busted=r[15], resulting_structure=r[16],
                game_count=r[17] or 0, white_win_pct=r[18], draw_pct=r[19],
            )
            for r in rows
        ]


def get_eco_count(conn: psycopg.Connection) -> int:
    """Count distinct ECO codes in opening_nodes."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(DISTINCT eco_code) FROM opening_nodes WHERE eco_code IS NOT NULL AND eco_code != ''")
        return cur.fetchone()[0] or 0
