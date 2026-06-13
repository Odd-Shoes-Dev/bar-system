-- ============================================================
-- 003 – SUPPLIERS & PURCHASE ORDERS
-- Run after 002_engagement_tables.sql
-- Manages vendors, purchase orders, and delivery tracking.
-- ============================================================

-- ── SUPPLIERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name         varchar     NOT NULL,
  contact_name varchar,
  phone        varchar,
  email        varchar,
  address      text,
  notes        text,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salon_id, name)
);

-- Link stock items to their primary supplier
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_salon    ON suppliers(salon_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stock_items_supplier ON stock_items(supplier_id);

-- ── PURCHASE ORDERS ───────────────────────────────────────────
-- Tracks stock ordered from suppliers and delivery status.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid        NOT NULL REFERENCES salons(id)    ON DELETE CASCADE,
  supplier_id  uuid        REFERENCES suppliers(id)          ON DELETE SET NULL,
  order_date   date        NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  status       varchar     NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','ordered','partial','received','cancelled')),
  notes        text,
  created_by   uuid        REFERENCES users(id) ON DELETE SET NULL,
  received_at  timestamptz,
  received_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id      uuid          NOT NULL REFERENCES stock_items(id)     ON DELETE RESTRICT,
  qty_ordered  numeric(12,2) NOT NULL CHECK (qty_ordered > 0),
  qty_received numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost    numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_salon
  ON purchase_orders(salon_id, order_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier
  ON purchase_orders(supplier_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order
  ON purchase_order_items(order_id);

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
