-- ============================================================
-- Migration 014: Rename salons → bars, salon_id → bar_id
-- ============================================================
-- Safe to run once on the live DB.
-- All FK constraints, indexes, and unique constraints are
-- updated automatically by PostgreSQL when a column is renamed.
-- The account_balances view is dropped and recreated because
-- it references the column by name.
-- ============================================================

-- 1. Drop the view that references salon_id by name
DROP VIEW IF EXISTS account_balances;

-- 2. Rename the main table
ALTER TABLE salons RENAME TO bars;

-- 3. Rename salon_id → bar_id on every table (FKs update automatically)
ALTER TABLE bars                  RENAME COLUMN salon_id TO bar_id;
ALTER TABLE users                 RENAME COLUMN salon_id TO bar_id;
ALTER TABLE sessions              RENAME COLUMN salon_id TO bar_id;
ALTER TABLE staff                 RENAME COLUMN salon_id TO bar_id;
ALTER TABLE clients               RENAME COLUMN salon_id TO bar_id;
ALTER TABLE services              RENAME COLUMN salon_id TO bar_id;
ALTER TABLE service_categories    RENAME COLUMN salon_id TO bar_id;
ALTER TABLE visits                RENAME COLUMN salon_id TO bar_id;
ALTER TABLE service_addons        RENAME COLUMN salon_id TO bar_id;
ALTER TABLE visit_addons          RENAME COLUMN salon_id TO bar_id;
ALTER TABLE expenses              RENAME COLUMN salon_id TO bar_id;
ALTER TABLE stock_groups          RENAME COLUMN salon_id TO bar_id;
ALTER TABLE stock_items           RENAME COLUMN salon_id TO bar_id;
ALTER TABLE stock_movements       RENAME COLUMN salon_id TO bar_id;
ALTER TABLE accounts              RENAME COLUMN salon_id TO bar_id;
ALTER TABLE account_transactions  RENAME COLUMN salon_id TO bar_id;
ALTER TABLE staff_advances        RENAME COLUMN salon_id TO bar_id;
ALTER TABLE staff_performance     RENAME COLUMN salon_id TO bar_id;
ALTER TABLE suppliers             RENAME COLUMN salon_id TO bar_id;
ALTER TABLE purchase_orders       RENAME COLUMN salon_id TO bar_id;
ALTER TABLE staff_shifts          RENAME COLUMN salon_id TO bar_id;
ALTER TABLE bar_tables            RENAME COLUMN salon_id TO bar_id;
ALTER TABLE branches              RENAME COLUMN salon_id TO bar_id;
ALTER TABLE branch_audit_logs     RENAME COLUMN salon_id TO bar_id;
ALTER TABLE stocktakes            RENAME COLUMN salon_id TO bar_id;
ALTER TABLE variance_reasons      RENAME COLUMN salon_id TO bar_id;

-- 4. Recreate account_balances view with updated column name
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id, a.bar_id, a.name, a.type, a.is_system, a.is_active, a.sort_order,
  COALESCE(
    SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END), 0
  )::bigint AS balance
FROM accounts a
LEFT JOIN account_transactions t ON t.account_id = a.id
GROUP BY a.id;
