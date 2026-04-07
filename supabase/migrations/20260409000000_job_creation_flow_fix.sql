-- =====================================================================
-- Job creation flow fix
--
-- 1. Fix circular RLS dependency: helpee SELECT on jobs now also allows
--    direct requester match (breaks the chicken-and-egg loop that
--    blocked helpees from inserting into job_associated_users).
--
-- 2. Allow helpees to notify supervisors/admins of a new job they created.
--
-- Run in Supabase Dashboard → SQL Editor
-- =====================================================================

-- ── 1. Fix jobs_helpee_select_own (circular dependency fix) ──────────
--
-- Before: helpee could only see jobs they were in job_associated_users for.
-- This blocked them from inserting into job_associated_users at all because
-- the jau INSERT policy checked the jobs table, which required jau → loop.
--
-- After: helpee can ALSO see jobs where job_requester_id = their own user id.
-- This breaks the loop: INSERT into jau → check jobs via requester id → pass.
DROP POLICY IF EXISTS "jobs_helpee_select_own" ON public.jobs;
CREATE POLICY "jobs_helpee_select_own"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND (
      -- Linked explicitly via job_associated_users
      EXISTS (
        SELECT 1 FROM public.job_associated_users
        WHERE job_id = jobs.id AND user_id = public.auth_user_id()
      )
      -- OR they are the direct requester (fixes circular dep on new job creation)
      OR job_requester_id = public.auth_user_id()
    )
  );

-- ── 2. Update notifications_participant_insert ───────────────────────
--
-- Adds the helpee path so a helpee can notify supervisors/admins when
-- they create a new job. Supervisor path is extended so supervisors can
-- notify any participant they assign to a job.
DROP POLICY IF EXISTS "notifications_participant_insert" ON public.notifications;
CREATE POLICY "notifications_participant_insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    recipient_user_id <> public.auth_user_id()
    AND title IS NOT NULL
    AND char_length(trim(title)) > 0
    AND notification_type IN ('job_assigned', 'job_message', 'general', 'status_update')
    AND related_job_id IS NOT NULL
    AND (

      -- ── Path A: helper/supervisor notifying a fellow job participant ──
      (
        public.auth_user_type() IN ('helper', 'supervisor')
        AND EXISTS (
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

      -- ── Path B: supervisor notifying anyone about a job they manage ──
      -- (covers new-job notifications to helpers/helpee before they are
      --  necessarily in jau, e.g. on the same createJob transaction)
      OR (
        public.auth_user_type() = 'supervisor'
        AND notification_type IN ('job_assigned', 'general')
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = notifications.related_job_id
        )
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = notifications.recipient_user_id
            AND u.user_type IN ('helpee', 'helper', 'admin')
            AND u.is_active IS TRUE
        )
      )

      -- ── Path C: helper notifying supervisors about their job ─────────
      OR (
        public.auth_user_type() = 'helper'
        AND notification_type IN ('general', 'job_message')
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = notifications.related_job_id
            AND j.job_requester_id = public.auth_user_id()
        )
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = notifications.recipient_user_id
            AND u.user_type IN ('supervisor', 'admin')
            AND u.is_active IS TRUE
        )
      )

      -- ── Path D: helpee notifying supervisors/admins of new job ───────
      OR (
        public.auth_user_type() = 'helpee'
        AND notification_type = 'general'
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = notifications.related_job_id
            AND j.job_requester_id = public.auth_user_id()
        )
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = notifications.recipient_user_id
            AND u.user_type IN ('supervisor', 'admin')
            AND u.is_active IS TRUE
        )
      )

    )
  );
