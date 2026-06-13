-- ============================================================
-- 007 – BAR TABLES / SEATING MANAGEMENT
-- Run after 006_login_rate_limiting.sql
-- Tracks physical tables so orders can be linked to a seat.
-- ============================================================

CREATE TABLE IF NOT EXISTS bar_tables (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  table_number varchar     NOT NULL,
  capacity     integer     NOT NULL DEFAULT 4 CHECK (capacity > 0),
  -- location examples: 'indoor', 'outdoor', 'vip', 'bar', 'terrace'
  location     varchar     DEFAULT 'indoor',
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bar_tables_salon_number
  ON bar_tables(salon_id, table_number);

CREATE INDEX IF NOT EXISTS idx_bar_tables_salon
  ON bar_tables(salon_id)
  WHERE is_active = true;

-- Link orders (visits) to a table
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES bar_tables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visits_table
  ON visits(table_id)
  WHERE table_id IS NOT NULL;

CREATE TRIGGER update_bar_tables_updated_at
  BEFORE UPDATE ON bar_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
