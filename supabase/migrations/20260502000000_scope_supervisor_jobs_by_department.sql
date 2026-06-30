-- ════════════════════════════════════════════════════════════════════════
-- Scope supervisors to their own department for jobs
-- ════════════════════════════════════════════════════════════════════════
-- A supervisor manages one department. They should see and act on jobs in
-- their department only (including unassigned ones), not every job in the
-- system. Admins remain unrestricted. UI filtering alone isn't security —
-- this enforces it at the row level.
-- ════════════════════════════════════════════════════════════════════════

-- Helper: the current auth user's department_id
CREATE OR REPLACE FUNCTION public.auth_user_department()
RETURNS UUID AS $$
  SELECT department_id FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Re-scope the supervisor SELECT policy to their department
DROP POLICY IF EXISTS "jobs_supervisor_select" ON public.jobs;
CREATE POLICY "jobs_supervisor_select" ON public.jobs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'supervisor'
    AND department_id = public.auth_user_department()
  );

-- Re-scope the supervisor UPDATE policy to their department
DROP POLICY IF EXISTS "jobs_supervisor_update" ON public.jobs;
CREATE POLICY "jobs_supervisor_update" ON public.jobs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.auth_user_type() = 'supervisor'
    AND department_id = public.auth_user_department()
  )
  WITH CHECK (
    public.auth_user_type() = 'supervisor'
    AND department_id = public.auth_user_department()
  );

-- INSERT: a supervisor may only create jobs in their own department
DROP POLICY IF EXISTS "jobs_supervisor_insert" ON public.jobs;
CREATE POLICY "jobs_supervisor_insert" ON public.jobs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'supervisor'
    AND department_id = public.auth_user_department()
  );
