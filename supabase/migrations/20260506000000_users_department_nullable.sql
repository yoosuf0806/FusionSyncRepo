-- ════════════════════════════════════════════════════════════════════════
-- Make users.department_id nullable
-- ════════════════════════════════════════════════════════════════════════
-- Department applies only to workers and supervisors. Admins and helpees have
-- no department (a helpee requests jobs in any department; the department lives
-- on the job). The original NOT NULL constraint blocked saving those users, so
-- drop it. Workers/supervisors still get a department enforced in the app-level
-- validation on the user form.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ALTER COLUMN department_id DROP NOT NULL;
