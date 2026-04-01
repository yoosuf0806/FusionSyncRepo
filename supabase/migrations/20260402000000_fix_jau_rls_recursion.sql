-- =====================================================================
-- Fix: infinite recursion on job_associated_users RLS
-- Run this in Supabase SQL Editor if you see:
--   "infinite recursion detected in policy for relation job_associated_users"
--
-- Cause: a SELECT policy on job_associated_users used a subquery that
-- SELECTs from job_associated_users again → RLS re-enters forever.
--
-- Fix: check helper assignment in SECURITY DEFINER (bypasses RLS on that read).
-- =====================================================================

-- Remove broken / old helper policies (safe if missing)
DROP POLICY IF EXISTS "helpers_view_all_job_associated_users" ON public.job_associated_users;
DROP POLICY IF EXISTS "helpers_view_job_question_answers" ON public.job_question_answers;
DROP POLICY IF EXISTS "helpers_update_job_status" ON public.jobs;

CREATE OR REPLACE FUNCTION public.is_helper_for_job(p_job_id uuid)
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
      AND jau.role = 'helper'
  );
$$;

REVOKE ALL ON FUNCTION public.is_helper_for_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_helper_for_job(uuid) TO authenticated;

-- Helpers may read every job_associated_users row for jobs they work on
CREATE POLICY "helpers_view_all_job_associated_users"
  ON public.job_associated_users
  FOR SELECT TO authenticated
  USING (public.is_helper_for_job(job_id));

-- Extra helper read on answers (if you rely on this policy; base schema may already allow)
CREATE POLICY "helpers_view_job_question_answers"
  ON public.job_question_answers
  FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'helper' AND public.is_helper_for_job(job_id));

-- Helper job status updates (alongside existing jobs_helper_update_assigned if present)
CREATE POLICY "helpers_update_job_status"
  ON public.jobs
  FOR UPDATE TO authenticated
  USING (public.auth_user_type() = 'helper' AND public.is_helper_for_job(id))
  WITH CHECK (public.auth_user_type() = 'helper' AND public.is_helper_for_job(id));
