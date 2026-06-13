-- Migration 017: Add plain-text supplier field to stock_items.
-- The original schema used supplier_id (FK to suppliers table) which is
-- overkill for a bar. This adds a simple text column instead.
-- Safe to re-run.

ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS supplier text;
