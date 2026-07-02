-- Per-job task checklists ("post orders" pushed to workers).
-- Additive only — safe to run on the live database.

CREATE TABLE IF NOT EXISTS public.job_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_done    BOOLEAN     NOT NULL DEFAULT false,
  done_by    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  done_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_tasks_job_id ON public.job_tasks(job_id);

ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;

-- Admin + supervisor: full manage
DROP POLICY IF EXISTS "job_tasks_admin_supervisor_all" ON public.job_tasks;
CREATE POLICY "job_tasks_admin_supervisor_all" ON public.job_tasks
  FOR ALL USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

-- Associated users (helper/helpee) + job requester: read tasks for their jobs
DROP POLICY IF EXISTS "job_tasks_associated_select" ON public.job_tasks;
CREATE POLICY "job_tasks_associated_select" ON public.job_tasks
  FOR SELECT USING (
    job_id IN (SELECT job_id FROM public.job_associated_users WHERE user_id = public.auth_user_id())
    OR job_id IN (SELECT id FROM public.jobs WHERE job_requester_id = public.auth_user_id())
  );

-- Helpers assigned to the job: tick tasks off (row-level; app exposes only the checkbox)
DROP POLICY IF EXISTS "job_tasks_helper_update" ON public.job_tasks;
CREATE POLICY "job_tasks_helper_update" ON public.job_tasks
  FOR UPDATE USING (
    job_id IN (SELECT job_id FROM public.job_associated_users WHERE user_id = public.auth_user_id() AND role = 'helper')
  ) WITH CHECK (
    job_id IN (SELECT job_id FROM public.job_associated_users WHERE user_id = public.auth_user_id() AND role = 'helper')
  );
