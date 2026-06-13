-- Migration 010: Add last_visit_branch_id to clients
-- Tracks which branch a client last visited so the clients list
-- can show "Last Visit · Branch Name" in a single column.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_visit_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Back-fill: resolve the most recent visit's branch_id for every existing client
UPDATE clients c
SET last_visit_branch_id = (
  SELECT v.branch_id
  FROM   visits v
  WHERE  v.client_id = c.id
    AND  v.is_active  = true
    AND  v.branch_id IS NOT NULL
  ORDER  BY v.created_at DESC
  LIMIT  1
)
WHERE c.last_visit_branch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_last_visit_branch
  ON clients(last_visit_branch_id);
