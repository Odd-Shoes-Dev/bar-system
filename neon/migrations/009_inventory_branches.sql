-- ============================================================
-- Migration 009: Add branch_id to inventory tables
-- ============================================================
-- stock_items and stock_movements were salon-wide.
-- This migration scopes each item and every stock movement
-- to the branch where it physically lives.
-- Existing rows are assigned to the first (oldest) active
-- branch of each salon so nothing is lost.
-- ============================================================

-- 1. Add branch_id to stock_items
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- 2. Add branch_id to stock_movements
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- 3. Back-fill stock_items → first active branch per salon
UPDATE stock_items si
SET    branch_id = (
  SELECT b.id
  FROM   branches b
  WHERE  b.salon_id = si.salon_id
    AND  b.deleted_at IS NULL
  ORDER  BY b.created_at ASC
  LIMIT  1
)
WHERE  si.branch_id IS NULL;

-- 4. Back-fill stock_movements → inherit branch from the item
UPDATE stock_movements sm
SET    branch_id = (
  SELECT si.branch_id
  FROM   stock_items si
  WHERE  si.id = sm.item_id
)
WHERE  sm.branch_id IS NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_stock_items_branch         ON stock_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_salon_branch   ON stock_items(salon_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch     ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_salon_branch ON stock_movements(salon_id, branch_id);
