-- ════════════════════════════════════════════════════════════════════════
-- Leave refinements:
--   1. Enforce one leave request per worker per day (half-day exception)
--   2. Guarantee the worker's approval notification is ordered BEFORE the
--      helpee's replacement notification
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. One leave per day, with half-day exception (DB-enforced) ──
-- Mirrors the client validation so it can't be bypassed:
--   • existing full-day  → block any new request that day
--   • existing half-day  → allow only the OPPOSITE half
--   • rejected requests don't count
CREATE OR REPLACE FUNCTION public.enforce_one_leave_per_day()
RETURNS TRIGGER AS $$
DECLARE
  v_has_full   BOOLEAN;
  v_has_first  BOOLEAN;
  v_has_second BOOLEAN;
BEGIN
  SELECT
    bool_or(duration = 'full_day'),
    bool_or(duration = 'first_half'),
    bool_or(duration = 'second_half')
  INTO v_has_full, v_has_first, v_has_second
  FROM public.leave_requests
  WHERE requester_id = NEW.requester_id
    AND leave_date = NEW.leave_date
    AND status <> 'rejected'
    AND id <> NEW.id;

  IF COALESCE(v_has_full, FALSE) THEN
    RAISE EXCEPTION 'A full-day leave request already exists for this date.';
  END IF;

  IF NEW.duration = 'full_day' AND (COALESCE(v_has_first, FALSE) OR COALESCE(v_has_second, FALSE)) THEN
    RAISE EXCEPTION 'A half-day leave request already exists for this date; only the remaining half can be requested.';
  END IF;

  IF NEW.duration = 'first_half' AND COALESCE(v_has_first, FALSE) THEN
    RAISE EXCEPTION 'The morning (first half) is already requested for this date.';
  END IF;

  IF NEW.duration = 'second_half' AND COALESCE(v_has_second, FALSE) THEN
    RAISE EXCEPTION 'The afternoon (second half) is already requested for this date.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_one_leave_per_day ON public.leave_requests;
CREATE TRIGGER trg_enforce_one_leave_per_day
  BEFORE INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_one_leave_per_day();

-- ── 2. Explicit notification ordering on approval ──
-- Re-create the cascade so the worker's 'Leave Approved' notification is
-- stamped a moment earlier than the helpee's, guaranteeing the worker is
-- notified first even within the same transaction.
CREATE OR REPLACE FUNCTION public.cascade_on_leave_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_absent_name TEXT;
  v_lstart TIME;
  v_lend   TIME;
  r_job    RECORD;
  v_jstart TIME;
  v_jend   TIME;
  v_scheduled BOOLEAN;
  v_now    TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Worker first — stamped slightly earlier so it always sorts before the
  -- customer's replacement notification.
  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, delivery_channels, created_at)
  VALUES (NEW.requester_id, 'Leave Approved',
          'Your leave on ' || NEW.leave_date || ' has been approved.',
          'leave_approved', ARRAY['in_app'], v_now);

  SELECT user_name INTO v_absent_name FROM public.users WHERE id = NEW.requester_id;

  v_lstart := CASE NEW.duration WHEN 'second_half' THEN TIME '13:00' ELSE TIME '00:00' END;
  v_lend   := CASE NEW.duration
                WHEN 'first_half'  THEN TIME '13:00'
                WHEN 'second_half' THEN TIME '18:00'
                ELSE TIME '23:59' END;

  FOR r_job IN
    SELECT j.*
    FROM public.jobs j
    JOIN public.job_associated_users jau ON jau.job_id = j.id
    WHERE jau.user_id = NEW.requester_id
      AND jau.role IN ('helper', 'supervisor')
      AND j.status NOT IN ('job_closed', 'cancelled', 'payment_confirmed')
  LOOP
    v_scheduled := FALSE;
    IF r_job.job_category = 'frequent' THEN
      IF r_job.job_from_date IS NOT NULL
         AND NEW.leave_date >= r_job.job_from_date
         AND NEW.leave_date <= COALESCE(r_job.job_to_date, r_job.job_from_date)
         AND public.date_matches_job_days(NEW.leave_date, r_job.job_days) THEN
        v_scheduled := TRUE;
      END IF;
    ELSE
      IF r_job.job_date = NEW.leave_date THEN
        v_scheduled := TRUE;
      END IF;
    END IF;
    IF NOT v_scheduled THEN CONTINUE; END IF;

    v_jstart := COALESCE(r_job.job_start_time, TIME '00:00');
    v_jend   := COALESCE(r_job.job_end_time, TIME '23:59');
    IF NOT (v_lstart < v_jend AND v_jstart < v_lend) THEN CONTINUE; END IF;

    INSERT INTO public.job_replacement_flags
      (job_id, flag_date, absent_user_id, leave_request_id)
    VALUES (r_job.id, NEW.leave_date, NEW.requester_id, NEW.id)
    ON CONFLICT (job_id, flag_date, absent_user_id) DO NOTHING;

    -- Customer (helpee) — stamped strictly AFTER the worker's notification
    INSERT INTO public.notifications
      (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels, created_at)
    SELECT jau.user_id, 'Worker Unavailable',
           COALESCE(v_absent_name, 'A worker') || ' is unavailable on '
             || NEW.leave_date || ' for "' || r_job.job_name
             || '". We are assigning a replacement worker to ensure your service continues.',
           'replacement_needed', r_job.id, ARRAY['in_app'], v_now + INTERVAL '1 second'
    FROM public.job_associated_users jau
    WHERE jau.job_id = r_job.id AND jau.role = 'helpee';

    INSERT INTO public.notifications
      (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels, created_at)
    SELECT u.id, 'Replacement Needed',
           COALESCE(v_absent_name, 'A worker') || ' is on leave ' || NEW.leave_date
             || '. Job "' || r_job.job_name || '" needs a replacement worker.',
           'replacement_needed', r_job.id, ARRAY['in_app'], v_now + INTERVAL '1 second'
    FROM public.users u
    WHERE u.user_type IN ('admin', 'supervisor') AND u.is_active = TRUE;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
