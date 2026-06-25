-- ════════════════════════════════════════════════════════════════════════
-- Consolidate replacement notifications
-- ════════════════════════════════════════════════════════════════════════
-- Replacements are now always recorded as a worker_replacements coverage row
-- (with a date range), whose trigger sends ONE clean notification to B + the
-- customer. The older per-date flag trigger (trg_notify_replacement_assigned)
-- would fire once PER filled date — redundant and spammy for ranges. Drop it.
-- The flags are still filled (to clear the REPLACE badge); they just no longer
-- send their own notifications.
-- ════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_notify_replacement_assigned ON public.job_replacement_flags;
