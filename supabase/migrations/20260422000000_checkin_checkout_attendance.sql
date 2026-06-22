-- ════════════════════════════════════════════════════════════════════════
-- Phase 3: Per-job check-in/out attendance (approval removed)
-- ════════════════════════════════════════════════════════════════════════
-- Reshapes job_attendance for the new model:
--   • No approval workflow — system-captured tap is the trusted record
--   • Backend auto-captures date, time, GPS location (non-editable by worker)
--   • Location denied → check-in still allowed, location null, row flagged
--   • Supervisor + Admin can correct records, with audit trail
--   • att_status repurposed: 'not_started' | 'checked_in' | 'completed'
--   • Invoicing stays schedule-based; these hours are informational only
-- ════════════════════════════════════════════════════════════════════════

-- 1. Add GPS location columns for check-in and check-out
ALTER TABLE public.job_attendance
  ADD COLUMN IF NOT EXISTS checkin_latitude   DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS checkin_longitude  DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS checkout_latitude  DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS checkout_longitude DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS location_missing   BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add full timestamp columns (not just TIME) so date+time captured precisely.
--    Existing in_time/out_time (TIME) retained for backward-compat display.
ALTER TABLE public.job_attendance
  ADD COLUMN IF NOT EXISTS checkin_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_at TIMESTAMPTZ;

-- 3. Add correction audit columns (who corrected, when, and why).
--    Original values are preserved in corrected_from (JSONB snapshot).
ALTER TABLE public.job_attendance
  ADD COLUMN IF NOT EXISTS corrected_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS corrected_from  JSONB,
  ADD COLUMN IF NOT EXISTS correction_note TEXT;

-- 4. Repurpose att_status for the new lifecycle (no approval states).
--    Drop the old approval-based check constraint, add the new one.
ALTER TABLE public.job_attendance
  DROP CONSTRAINT IF EXISTS job_attendance_att_status_check;

-- Migrate any existing approval-state rows to the new vocabulary first
UPDATE public.job_attendance
  SET att_status = CASE
    WHEN in_time IS NOT NULL AND out_time IS NOT NULL THEN 'completed'
    WHEN in_time IS NOT NULL AND out_time IS NULL     THEN 'checked_in'
    ELSE 'not_started'
  END
  WHERE att_status IN ('pending_approval','approved','rejected','resubmitted')
     OR att_status IS NULL;

ALTER TABLE public.job_attendance
  ALTER COLUMN att_status SET DEFAULT 'not_started';

ALTER TABLE public.job_attendance
  ADD CONSTRAINT job_attendance_att_status_check
    CHECK (att_status IN ('not_started','checked_in','completed'));

-- 5. Trigger: keep att_status and total_hours in sync from check-in/out timestamps.
--    Replaces approval-driven logic. total_hours derived from checkin_at/checkout_at.
CREATE OR REPLACE FUNCTION public.sync_attendance_checkinout()
RETURNS TRIGGER AS $$
BEGIN
  -- Mirror timestamp → TIME columns for existing displays
  IF NEW.checkin_at IS NOT NULL THEN
    NEW.in_time := NEW.checkin_at::time;
  END IF;
  IF NEW.checkout_at IS NOT NULL THEN
    NEW.out_time := NEW.checkout_at::time;
  END IF;

  -- Derive status
  IF NEW.checkin_at IS NOT NULL AND NEW.checkout_at IS NOT NULL THEN
    NEW.att_status := 'completed';
    NEW.total_hours := ROUND(
      EXTRACT(EPOCH FROM (NEW.checkout_at - NEW.checkin_at)) / 3600.0, 2);
  ELSIF NEW.checkin_at IS NOT NULL THEN
    NEW.att_status := 'checked_in';
    NEW.total_hours := NULL;
  ELSE
    NEW.att_status := 'not_started';
    NEW.total_hours := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_attendance_checkinout ON public.job_attendance;
CREATE TRIGGER trg_sync_attendance_checkinout
  BEFORE INSERT OR UPDATE OF checkin_at, checkout_at ON public.job_attendance
  FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_checkinout();

-- 6. RLS: allow supervisor + admin to UPDATE (correct) any attendance row.
DROP POLICY IF EXISTS "attendance_supervisor_admin_correct" ON public.job_attendance;
CREATE POLICY "attendance_supervisor_admin_correct" ON public.job_attendance
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

-- 7. Index for date-scoped "today's jobs" lookups per helper
CREATE INDEX IF NOT EXISTS idx_attendance_helper_date
  ON public.job_attendance(helper_id, attendance_date);
