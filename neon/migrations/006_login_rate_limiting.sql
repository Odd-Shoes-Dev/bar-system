-- Migration 006: Login rate limiting via account lockout
-- Adds failed_attempts counter and locked_until timestamp to staff table.
-- No third-party required — enforced entirely in application logic using the existing DB.
--
-- Rules (enforced in src/lib/auth.ts):
--   • 5 failed attempts  → locked for 15 minutes
--   • Successful login   → resets both columns to 0 / NULL
-- Run this in the Neon SQL Editor once.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_attempts  INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until     TIMESTAMPTZ  NULL;

-- Index so the lockout check (locked_until > NOW()) is fast
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users (locked_until)
  WHERE locked_until IS NOT NULL;
