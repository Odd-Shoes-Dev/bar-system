-- Migration 016: Seed default system accounts for bars that don't have them,
-- then backfill account_transactions for visits that were recorded before accounts existed.
-- Safe to re-run: all inserts use WHERE NOT EXISTS / ON CONFLICT guards.

-- Step 1: Create missing system accounts
INSERT INTO accounts (bar_id, name, type, is_system, sort_order)
SELECT b.id, 'Cash', 'cash', true, 1
FROM bars b
WHERE NOT EXISTS (
  SELECT 1 FROM accounts a WHERE a.bar_id = b.id AND a.type = 'cash' AND a.is_system = true
);

INSERT INTO accounts (bar_id, name, type, is_system, sort_order)
SELECT b.id, 'MTN Mobile Money', 'mtn_mobile_money', true, 2
FROM bars b
WHERE NOT EXISTS (
  SELECT 1 FROM accounts a WHERE a.bar_id = b.id AND a.type = 'mtn_mobile_money' AND a.is_system = true
);

INSERT INTO accounts (bar_id, name, type, is_system, sort_order)
SELECT b.id, 'Airtel Money', 'airtel_money', true, 3
FROM bars b
WHERE NOT EXISTS (
  SELECT 1 FROM accounts a WHERE a.bar_id = b.id AND a.type = 'airtel_money' AND a.is_system = true
);

-- Step 2: Backfill account_transactions for visits that were never recorded
-- (visits whose payment_method matches a system account but have no account_transaction entry)
INSERT INTO account_transactions (bar_id, account_id, amount, direction, description, reference_type, reference_id, transaction_date)
SELECT
  v.bar_id,
  a.id,
  COALESCE(v.amount_paid, v.total_amount),
  'in',
  'Receipt ' || v.receipt_number,
  'visit',
  v.id,
  v.created_at::date
FROM visits v
JOIN accounts a ON a.bar_id = v.bar_id AND a.type = v.payment_method AND a.is_system = true
WHERE v.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM account_transactions t
    WHERE t.reference_type = 'visit' AND t.reference_id = v.id
  );
