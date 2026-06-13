-- ============================================================
-- Migration 008: Multi-Branch Support
-- ============================================================

-- 1. Branches table
CREATE TABLE IF NOT EXISTS branches (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid        NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name       varchar     NOT NULL,
  address    text,
  phone      varchar,
  email      varchar,
  is_active  boolean     NOT NULL DEFAULT true,
  deleted_at timestamptz,
  deleted_by uuid,       -- FK added at end of this file
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salon_id, name)
);

-- 2. Seed a default "Main Branch" for every existing bar
INSERT INTO branches (salon_id, name, created_at, updated_at)
SELECT id, 'Main Branch', now(), now()
FROM   salons
ON CONFLICT DO NOTHING;

-- 3. Add branch_id to users (owner keeps NULL = all-access)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

UPDATE users u
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = u.salon_id AND b.name = 'Main Branch'
  LIMIT  1
)
WHERE  u.role <> 'owner';

-- 4. Add branch_id to sessions for fast branch resolution per request
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

-- 5. Add branch_id to staff (employees)
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

UPDATE staff s
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = s.salon_id AND b.name = 'Main Branch'
  LIMIT  1
);

-- 6. Add branch_id to visits
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

UPDATE visits v
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = v.salon_id AND b.name = 'Main Branch'
  LIMIT  1
);

-- 7. Add branch_id to expenses
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

UPDATE expenses e
SET    branch_id = (
  SELECT b.id FROM branches b
  WHERE  b.salon_id = e.salon_id AND b.name = 'Main Branch'
  LIMIT  1
);

-- 8. Add branch_id to staff_shifts (created in 004)
ALTER TABLE staff_shifts
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

-- 9. Audit log for all branch-scoped actions
CREATE TABLE IF NOT EXISTS branch_audit_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id   uuid        NOT NULL REFERENCES salons(id),
  branch_id  uuid        REFERENCES branches(id),
  user_id    uuid        REFERENCES users(id),
  action     varchar     NOT NULL,
  table_name varchar,
  record_id  uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address varchar,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Add FK from branches.deleted_by → users(id)
ALTER TABLE branches
  ADD CONSTRAINT branches_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

-- 11. Indexes
CREATE INDEX IF NOT EXISTS idx_branches_salon   ON branches(salon_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_branch     ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_branch     ON staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_visits_branch    ON visits(branch_id)       WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_expenses_branch  ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_shifts_branch    ON staff_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON branch_audit_logs(salon_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_branch  ON sessions(branch_id);
