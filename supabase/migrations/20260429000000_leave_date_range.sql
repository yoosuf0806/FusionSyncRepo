-- ════════════════════════════════════════════════════════════════════════
-- Leave date RANGE support
-- ════════════════════════════════════════════════════════════════════════
-- Previously leave was a single date (leave_date). Now a leave request covers
-- [leave_date, leave_to_date]. leave_date remains the "from" date so existing
-- rows stay valid; leave_to_date defaults to leave_date (single-day) when not
-- given. The approval cascade now flags every scheduled job-date in the range.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_to_date DATE;

-- Backfill existing rows: single-day leave → to_date = leave_date
UPDATE public.leave_requests SET leave_to_date = leave_date WHERE leave_to_date IS NULL;

-- Going forward, default to_date to the from-date at insert if omitted
ALTER TABLE public.leave_requests
  ALTER COLUMN leave_to_date SET DEFAULT NULL;

-- ── Re-create the approval cascade to walk the whole [leave_date, leave_to_date] range ──
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
  v_to     DATE;
  d        DATE;
BEGIN
  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  v_to := COALESCE(NEW.leave_to_date, NEW.leave_date);

  -- Worker first (stamped earliest)
  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, delivery_channels, created_at)
  VALUES (NEW.requester_id, 'Leave Approved',
          'Your leave from ' || NEW.leave_date || ' to ' || v_to || ' has been approved.',
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
    -- Walk each date in the leave range
    d := NEW.leave_date;
    WHILE d <= v_to LOOP
      v_scheduled := FALSE;
      IF r_job.job_category = 'frequent' THEN
        IF r_job.job_from_date IS NOT NULL
           AND d >= r_job.job_from_date
           AND d <= COALESCE(r_job.job_to_date, r_job.job_from_date)
           AND public.date_matches_job_days(d, r_job.job_days) THEN
          v_scheduled := TRUE;
        END IF;
      ELSE
        IF r_job.job_date = d THEN
          v_scheduled := TRUE;
        END IF;
      END IF;

      IF v_scheduled THEN
        v_jstart := COALESCE(r_job.job_start_time, TIME '00:00');
        v_jend   := COALESCE(r_job.job_end_time, TIME '23:59');
        IF (v_lstart < v_jend AND v_jstart < v_lend) THEN
          INSERT INTO public.job_replacement_flags
            (job_id, flag_date, absent_user_id, leave_request_id)
          VALUES (r_job.id, d, NEW.requester_id, NEW.id)
          ON CONFLICT (job_id, flag_date, absent_user_id) DO NOTHING;
        END IF;
      END IF;

      d := d + 1;
    END LOOP;

    -- One customer + internal notification per affected job (not per date)
    IF EXISTS (
      SELECT 1 FROM public.job_replacement_flags f
      WHERE f.job_id = r_job.id AND f.absent_user_id = NEW.requester_id
        AND f.flag_date BETWEEN NEW.leave_date AND v_to
    ) THEN
      INSERT INTO public.notifications
        (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels, created_at)
      SELECT jau.user_id, 'Worker Unavailable',
             COALESCE(v_absent_name, 'A worker') || ' is unavailable from '
               || NEW.leave_date || ' to ' || v_to || ' for "' || r_job.job_name
               || '". We are assigning a replacement worker to ensure your service continues.',
             'replacement_needed', r_job.id, ARRAY['in_app'], v_now + INTERVAL '1 second'
      FROM public.job_associated_users jau
      WHERE jau.job_id = r_job.id AND jau.role = 'helpee';

      INSERT INTO public.notifications
        (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels, created_at)
      SELECT u.id, 'Replacement Needed',
             COALESCE(v_absent_name, 'A worker') || ' is on leave '
               || NEW.leave_date || '–' || v_to || '. Job "' || r_job.job_name
               || '" needs a replacement worker.',
             'replacement_needed', r_job.id, ARRAY['in_app'], v_now + INTERVAL '1 second'
      FROM public.users u
      WHERE u.user_type IN ('admin', 'supervisor') AND u.is_active = TRUE;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Re-create the one-leave-per-day trigger to be RANGE-aware ──
CREATE OR REPLACE FUNCTION public.enforce_one_leave_per_day()
RETURNS TRIGGER AS $$
DECLARE
  v_new_to     DATE := COALESCE(NEW.leave_to_date, NEW.leave_date);
  v_overlap    INT;
  v_same_day   INT;
  v_has_first  BOOLEAN;
  v_has_second BOOLEAN;
BEGIN
  -- Count any non-rejected request whose range intersects the new range
  SELECT COUNT(*) INTO v_overlap
  FROM public.leave_requests
  WHERE requester_id = NEW.requester_id
    AND status <> 'rejected'
    AND id <> NEW.id
    AND leave_date <= v_new_to
    AND COALESCE(leave_to_date, leave_date) >= NEW.leave_date;

  IF v_overlap = 0 THEN
    RETURN NEW;  -- no conflict
  END IF;

  -- Half-day exception only applies when BOTH the new and existing are the
  -- same single day. Check whether all overlaps are that same single day.
  SELECT COUNT(*) INTO v_same_day
  FROM public.leave_requests
  WHERE requester_id = NEW.requester_id
    AND status <> 'rejected'
    AND id <> NEW.id
    AND leave_date <= v_new_to
    AND COALESCE(leave_to_date, leave_date) >= NEW.leave_date
    AND NOT (leave_date = NEW.leave_date
             AND COALESCE(leave_to_date, leave_date) = NEW.leave_date
             AND NEW.leave_date = v_new_to);

  IF v_same_day > 0 THEN
    RAISE EXCEPTION 'You already have a leave request that overlaps these dates.';
  END IF;

  -- All overlaps are the same single day → apply half-day exception
  SELECT bool_or(duration = 'first_half'), bool_or(duration = 'second_half')
  INTO v_has_first, v_has_second
  FROM public.leave_requests
  WHERE requester_id = NEW.requester_id
    AND status <> 'rejected'
    AND id <> NEW.id
    AND leave_date = NEW.leave_date;

  IF EXISTS (SELECT 1 FROM public.leave_requests
             WHERE requester_id = NEW.requester_id AND status <> 'rejected'
               AND id <> NEW.id AND leave_date = NEW.leave_date AND duration = 'full_day') THEN
    RAISE EXCEPTION 'A full-day leave request already exists for this date.';
  END IF;
  IF NEW.duration = 'full_day' THEN
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
