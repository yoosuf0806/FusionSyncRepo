-- ============================================================
-- Add SELECT policy for helpee on job_remarks.
-- Helpee had INSERT + UPDATE but no SELECT — so getJobById
-- returned null for remark even when one existed, causing the
-- lock logic to think no remark was submitted yet.
-- ============================================================

CREATE POLICY "remarks_helpee_select_own" ON public.job_remarks
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND helpee_id = public.auth_user_id()
  );
