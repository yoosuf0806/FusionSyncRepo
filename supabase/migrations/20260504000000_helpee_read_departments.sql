-- ════════════════════════════════════════════════════════════════════════
-- Allow helpees to read departments (to pick a service when creating a job)
-- ════════════════════════════════════════════════════════════════════════
-- The department LOV on the job form needs every job creator to read the
-- departments list. The existing policy only allowed supervisor + helper, so
-- helpees saw an empty department dropdown. Add helpee to the read policy.
-- ════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "departments_others_select" ON public.departments;
CREATE POLICY "departments_others_select" ON public.departments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() IN ('supervisor','helper','helpee'));
