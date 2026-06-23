-- ════════════════════════════════════════════════════════════════════════
-- Phase 4: Leave requests + per-job-per-date replacement flags
-- ════════════════════════════════════════════════════════════════════════
-- Model (locked with product owner):
--   • Worker leave approved by Supervisor; Supervisor leave approved by Admin
--   • Leave duration: full_day | first_half (08:00-13:00) | second_half (13:00-18:00)
--   • Preset reasons: sick | personal | emergency | other (+ optional note)
--   • Leave is approve/reject once, terminal (no reopen)
--   • On approval → flag affected job-DATES (time-aware overlap), notify all
--   • Replacement assigned for a flagged date → clears that date's flag
--   • Flags are per-job-per-date (a one-day leave on a month-long job flags
--     only that date, not the whole job)
-- ════════════════════════════════════════════════════════════════════════

-- 1. Leave requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_date      DATE NOT NULL,
  duration        VARCHAR(20) NOT NULL DEFAULT 'full_day'
                    CHECK (duration IN ('full_day','first_half','second_half')),
  reason          VARCHAR(20) NOT NULL
                    CHECK (reason IN ('sick','personal','emergency','other')),
  note            TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_requester ON public.leave_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status    ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date      ON public.leave_requests(leave_date);

-- 2. Per-job-per-date replacement flags
--    A row here means: on this job, on this date, this worker is on leave and
--    a replacement is needed (until replacement_user_id is filled).
CREATE TABLE IF NOT EXISTS public.job_replacement_flags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  flag_date           DATE NOT NULL,
  absent_user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_request_id    UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  replacement_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  replaced_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, flag_date, absent_user_id)
);

CREATE INDEX IF NOT EXISTS idx_repl_flags_job   ON public.job_replacement_flags(job_id);
CREATE INDEX IF NOT EXISTS idx_repl_flags_date  ON public.job_replacement_flags(flag_date);
CREATE INDEX IF NOT EXISTS idx_repl_flags_open  ON public.job_replacement_flags(job_id, flag_date)
  WHERE replacement_user_id IS NULL;

-- 3. Extend notification types for leave + replacement
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'job_assigned','status_update','payment','remark_added','general',
    'job_message','leave_request','leave_approved','leave_rejected',
    'replacement_needed','replacement_assigned'
  ));

-- 4. RLS for leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Requester can see + create their own leave
DROP POLICY IF EXISTS "leave_own" ON public.leave_requests;
CREATE POLICY "leave_own" ON public.leave_requests
  AS PERMISSIVE FOR ALL TO authenticated
  USING (requester_id = public.auth_user_id())
  WITH CHECK (requester_id = public.auth_user_id());

-- Admin sees/acts on all leave
DROP POLICY IF EXISTS "leave_admin" ON public.leave_requests;
CREATE POLICY "leave_admin" ON public.leave_requests
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

-- Supervisor sees/acts on leave requested by helpers (workers)
DROP POLICY IF EXISTS "leave_supervisor_helpers" ON public.leave_requests;
CREATE POLICY "leave_supervisor_helpers" ON public.leave_requests
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    public.auth_user_type() = 'supervisor'
    AND public.attendance_subject_type(requester_id) = 'helper'
  )
  WITH CHECK (
    public.auth_user_type() = 'supervisor'
    AND public.attendance_subject_type(requester_id) = 'helper'
  );

-- 5. RLS for job_replacement_flags (visible to all involved parties)
ALTER TABLE public.job_replacement_flags ENABLE ROW LEVEL SECURITY;

-- Admin + supervisor: full access
DROP POLICY IF EXISTS "repl_flags_internal" ON public.job_replacement_flags;
CREATE POLICY "repl_flags_internal" ON public.job_replacement_flags
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

-- Helpee can see flags for jobs they own (so the customer sees replacement status)
DROP POLICY IF EXISTS "repl_flags_helpee_select" ON public.job_replacement_flags;
CREATE POLICY "repl_flags_helpee_select" ON public.job_replacement_flags
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_associated_users jau
      WHERE jau.job_id = job_replacement_flags.job_id
        AND jau.user_id = public.auth_user_id()
        AND jau.role = 'helpee'
    )
  );

-- Helper can see flags for jobs they're assigned to
DROP POLICY IF EXISTS "repl_flags_helper_select" ON public.job_replacement_flags;
CREATE POLICY "repl_flags_helper_select" ON public.job_replacement_flags
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_associated_users jau
      WHERE jau.job_id = job_replacement_flags.job_id
        AND jau.user_id = public.auth_user_id()
    )
  );
