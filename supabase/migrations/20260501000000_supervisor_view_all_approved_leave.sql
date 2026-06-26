-- ════════════════════════════════════════════════════════════════════════
-- Supervisors can VIEW all approved leave (for the "On Leave" board)
-- ════════════════════════════════════════════════════════════════════════
-- The On Leave view in Manage Attendance must show everyone on approved leave,
-- including other supervisors. The existing supervisor policy only exposes
-- helper leave + their own. This adds a SELECT-only policy so supervisors can
-- READ approved leave for ALL users (workers + supervisors). It does NOT grant
-- write/review access to other supervisors' leave — approval of a supervisor's
-- leave still belongs to admins.
-- ════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "leave_supervisor_view_approved" ON public.leave_requests;
CREATE POLICY "leave_supervisor_view_approved" ON public.leave_requests
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'supervisor'
    AND status = 'approved'
  );
