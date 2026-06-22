-- ════════════════════════════════════════════════════════════════════════
-- Ensure admin + supervisor can correct attendance records
-- ════════════════════════════════════════════════════════════════════════
-- Re-asserts the UPDATE policy cleanly. Debugging showed supervisors were
-- unable to update check-in/out. This consolidates the policy and ensures
-- the correction-audit columns exist.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Ensure correction audit columns exist (in case prior migration partial)
ALTER TABLE public.job_attendance
  ADD COLUMN IF NOT EXISTS corrected_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS corrected_from  JSONB,
  ADD COLUMN IF NOT EXISTS correction_note TEXT;

-- 2. Ensure GPS + status columns exist
ALTER TABLE public.job_attendance
  ADD COLUMN IF NOT EXISTS checkin_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_latitude   DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS checkin_longitude  DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS checkout_latitude  DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS checkout_longitude DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS location_missing   BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Drop ALL existing UPDATE policies that might conflict, then re-create clean
DROP POLICY IF EXISTS "attendance_supervisor_admin_correct" ON public.job_attendance;
DROP POLICY IF EXISTS "attendance_admin_supervisor_all"     ON public.job_attendance;

-- 4. Admin + supervisor: full access (SELECT/INSERT/UPDATE/DELETE)
CREATE POLICY "attendance_admin_supervisor_all" ON public.job_attendance
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

-- 5. Verify the sync trigger exists (recreate to be safe)
CREATE OR REPLACE FUNCTION public.sync_attendance_checkinout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checkin_at IS NOT NULL THEN
    NEW.in_time := NEW.checkin_at::time;
  END IF;
  IF NEW.checkout_at IS NOT NULL THEN
    NEW.out_time := NEW.checkout_at::time;
  END IF;

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
