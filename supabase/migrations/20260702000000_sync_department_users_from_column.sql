-- ════════════════════════════════════════════════════════════════════════
-- Backfill department_users join table from users.department_id
-- ════════════════════════════════════════════════════════════════════════
-- The user form sets users.department_id but historically did not insert into
-- the department_users join table, so users created via the user form were
-- invisible on the Manage Department screen (which reads the join table).
-- Going forward the app keeps both in sync. This one-time backfill inserts any
-- missing join rows for users that already have a department_id, and removes
-- stale rows that don't match the user's current department_id.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Insert missing membership rows (user has a department but no join row)
INSERT INTO public.department_users (department_id, user_id)
SELECT u.department_id, u.id
FROM public.users u
WHERE u.department_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.department_users du
    WHERE du.user_id = u.id AND du.department_id = u.department_id
  );

-- 2) Remove stale join rows that don't match the user's current department
DELETE FROM public.department_users du
USING public.users u
WHERE du.user_id = u.id
  AND (u.department_id IS NULL OR du.department_id <> u.department_id);
