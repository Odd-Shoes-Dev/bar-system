-- ============================================================
-- 004 – STAFF SHIFTS
-- Run after 003_add_booking_tables.sql
-- Tracks which staff worked which shifts, for payroll and
-- accountability on sales recorded during a shift.
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_shifts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid        NOT NULL REFERENCES salons(id)  ON DELETE CASCADE,
  staff_id    uuid        NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  shift_date  date        NOT NULL,
  start_time  time        NOT NULL,
  end_time    time,
  -- status: scheduled, active (clocked in), completed, absent
  status      varchar     NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled','active','completed','absent')),
  clocked_in_at  timestamptz,
  clocked_out_at timestamptz,
  notes       text,
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, shift_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_salon
  ON staff_shifts(salon_id, shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff
  ON staff_shifts(staff_id, shift_date DESC);

CREATE TRIGGER update_staff_shifts_updated_at
  BEFORE UPDATE ON staff_shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
