-- ============================================================
-- 002 – TRIGGERS & STAFF PERFORMANCE
-- Run after 001_schema.sql
-- ============================================================

-- ── UPDATED_AT TRIGGER FUNCTION ───────────────────────────────
-- Reusable trigger to keep updated_at current on any table.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── STAFF PERFORMANCE ─────────────────────────────────────────
-- Periodic snapshots of each staff member's sales and activity.
-- Useful for commission calculations and shift-level P&L.
CREATE TABLE IF NOT EXISTS staff_performance (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid    REFERENCES salons(id) ON DELETE CASCADE,
  staff_id        uuid    REFERENCES users(id)  ON DELETE CASCADE,
  branch_id       uuid,   -- populated after 008_branches.sql
  period_start    date    NOT NULL,
  period_end      date    NOT NULL,
  total_orders    integer DEFAULT 0,
  total_customers integer DEFAULT 0,
  total_revenue   numeric DEFAULT 0,
  avg_order_value numeric,
  performance_score numeric,
  rank            integer,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_salon
  ON staff_performance(salon_id);

CREATE INDEX IF NOT EXISTS idx_staff_performance_staff
  ON staff_performance(staff_id, period_start DESC);

CREATE TRIGGER update_staff_performance_updated_at
  BEFORE UPDATE ON staff_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
