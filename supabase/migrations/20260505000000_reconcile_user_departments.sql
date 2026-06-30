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
-- ════════════════════════════════════════════════════════════════════════

WITH single_dept AS (
  SELECT user_id, MIN(department_id) AS department_id, COUNT(*) AS n
  FROM public.department_users
  GROUP BY user_id
  HAVING COUNT(*) = 1
)
UPDATE public.users u
SET department_id = sd.department_id
FROM single_dept sd
WHERE u.id = sd.user_id
  AND (u.department_id IS DISTINCT FROM sd.department_id);
