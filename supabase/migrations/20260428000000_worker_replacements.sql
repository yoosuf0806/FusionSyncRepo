-- ════════════════════════════════════════════════════════════════════════
-- Direct worker replacement on a running job (supervisor-initiated)
-- ════════════════════════════════════════════════════════════════════════
-- Distinct from the per-date leave cascade flags (job_replacement_flags):
-- this captures a supervisor manually covering worker A with worker B over a
-- date RANGE on an already-started job, with a reason. A stays assigned; B
-- covers [from_date, to_date]. The customer portal shows a "Replaced" tag on
-- B only while today is within that window.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.worker_replacements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  replaced_user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- worker A (covered)
  replacement_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- worker B (covering)
  from_date           DATE NOT NULL,
  to_date             DATE NOT NULL,
  reason              TEXT,
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_repl_job  ON public.worker_replacements(job_id);
CREATE INDEX IF NOT EXISTS idx_worker_repl_b    ON public.worker_replacements(replacement_user_id);
CREATE INDEX IF NOT EXISTS idx_worker_repl_dates ON public.worker_replacements(from_date, to_date);

-- ── RLS ──
ALTER TABLE public.worker_replacements ENABLE ROW LEVEL SECURITY;

-- Admin + supervisor: full access
DROP POLICY IF EXISTS "worker_repl_internal" ON public.worker_replacements;
CREATE POLICY "worker_repl_internal" ON public.worker_replacements
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

-- Helpee (customer) can see replacements on jobs they own → drives "Replaced" tag
DROP POLICY IF EXISTS "worker_repl_helpee_select" ON public.worker_replacements;
CREATE POLICY "worker_repl_helpee_select" ON public.worker_replacements
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_associated_users jau
      WHERE jau.job_id = worker_replacements.job_id
        AND jau.user_id = public.auth_user_id()
        AND jau.role = 'helpee'
    )
  );

-- Workers can see replacements on jobs they're assigned to
DROP POLICY IF EXISTS "worker_repl_helper_select" ON public.worker_replacements;
CREATE POLICY "worker_repl_helper_select" ON public.worker_replacements
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_associated_users jau
      WHERE jau.job_id = worker_replacements.job_id
        AND jau.user_id = public.auth_user_id()
    )
  );

-- ── Notify B (new worker) + customer when a replacement is created ──
CREATE OR REPLACE FUNCTION public.notify_on_worker_replacement()
RETURNS TRIGGER AS $$
DECLARE
  v_job_name TEXT;
  v_a_name   TEXT;
  v_b_name   TEXT;
BEGIN
  SELECT job_name INTO v_job_name FROM public.jobs WHERE id = NEW.job_id;
  SELECT user_name INTO v_a_name FROM public.users WHERE id = NEW.replaced_user_id;
  SELECT user_name INTO v_b_name FROM public.users WHERE id = NEW.replacement_user_id;

  -- New worker (B)
  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
  VALUES (NEW.replacement_user_id, 'New Assignment',
          'You have been assigned to cover "' || COALESCE(v_job_name, 'a job')
            || '" from ' || NEW.from_date || ' to ' || NEW.to_date || '.',
          'job_assigned', NEW.job_id, ARRAY['in_app']);

  -- Customer (helpee)
  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
  SELECT jau.user_id, 'Replacement Assigned',
         'Update for "' || COALESCE(v_job_name, 'your job') || '": '
           || COALESCE(v_b_name, 'A replacement worker')
           || ' has been assigned to cover your service during '
           || COALESCE(v_a_name, 'the assigned worker') || '''s absence.',
         'replacement_assigned', NEW.job_id, ARRAY['in_app']
  FROM public.job_associated_users jau
  WHERE jau.job_id = NEW.job_id AND jau.role = 'helpee';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_worker_replacement ON public.worker_replacements;
CREATE TRIGGER trg_notify_worker_replacement
  AFTER INSERT ON public.worker_replacements
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_worker_replacement();
