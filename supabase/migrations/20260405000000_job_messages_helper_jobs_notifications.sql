-- =====================================================================
-- Job messages (helper/supervisor/admin), helper-created jobs RLS,
-- notification types + participant insert policy.
-- =====================================================================

-- Allow job_message + system in notifications CHECK
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'job_assigned', 'status_update', 'payment', 'remark_added', 'general',
    'job_message', 'system'
  ));

-- ── job_messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  author_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_name      VARCHAR(255) NOT NULL,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_messages_body_nonempty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_job_messages_job_id ON public.job_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_job_messages_created_at ON public.job_messages(created_at);

ALTER TABLE public.job_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_messages_select" ON public.job_messages;
CREATE POLICY "job_messages_select"
  ON public.job_messages FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.job_associated_users jau
      WHERE jau.job_id = job_messages.job_id
        AND jau.user_id = public.auth_user_id()
    )
  );

DROP POLICY IF EXISTS "job_messages_insert" ON public.job_messages;
CREATE POLICY "job_messages_insert"
  ON public.job_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = public.auth_user_id()
    AND (
      public.auth_user_type() = 'admin'
      OR (
        public.auth_user_type() IN ('helper', 'supervisor')
        AND EXISTS (
          SELECT 1 FROM public.job_associated_users jau
          WHERE jau.job_id = job_messages.job_id
            AND jau.user_id = public.auth_user_id()
        )
      )
    )
  );

-- ── Helpers: create own job request (mirror helpee) ───────────
DROP POLICY IF EXISTS "jobs_helper_insert_own" ON public.jobs;
CREATE POLICY "jobs_helper_insert_own"
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helper'
    AND job_requester_id = public.auth_user_id()
  );

DROP POLICY IF EXISTS "jau_helper_insert_self_helper_on_own_job" ON public.job_associated_users;
CREATE POLICY "jau_helper_insert_self_helper_on_own_job"
  ON public.job_associated_users FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helper'
    AND user_id = public.auth_user_id()
    AND role = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_associated_users.job_id
        AND j.job_requester_id = public.auth_user_id()
    )
  );

DROP POLICY IF EXISTS "jqa_helper_insert_own_requester_job" ON public.job_question_answers;
CREATE POLICY "jqa_helper_insert_own_requester_job"
  ON public.job_question_answers FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_question_answers.job_id
        AND j.job_requester_id = public.auth_user_id()
    )
  );

-- ── Non-admin may insert notifications for job workflows ───────
DROP POLICY IF EXISTS "notifications_participant_insert" ON public.notifications;
CREATE POLICY "notifications_participant_insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    recipient_user_id <> public.auth_user_id()
    AND title IS NOT NULL
    AND char_length(trim(title)) > 0
    AND public.auth_user_type() IN ('helper', 'supervisor')
    AND notification_type IN ('job_assigned', 'job_message', 'general', 'status_update')
    AND related_job_id IS NOT NULL
    AND (
      (
        EXISTS (
          SELECT 1 FROM public.job_associated_users j1
          WHERE j1.job_id = notifications.related_job_id
            AND j1.user_id = public.auth_user_id()
        )
        AND EXISTS (
          SELECT 1 FROM public.job_associated_users j2
          WHERE j2.job_id = notifications.related_job_id
            AND j2.user_id = notifications.recipient_user_id
        )
      )
      OR (
        public.auth_user_type() = 'helper'
        AND notification_type = 'general'
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = notifications.related_job_id
            AND j.job_requester_id = public.auth_user_id()
        )
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = notifications.recipient_user_id
            AND u.user_type = 'supervisor'
            AND u.is_active IS TRUE
        )
      )
      OR (
        public.auth_user_type() = 'helper'
        AND notification_type = 'job_message'
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = notifications.related_job_id
            AND j.job_requester_id = public.auth_user_id()
        )
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = notifications.recipient_user_id
            AND u.user_type = 'supervisor'
            AND u.is_active IS TRUE
        )
      )
    )
  );
