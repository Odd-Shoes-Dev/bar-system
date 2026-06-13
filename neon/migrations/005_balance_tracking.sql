-- ============================================================
-- 005_balance_tracking.sql
-- Add partial payment / unpaid balance tracking to visits
-- ============================================================

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS amount_paid       NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due       NUMERIC NOT NULL DEFAULT 0;

-- Mark all existing completed visits as fully paid
UPDATE visits
SET
  amount_paid       = total_amount,
  checkout_discount = 0,
  balance_due       = 0,
  payment_status    = 'paid'
WHERE is_active = true;

-- Ensure all values are non-negative (app logic maintains the math consistency)
ALTER TABLE visits
  ADD CONSTRAINT balance_due_non_negative CHECK (balance_due >= 0),
  ADD CONSTRAINT amount_paid_non_negative CHECK (amount_paid >= 0),
  ADD CONSTRAINT checkout_discount_non_negative CHECK (checkout_discount >= 0);

-- Index for fast "clients with outstanding balance" queries
CREATE INDEX IF NOT EXISTS idx_visits_balance_due
  ON visits (salon_id, balance_due)
  WHERE balance_due > 0;
