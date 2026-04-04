-- =====================================================================
-- Helpee: read active job types + spec questions when creating a job.
-- Revoke helper job creation (only helpee / admin / supervisor create jobs).
-- =====================================================================

-- Full catalog of active job types for helpees (create-job form)
DROP POLICY IF EXISTS "job_specs_helpee_select_catalog" ON public.job_specifications;
CREATE POLICY "job_specs_helpee_select_catalog"
  ON public.job_specifications FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND is_active IS TRUE
  );

-- Questions for selected job type (create flow)
DROP POLICY IF EXISTS "job_spec_q_helpee_select" ON public.job_spec_questions;
CREATE POLICY "job_spec_q_helpee_select"
  ON public.job_spec_questions FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'helpee');

-- Remove helper-owned job creation policies
DROP POLICY IF EXISTS "jobs_helper_insert_own" ON public.jobs;
DROP POLICY IF EXISTS "jau_helper_insert_self_helper_on_own_job" ON public.job_associated_users;
DROP POLICY IF EXISTS "jqa_helper_insert_own_requester_job" ON public.job_question_answers;
