-- Migration: Add node_changelog table for tracking annotation updates
-- Run with: psql $DATABASE_URL -f 001_add_node_changelog.sql

CREATE TABLE IF NOT EXISTS node_changelog (
    changelog_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         UUID NOT NULL REFERENCES opening_nodes(node_id) ON DELETE CASCADE,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    field_name      TEXT NOT NULL,
    old_value       TEXT,
    new_value       TEXT
);

CREATE INDEX IF NOT EXISTS idx_node_changelog_node ON node_changelog(node_id);
CREATE INDEX IF NOT EXISTS idx_node_changelog_changed_at ON node_changelog(changed_at);
