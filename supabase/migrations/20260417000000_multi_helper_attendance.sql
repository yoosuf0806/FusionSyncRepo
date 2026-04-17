-- ============================================================
-- Multi-helper attendance support
--
-- Previously: UNIQUE (job_id, attendance_date) — one row per day per job
-- Now:        UNIQUE (job_id, attendance_date, helper_id) — one row per
--             helper per day per job, each with independent status tracking
-- ============================================================

-- 1. Add helper_id column
ALTER TABLE public.job_attendance
  ADD COLUMN IF NOT EXISTS helper_id UUID
    REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Drop old unique constraint
ALTER TABLE public.job_attendance
  DROP CONSTRAINT IF EXISTS job_attendance_job_id_attendance_date_key;

-- 3. Add new unique constraint (job + date + helper)
ALTER TABLE public.job_attendance
  ADD CONSTRAINT job_attendance_job_id_date_helper_key
  UNIQUE (job_id, attendance_date, helper_id);

-- 4. Index for fast helper-scoped lookups
CREATE INDEX IF NOT EXISTS idx_attendance_helper_id
  ON public.job_attendance(helper_id);

-- 5. Update helper SELECT policy — helper sees only their own rows
DROP POLICY IF EXISTS "attendance_helper_select" ON public.job_attendance;
CREATE POLICY "attendance_helper_select" ON public.job_attendance
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND helper_id = public.auth_user_id()
  );

-- 6. Update helper UPDATE policy — helper can only update their own rows
DROP POLICY IF EXISTS "attendance_helper_update" ON public.job_attendance;
CREATE POLICY "attendance_helper_update" ON public.job_attendance
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND helper_id = public.auth_user_id()
  )
  WITH CHECK (
    public.auth_user_type() = 'helper'
    AND helper_id = public.auth_user_id()
  );

-- 7. Update helper INSERT policy — sets helper_id to current user
DROP POLICY IF EXISTS "attendance_helper_insert" ON public.job_attendance;
CREATE POLICY "attendance_helper_insert" ON public.job_attendance
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helper'
    AND helper_id = public.auth_user_id()
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_attendance.job_id
        AND user_id = public.auth_user_id()
    )
  );
