-- ============================================================
-- Add SELECT policy for helper on job_attendance.
--
-- Helpers had INSERT and UPDATE policies but no SELECT policy,
-- so getAttendanceForJob() returned an empty array for them —
-- attendance rows they inserted were invisible on reload.
--
-- Also add SELECT for helpee so they can view their own
-- attendance records in read-only mode.
-- ============================================================

CREATE POLICY "attendance_helper_select" ON public.job_attendance
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_attendance.job_id
        AND user_id = public.auth_user_id()
    )
  );

CREATE POLICY "attendance_helpee_select" ON public.job_attendance
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_attendance.job_id
        AND user_id = public.auth_user_id()
    )
  );
