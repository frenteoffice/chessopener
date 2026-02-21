-- Chess Opening Knowledge Base - PostgreSQL Schema
-- Run with: psql -f schema.sql

-- Note: For ON CONFLICT (fen), we need a unique constraint. FEN is the natural key.
CREATE TABLE IF NOT EXISTS opening_nodes (
    node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fen             TEXT NOT NULL,
    pgn_move        TEXT NOT NULL,
    move_number     INTEGER NOT NULL,
    side            CHAR(1) NOT NULL CHECK (side IN ('W', 'B')),
    eco_code        TEXT,
    opening_name    TEXT,
    variation_name  TEXT,
    parent_node_id  UUID REFERENCES opening_nodes(node_id),
    is_branching_node BOOLEAN NOT NULL DEFAULT FALSE,
    is_leaf         BOOLEAN NOT NULL DEFAULT FALSE,
    stockfish_eval  REAL,
    stockfish_depth INTEGER,
    best_move       TEXT,
    is_dubious      BOOLEAN NOT NULL DEFAULT FALSE,
    is_busted       BOOLEAN NOT NULL DEFAULT FALSE,
    resulting_structure TEXT,
    game_count      INTEGER NOT NULL DEFAULT 0,
    white_win_pct   REAL,
    draw_pct        REAL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opening_nodes_fen ON opening_nodes(fen);
CREATE INDEX IF NOT EXISTS idx_opening_nodes_eco ON opening_nodes(eco_code);
CREATE INDEX IF NOT EXISTS idx_opening_nodes_parent ON opening_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_opening_nodes_branching ON opening_nodes(is_branching_node) WHERE is_branching_node = TRUE;
CREATE INDEX IF NOT EXISTS idx_opening_nodes_structure ON opening_nodes(resulting_structure) WHERE resulting_structure IS NOT NULL;

-- Transposition cross-reference (many-to-many)
CREATE TABLE IF NOT EXISTS node_transpositions (
    node_id_a UUID NOT NULL REFERENCES opening_nodes(node_id),
    node_id_b UUID NOT NULL REFERENCES opening_nodes(node_id),
    PRIMARY KEY (node_id_a, node_id_b),
    CHECK (node_id_a < node_id_b)
);

-- Child ordering
CREATE TABLE IF NOT EXISTS node_children (
    parent_id UUID NOT NULL REFERENCES opening_nodes(node_id),
    child_id  UUID NOT NULL REFERENCES opening_nodes(node_id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (parent_id, child_id)
);

-- Opening entries (unique on eco_code + name for upsert)
CREATE TABLE IF NOT EXISTS opening_entries (
    opening_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eco_code        TEXT NOT NULL,
    name            TEXT NOT NULL,
    aliases         TEXT[] DEFAULT '{}',
    category        TEXT NOT NULL DEFAULT 'opening' CHECK (category IN ('opening', 'defense', 'gambit', 'structure', 'system')),
    root_node_id    UUID REFERENCES opening_nodes(node_id),
    primary_color   CHAR(1) NOT NULL DEFAULT 'W' CHECK (primary_color IN ('W', 'B')),
    tags            TEXT[] DEFAULT '{}',
    resolution_node_ids UUID[] DEFAULT '{}',
    related_opening_ids UUID[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (eco_code, name)
);

CREATE INDEX IF NOT EXISTS idx_opening_entries_eco ON opening_entries(eco_code);
CREATE INDEX IF NOT EXISTS idx_opening_entries_name ON opening_entries USING gin(to_tsvector('english', name));

-- Node changelog: tracks per-field changes on re-ingestion or annotation updates
CREATE TABLE IF NOT EXISTS node_changelog (
    changelog_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         UUID NOT NULL REFERENCES opening_nodes(node_id) ON DELETE CASCADE,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    field_name      TEXT NOT NULL,          -- e.g. 'stockfish_eval', 'resulting_structure'
    old_value       TEXT,                   -- previous value serialized as text; NULL if new
    new_value       TEXT                    -- new value serialized as text; NULL if cleared
);

CREATE INDEX IF NOT EXISTS idx_node_changelog_node ON node_changelog(node_id);
CREATE INDEX IF NOT EXISTS idx_node_changelog_changed_at ON node_changelog(changed_at);

-- Pawn structures
CREATE TABLE IF NOT EXISTS pawn_structures (
    structure_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    description    TEXT,
    typical_plans_white TEXT[] DEFAULT '{}',
    typical_plans_black TEXT[] DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
