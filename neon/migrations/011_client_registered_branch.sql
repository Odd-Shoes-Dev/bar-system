-- Migration 011: Track which branch first registered each client
-- Permanent origin record — never changes after creation.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS registered_at_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Back-fill: use the branch_id of the client's earliest visit, if any
UPDATE clients c
SET registered_at_branch_id = (
  SELECT v.branch_id
  FROM   visits v
  WHERE  v.client_id = c.id
    AND  v.is_active  = true
    AND  v.branch_id IS NOT NULL
  ORDER  BY v.created_at ASC
  LIMIT  1
)
WHERE c.registered_at_branch_id IS NULL;

-- For any still-null clients (no visits yet), fall back to the salon's first active branch
UPDATE clients c
SET registered_at_branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id    = c.salon_id
    AND  b.deleted_at IS NULL
  ORDER  BY b.created_at ASC
  LIMIT  1
)
WHERE c.registered_at_branch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_registered_branch
  ON clients(registered_at_branch_id);
