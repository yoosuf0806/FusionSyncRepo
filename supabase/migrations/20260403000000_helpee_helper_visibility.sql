-- =====================================================================
-- Helpee: see all job_associated_users on their jobs + job spec names
-- Helper/Helpee: read user profiles of coworkers on shared jobs
-- Jobs: optional job_notes for requester remark (UI)
-- Run in Supabase SQL Editor after prior migrations.
-- =====================================================================

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_notes TEXT;

-- Helpee can read all job_associated_users rows for jobs they are on (like helpers)
CREATE OR REPLACE FUNCTION public.is_helpee_for_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_associated_users jau
    WHERE jau.job_id = p_job_id
      AND jau.user_id = public.auth_user_id()
      AND jau.role = 'helpee'
  );
$$;

REVOKE ALL ON FUNCTION public.is_helpee_for_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_helpee_for_job(uuid) TO authenticated;

DROP POLICY IF EXISTS "helpees_view_all_job_associated_users" ON public.job_associated_users;
CREATE POLICY "helpees_view_all_job_associated_users"
  ON public.job_associated_users FOR SELECT TO authenticated
  USING (public.is_helpee_for_job(job_id));

-- Coworkers on the same job can see each other's user row (for names on job screen)
CREATE OR REPLACE FUNCTION public.shares_job_with(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_associated_users a
    JOIN public.job_associated_users b ON a.job_id = b.job_id
    WHERE a.user_id = public.auth_user_id()
      AND b.user_id = p_other_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.shares_job_with(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shares_job_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "users_select_job_coworkers" ON public.users;
CREATE POLICY "users_select_job_coworkers"
  ON public.users FOR SELECT TO authenticated
  USING (public.shares_job_with(id));

-- Helpee (and any job participant) can read job_specifications for types used on their jobs
DROP POLICY IF EXISTS "job_specs_participant_select" ON public.job_specifications;
CREATE POLICY "job_specs_participant_select"
  ON public.job_specifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      INNER JOIN public.job_associated_users jau ON jau.job_id = j.id
      WHERE j.job_type_id = job_specifications.id
        AND jau.user_id = public.auth_user_id()
    )
  );
