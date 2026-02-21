-- Migration: Add resolution_node_ids and related_opening_ids to opening_entries
-- Run with: psql $DATABASE_URL -f 002_add_opening_entry_fields.sql

ALTER TABLE opening_entries
    ADD COLUMN IF NOT EXISTS resolution_node_ids UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS related_opening_ids UUID[] DEFAULT '{}';
