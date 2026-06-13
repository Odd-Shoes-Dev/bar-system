-- ============================================================
-- 013 – STOCKTAKES & VARIANCE TRACKING
-- Run after 012_sync_service_categories.sql
-- The core profitability tool for bars: compare what the system
-- says should be in stock (theoretical) vs. what is actually
-- physically present (actual). The gap is variance / shrinkage.
-- ============================================================

-- ── STOCKTAKES ────────────────────────────────────────────────
-- One stocktake = one counting session (weekly, monthly, etc.)
CREATE TABLE IF NOT EXISTS stocktakes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid        NOT NULL REFERENCES salons(id)  ON DELETE CASCADE,
  branch_id    uuid        REFERENCES branches(id)         ON DELETE SET NULL,
  name         varchar     NOT NULL,          -- e.g. "Week 23 Stocktake"
  period_start date        NOT NULL,
  period_end   date        NOT NULL,
  -- draft → submitted → approved
  status       varchar     NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','submitted','approved')),
  notes        text,
  created_by   uuid        REFERENCES users(id) ON DELETE SET NULL,
  submitted_by uuid        REFERENCES users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  approved_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── STOCKTAKE LINE ITEMS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS stocktake_items (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id  uuid          NOT NULL REFERENCES stocktakes(id)    ON DELETE CASCADE,
  item_id       uuid          NOT NULL REFERENCES stock_items(id)   ON DELETE RESTRICT,
  -- system-calculated from opening stock + purchases - sales in the period
  expected_qty  numeric(12,2) NOT NULL DEFAULT 0,
  -- physically counted by staff
  actual_qty    numeric(12,2),
  -- variance = actual - expected (negative = loss/shrinkage, positive = surplus)
  variance      numeric(12,2) GENERATED ALWAYS AS (
                  CASE WHEN actual_qty IS NOT NULL
                       THEN actual_qty - expected_qty
                       ELSE NULL
                  END
                ) STORED,
  unit_cost     numeric(12,2) NOT NULL DEFAULT 0,
  -- monetary loss = |variance| * unit_cost (when negative)
  variance_value numeric(12,2) GENERATED ALWAYS AS (
                  CASE WHEN actual_qty IS NOT NULL
                       THEN (actual_qty - expected_qty) * unit_cost
                       ELSE NULL
                  END
                ) STORED,
  notes         text,
  counted_by    uuid          REFERENCES users(id) ON DELETE SET NULL,
  counted_at    timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

-- ── VARIANCE REASONS ──────────────────────────────────────────
-- Staff can flag why a variance occurred — accountability trail.
CREATE TABLE IF NOT EXISTS variance_reasons (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_item_id uuid   NOT NULL REFERENCES stocktake_items(id) ON DELETE CASCADE,
  salon_id     uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  reason_type  varchar     NOT NULL
                 CHECK (reason_type IN ('spillage','theft','breakage','miscounting','expired','transfer','other')),
  qty_explained numeric(12,2) NOT NULL DEFAULT 0,
  notes        text,
  reported_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stocktakes_salon
  ON stocktakes(salon_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_stocktakes_branch
  ON stocktakes(branch_id);

CREATE INDEX IF NOT EXISTS idx_stocktake_items_stocktake
  ON stocktake_items(stocktake_id);

CREATE INDEX IF NOT EXISTS idx_stocktake_items_item
  ON stocktake_items(item_id);

CREATE INDEX IF NOT EXISTS idx_variance_reasons_item
  ON variance_reasons(stocktake_item_id);

CREATE TRIGGER update_stocktakes_updated_at
  BEFORE UPDATE ON stocktakes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
