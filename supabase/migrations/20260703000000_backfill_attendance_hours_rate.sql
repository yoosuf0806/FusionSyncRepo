-- ════════════════════════════════════════════════════════════════════════
-- Backfill total_hours and rate_for_day on existing attendance records
-- ════════════════════════════════════════════════════════════════════════
-- Check-out now computes total_hours and snapshots the effective rate onto each
-- attendance row (hourly_rate × hours if hourly is set, else daily_rate). But
-- records checked out BEFORE this change have null total_hours / rate_for_day,
-- so payroll shows 0 for them. This backfill fills those in best-effort:
--   • total_hours from (checkout_at - checkin_at) where both exist
--   • rate_for_day from the job type's CURRENT rate
-- NOTE: for past records the true historical rate isn't recoverable, so this
-- uses the current job-type rate. New check-outs are always accurate.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Backfill total_hours where missing and both timestamps exist
UPDATE public.job_attendance a
SET total_hours = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (a.checkout_at - a.checkin_at)) / 3600.0, 2))
WHERE a.total_hours IS NULL
  AND a.checkin_at IS NOT NULL
  AND a.checkout_at IS NOT NULL;

-- 2) Backfill rate_for_day where missing, from the job's current job-type rate
UPDATE public.job_attendance a
SET rate_for_day = CASE
      WHEN COALESCE(js.hourly_rate, 0) > 0 THEN COALESCE(js.hourly_rate, 0) * COALESCE(a.total_hours, 0)
      ELSE COALESCE(js.daily_rate, 0)
    END
FROM public.jobs j
JOIN public.job_specifications js ON js.id = j.job_type_id
WHERE a.job_id = j.id
  AND (a.rate_for_day IS NULL OR a.rate_for_day = 0)
  AND a.checkout_at IS NOT NULL;
