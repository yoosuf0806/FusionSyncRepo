-- ════════════════════════════════════════════════════════════════════════
-- Reconcile users.department_id with the department_users join table
-- ════════════════════════════════════════════════════════════════════════
-- Two sources of truth had drifted: the Department screen wrote department
-- membership to department_users, but job/leave scoping reads users.department_id.
-- Users assigned via the Department screen ended up listed in a department while
-- their department_id column still pointed elsewhere (or was stale), so
-- department-scoped job visibility didn't match what the Department UI showed.
--
-- Going forward, addUserToDepartment/removeUserFromDepartment keep the column in
-- sync. This one-time backfill fixes existing rows: for any user who has exactly
-- one department_users row, set users.department_id to that department.
-- (Users with multiple join rows are left alone to avoid guessing — our model is
--  one department per worker/supervisor, so multi-rows shouldn't normally exist.)
--
-- NOTE: department_id is a UUID and Postgres has no MIN(uuid) aggregate, so we
-- select the single row directly per user (guaranteed one row by HAVING
-- COUNT = 1) rather than aggregating the uuid.
-- ════════════════════════════════════════════════════════════════════════

WITH counts AS (
  SELECT user_id
  FROM public.department_users
  GROUP BY user_id
  HAVING COUNT(*) = 1
),
single_dept AS (
  SELECT du.user_id, du.department_id
  FROM public.department_users du
  JOIN counts c ON c.user_id = du.user_id
)
UPDATE public.users u
SET department_id = sd.department_id
FROM single_dept sd
WHERE u.id = sd.user_id
  AND (u.department_id IS DISTINCT FROM sd.department_id);
