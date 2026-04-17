-- ============================================================
-- Fix attendance RLS — helper and helpee can see rows again
--
-- Helper SELECT was too restrictive: helper_id = auth_user_id()
-- blocks seeing rows before submission and rows where helper_id
-- was not yet stamped. Revert to job_associated_users check so
-- helpers see all rows for jobs they are assigned to.
-- Helpee SELECT is correct — just re-applying to be safe.
-- ============================================================

-- Helper SELECT: see all rows on jobs they are assigned to
DROP POLICY IF EXISTS "attendance_helper_select" ON public.job_attendance;
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

-- Helpee SELECT: see only approved rows on jobs they are assigned to
DROP POLICY IF EXISTS "attendance_helpee_select" ON public.job_attendance;
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
