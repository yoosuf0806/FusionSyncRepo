-- ════════════════════════════════════════════════════════════════════════
-- Scope attendance visibility by role (security, not just UI)
-- ════════════════════════════════════════════════════════════════════════
-- Rule:
--   • admin       → sees ALL attendance (workers + supervisors)
--   • supervisor  → sees WORKER (helper) attendance only — NOT other
--                   supervisors', NOT their own (their own is on My Day)
--   • helper      → sees their own rows (for My Day check-in/out)
--
-- UI filtering alone is not security — a supervisor could otherwise query
-- another supervisor's rows directly. This enforces it at the row level.
-- ════════════════════════════════════════════════════════════════════════

-- Helper function: is the attendance row's subject a 'helper'?
CREATE OR REPLACE FUNCTION public.attendance_subject_type(p_helper_id UUID)
RETURNS TEXT AS $$
  SELECT user_type FROM public.users WHERE id = p_helper_id LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Drop the broad admin+supervisor ALL policy and split by operation/role
DROP POLICY IF EXISTS "attendance_admin_supervisor_all" ON public.job_attendance;
DROP POLICY IF EXISTS "attendance_supervisor_admin_correct" ON public.job_attendance;

-- ── ADMIN: full access to everything ──
CREATE POLICY "attendance_admin_all" ON public.job_attendance
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

-- ── SUPERVISOR: SELECT only worker (helper) rows ──
CREATE POLICY "attendance_supervisor_select_helpers" ON public.job_attendance
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'supervisor'
    AND public.attendance_subject_type(helper_id) = 'helper'
  );

-- ── SUPERVISOR: UPDATE (correct) only worker (helper) rows ──
CREATE POLICY "attendance_supervisor_correct_helpers" ON public.job_attendance
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.auth_user_type() = 'supervisor'
    AND public.attendance_subject_type(helper_id) = 'helper'
  )
  WITH CHECK (
    public.auth_user_type() = 'supervisor'
    AND public.attendance_subject_type(helper_id) = 'helper'
  );

-- ── HELPER / SUPERVISOR (own attendance): insert + select + update own rows ──
-- This supports My Day check-in/out for both helpers and supervisors doing
-- their own field attendance. A user can always act on rows where they are
-- the subject (helper_id = their own id).
DROP POLICY IF EXISTS "attendance_own_rows" ON public.job_attendance;
CREATE POLICY "attendance_own_rows" ON public.job_attendance
  AS PERMISSIVE FOR ALL TO authenticated
  USING (helper_id = public.auth_user_id())
  WITH CHECK (helper_id = public.auth_user_id());
