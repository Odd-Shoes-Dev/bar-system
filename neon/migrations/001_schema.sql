-- ============================================================
-- BAR MANAGEMENT SYSTEM – NEON POSTGRESQL SCHEMA
-- Run this on a fresh Neon database before any other migration
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── SALONS (bar tenants) ──────────────────────────────────────
-- One row per bar registered on the platform.
CREATE TABLE IF NOT EXISTS salons (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    varchar     NOT NULL,
  phone                   varchar     NOT NULL,
  email                   varchar,
  address                 text,
  city                    varchar,
  logo_url                text,
  subdomain               varchar     UNIQUE,
  custom_domain           varchar,
  theme_primary_color     varchar     DEFAULT '#2563EB',
  theme_secondary_color   varchar     DEFAULT '#F59E0B',
  is_active               boolean     DEFAULT true,
  subscription_plan       varchar     DEFAULT 'trial',
  subscription_expires_at timestamptz,
  slogan                  varchar,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- ── USERS (system login accounts) ────────────────────────────
-- People who can log in to the management system.
-- The owner creates these accounts and assigns roles.
-- Roles: owner, admin, manager, cashier, viewer
-- NOTE: These are NOT the same as bar employees (see staff table below).
CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id      uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name          varchar     NOT NULL,
  phone         varchar     NOT NULL,
  email         varchar,
  role          varchar     DEFAULT 'cashier',
  is_active     boolean     DEFAULT true,
  pin_hash      varchar,
  password_hash varchar,
  last_login    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_salon_phone
  ON users(salon_id, phone);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_salon_email
  ON users(salon_id, email)
  WHERE email IS NOT NULL;

-- ── SESSIONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  salon_id   uuid        NOT NULL REFERENCES salons(id)  ON DELETE CASCADE,
  token      varchar     NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- ── STAFF (bar employees) ─────────────────────────────────────
-- The people who physically work at the bar: bartenders, servers,
-- security, cleaners, etc. Most do NOT have system login access.
-- user_id is optional — only set when an employee also has a login.
CREATE TABLE IF NOT EXISTS staff (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id      uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name          varchar     NOT NULL,
  phone         varchar,
  email         varchar,
  job_title     varchar     NOT NULL DEFAULT 'Bartender',
  hire_date     date,
  hourly_rate   numeric(12,2),
  commission_rate numeric(12,2),
  is_active     boolean     NOT NULL DEFAULT true,
  notes         text,
  user_id       uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_salon    ON staff(salon_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_staff_user     ON staff(user_id);

-- ── CLIENTS (customers) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name           varchar     NOT NULL,
  phone          varchar     NOT NULL,
  email          varchar,
  birthday       date,
  loyalty_points integer     DEFAULT 0,
  total_visits   integer     DEFAULT 0,
  total_spent    numeric     DEFAULT 0,
  last_visit     timestamptz,
  notes          text,
  is_active      boolean     DEFAULT true,
  deleted_at     timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(salon_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_clients_salon
  ON clients(salon_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- ── SERVICES (menu items) ─────────────────────────────────────
-- Drinks, food, mixers, packages — anything sold at the bar.
CREATE TABLE IF NOT EXISTS services (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar     NOT NULL,
  description text,
  price       numeric     NOT NULL,
  category    varchar,
  category_id uuid,
  is_active   boolean     DEFAULT true,
  deleted_at  timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_salon
  ON services(salon_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- ── SERVICE CATEGORIES (drink/product categories) ─────────────
CREATE TABLE IF NOT EXISTS service_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar     NOT NULL,
  description text,
  color       varchar     DEFAULT '#6366f1',
  icon        varchar,
  sort_order  integer     DEFAULT 0,
  is_active   boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE(salon_id, name)
);

ALTER TABLE services
  ADD CONSTRAINT services_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL;

-- ── VISITS (orders / transactions) ───────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid        NOT NULL REFERENCES salons(id)  ON DELETE CASCADE,
  client_id       uuid        NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  user_id         uuid        REFERENCES users(id)            ON DELETE SET NULL,
  receipt_number  varchar     NOT NULL UNIQUE,
  total_amount    numeric     NOT NULL,
  payment_method  varchar     NOT NULL,
  payment_status  varchar     DEFAULT 'pending',
  transaction_id  varchar,
  points_earned   integer     DEFAULT 0,
  points_redeemed integer     DEFAULT 0,
  notes           text,
  is_active       boolean     NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  deleted_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  status          varchar     DEFAULT 'completed',
  recorded_at     timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_salon_date
  ON visits(salon_id, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_visits_client
  ON visits(client_id, created_at DESC);

-- ── VISIT SERVICES (order line items) ────────────────────────
CREATE TABLE IF NOT EXISTS visit_services (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id        uuid        NOT NULL REFERENCES visits(id)   ON DELETE CASCADE,
  service_id      uuid        NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  quantity        integer     DEFAULT 1,
  price           numeric     NOT NULL,
  unit_price      numeric     NOT NULL,
  original_price  numeric,
  discount_amount numeric     NOT NULL DEFAULT 0,
  discounted_by   uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_services_visit ON visit_services(visit_id);

-- ── SERVICE ADD-ONS (extras — mixers, sides, etc.) ───────────
CREATE TABLE IF NOT EXISTS service_addons (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar       NOT NULL,
  price       numeric(12,0) NOT NULL DEFAULT 0 CHECK (price >= 0),
  description text,
  is_active   boolean       DEFAULT true,
  sort_order  integer       DEFAULT 0,
  created_at  timestamptz   DEFAULT now(),
  updated_at  timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visit_addons (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      uuid          NOT NULL REFERENCES visits(id)         ON DELETE CASCADE,
  addon_id      uuid          NOT NULL REFERENCES service_addons(id) ON DELETE RESTRICT,
  salon_id      uuid          NOT NULL REFERENCES salons(id)         ON DELETE CASCADE,
  quantity      integer       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_at_time numeric(12,0) NOT NULL,
  created_at    timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_addons_visit ON visit_addons(visit_id);

-- ── EXPENSES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id       uuid          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category       varchar       NOT NULL DEFAULT 'General',
  amount         numeric(12,2) NOT NULL CHECK (amount >= 0),
  description    text,
  expense_date   date          NOT NULL DEFAULT CURRENT_DATE,
  payment_method varchar       NOT NULL DEFAULT 'cash',
  created_by     uuid          REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_expenses_salon_date
  ON expenses(salon_id, expense_date)
  WHERE deleted_at IS NULL;

-- ── INVENTORY ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name        varchar     NOT NULL,
  description text,
  color       varchar     NOT NULL DEFAULT '#6366f1',
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salon_id, name)
);

CREATE TABLE IF NOT EXISTS stock_items (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id      uuid          NOT NULL REFERENCES salons(id)   ON DELETE CASCADE,
  group_id      uuid          REFERENCES stock_groups(id)      ON DELETE SET NULL,
  name          varchar       NOT NULL,
  description   text,
  unit          varchar       NOT NULL DEFAULT 'bottle',
  current_qty   numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  cost_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  is_active     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  UNIQUE(salon_id, name)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid          NOT NULL REFERENCES salons(id)      ON DELETE CASCADE,
  item_id    uuid          NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  qty_change numeric(12,2) NOT NULL,
  qty_after  numeric(12,2) NOT NULL,
  reason     varchar       NOT NULL DEFAULT 'adjustment',
  notes      text,
  created_by uuid          REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item  ON stock_movements(item_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_salon ON stock_movements(salon_id, created_at DESC);

-- ── ACCOUNTS & CASH FLOW ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid    NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name       varchar NOT NULL,
  type       varchar NOT NULL CHECK (type IN ('cash','mtn_mobile_money','airtel_money','bank','expense')),
  is_system  boolean DEFAULT false,
  is_active  boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, name)
);

CREATE TABLE IF NOT EXISTS account_transactions (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id         uuid          NOT NULL REFERENCES salons(id)   ON DELETE CASCADE,
  account_id       uuid          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount           numeric(14,0) NOT NULL CHECK (amount > 0),
  direction        varchar       NOT NULL CHECK (direction IN ('in','out')),
  description      text,
  reference_type   varchar,
  reference_id     uuid,
  recorded_by      uuid          REFERENCES users(id) ON DELETE SET NULL,
  transaction_date date          NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz   DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS account_txn_visit_idx
  ON account_transactions(salon_id, reference_id)
  WHERE reference_type = 'visit';

CREATE TABLE IF NOT EXISTS staff_advances (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid          NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id    uuid          NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  amount      numeric(14,0) NOT NULL CHECK (amount > 0),
  reason      text,
  status      varchar       DEFAULT 'pending' CHECK (status IN ('pending','deducted','cancelled')),
  given_by    uuid          REFERENCES users(id) ON DELETE SET NULL,
  deducted_at timestamptz,
  created_at  timestamptz   DEFAULT now()
);

-- Account balances view
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id, a.salon_id, a.name, a.type, a.is_system, a.is_active, a.sort_order,
  COALESCE(
    SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END), 0
  )::bigint AS balance
FROM accounts a
LEFT JOIN account_transactions t ON t.account_id = a.id
GROUP BY a.id;

-- ── DEFAULT ACCOUNTS (run once per bar after creation) ────────
-- INSERT INTO accounts (salon_id, name, type, is_system, sort_order) VALUES
--   ('${bar_id}', 'Cash',             'cash',             true, 1),
--   ('${bar_id}', 'MTN Mobile Money', 'mtn_mobile_money', true, 2),
--   ('${bar_id}', 'Airtel Money',     'airtel_money',     true, 3);
