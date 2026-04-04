-- =====================================================================
-- Fix: helpee job creation + remark upsert RLS
--
-- 1. Re-apply helpee job creation policies (in case 20260404 was not run)
-- 2. Add missing helpee SELECT on job_remarks (PostgREST upsert needs it)
-- 3. Confirm helper SELECT on job_remarks (was already in initial schema)
-- 4. Add helpee SELECT on job_remarks (was missing from initial schema)
--
-- Run in Supabase Dashboard → SQL Editor
-- =====================================================================

-- ── 1. Helpee: insert own job request ────────────────────────────────
DROP POLICY IF EXISTS "jobs_helpee_insert_own" ON public.jobs;
CREATE POLICY "jobs_helpee_insert_own"
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helpee'
    AND job_requester_id = public.auth_user_id()
  );

-- ── 2. Helpee: add self to job_associated_users on own job ────────────
DROP POLICY IF EXISTS "jau_helpee_insert_self_on_own_job" ON public.job_associated_users;
CREATE POLICY "jau_helpee_insert_self_on_own_job"
  ON public.job_associated_users FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helpee'
    AND user_id = public.auth_user_id()
    AND role = 'helpee'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_associated_users.job_id
        AND j.job_requester_id = public.auth_user_id()
    )
  );

-- ── 3. Helpee: insert question answers for own job ────────────────────
DROP POLICY IF EXISTS "jqa_helpee_insert_own_job" ON public.job_question_answers;
CREATE POLICY "jqa_helpee_insert_own_job"
  ON public.job_question_answers FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helpee'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_question_answers.job_id
        AND j.job_requester_id = public.auth_user_id()
    )
  );

-- ── 4. Helpee: SELECT own remarks (missing from initial schema) ───────
--    Required by PostgREST upsert RETURNING clause.
DROP POLICY IF EXISTS "remarks_helpee_select_own" ON public.job_remarks;
CREATE POLICY "remarks_helpee_select_own"
  ON public.job_remarks FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND helpee_id = public.auth_user_id()
  );

-- ── 5. Re-confirm helpee INSERT on remarks (safe re-create) ──────────
DROP POLICY IF EXISTS "remarks_helpee_insert_own" ON public.job_remarks;
CREATE POLICY "remarks_helpee_insert_own"
  ON public.job_remarks FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helpee'
    AND helpee_id = public.auth_user_id()
  );

-- ── 6. Re-confirm helpee UPDATE on remarks ────────────────────────────
DROP POLICY IF EXISTS "remarks_helpee_update_own" ON public.job_remarks;
CREATE POLICY "remarks_helpee_update_own"
  ON public.job_remarks FOR UPDATE TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND helpee_id = public.auth_user_id()
  )
  WITH CHECK (
    public.auth_user_type() = 'helpee'
    AND helpee_id = public.auth_user_id()
  );

-- ── 7. Confirm helper SELECT on job_remarks (was in initial schema) ───
DROP POLICY IF EXISTS "remarks_helper_select" ON public.job_remarks;
CREATE POLICY "remarks_helper_select"
  ON public.job_remarks FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users jau
      WHERE jau.job_id = job_remarks.job_id
        AND jau.user_id = public.auth_user_id()
    )
  );

-- ── 8. Helper: confirm SELECT on assigned jobs ────────────────────────
--    (Already in initial schema; re-creating ensures it's active)
DROP POLICY IF EXISTS "jobs_helper_select_assigned" ON public.jobs;
CREATE POLICY "jobs_helper_select_assigned"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = jobs.id AND user_id = public.auth_user_id()
    )
  );
