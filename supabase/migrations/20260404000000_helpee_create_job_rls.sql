-- =====================================================================
-- Allow helpees to create job requests (insert job, self on jau, answers)
-- Run in Supabase SQL Editor if helpees cannot save new jobs.
-- =====================================================================

DROP POLICY IF EXISTS "jobs_helpee_insert_own" ON public.jobs;
CREATE POLICY "jobs_helpee_insert_own"
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helpee'
    AND job_requester_id = public.auth_user_id()
  );

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
