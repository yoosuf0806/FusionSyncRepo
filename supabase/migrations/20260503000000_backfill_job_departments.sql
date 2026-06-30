-- ════════════════════════════════════════════════════════════════════════
-- Backfill department_id on existing jobs
-- ════════════════════════════════════════════════════════════════════════
-- Jobs created before the Department field existed have department_id = NULL.
-- Once supervisor RLS scopes by department, those jobs would be invisible to
-- supervisors. Backfill each null-department job from the department of its
-- assigned supervisor (if any). Jobs with no assigned supervisor stay NULL and
-- remain admin-only until an admin sets a department by editing the job.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.jobs j
SET department_id = u.department_id
FROM public.job_associated_users jau
JOIN public.users u ON u.id = jau.user_id
WHERE jau.job_id = j.id
  AND jau.role = 'supervisor'
  AND j.department_id IS NULL
  AND u.department_id IS NOT NULL;

-- Secondary fallback: if still null, use the department of any assigned helper.
UPDATE public.jobs j
SET department_id = u.department_id
FROM public.job_associated_users jau
JOIN public.users u ON u.id = jau.user_id
WHERE jau.job_id = j.id
  AND jau.role = 'helper'
  AND j.department_id IS NULL
  AND u.department_id IS NOT NULL;
