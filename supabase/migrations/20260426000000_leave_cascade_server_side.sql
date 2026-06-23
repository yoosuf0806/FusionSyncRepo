-- ════════════════════════════════════════════════════════════════════════
-- Phase 4 fix: run the leave notification + replacement cascade SERVER-SIDE
-- ════════════════════════════════════════════════════════════════════════
-- Why: the client-side cascade depended on a service-role key being present
-- in the browser to write notifications/flags for OTHER users. Without it,
-- RLS silently blocked those writes — leave saved, but nobody was notified
-- and no replacement flags were created.
--
-- This mirrors the existing notify_on_job_* triggers (SECURITY DEFINER) so
-- the cascade always runs with elevated privileges regardless of who is
-- logged in. The client no longer needs to create notifications or flags.
-- ════════════════════════════════════════════════════════════════════════

-- Day-of-week helper: does a date match a job's job_days filter?
CREATE OR REPLACE FUNCTION public.date_matches_job_days(p_date DATE, p_job_days TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_dow INT := EXTRACT(DOW FROM p_date);  -- 0=Sun..6=Sat
  v_is_weekend BOOLEAN := (v_dow = 0 OR v_dow = 6);
BEGIN
  IF p_job_days = 'weekdays_only' THEN RETURN NOT v_is_weekend; END IF;
  IF p_job_days = 'weekends_only' THEN RETURN v_is_weekend; END IF;
  RETURN TRUE;  -- weekdays_and_weekends or null
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 1. NOTIFY APPROVERS when a leave is created (pending) ──
CREATE OR REPLACE FUNCTION public.notify_on_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  v_name        TEXT;
  v_type        TEXT;
  v_approver    TEXT;
  v_dur_label   TEXT;
BEGIN
  SELECT user_name, user_type INTO v_name, v_type
  FROM public.users WHERE id = NEW.requester_id;

  -- helper's leave → supervisors; supervisor's leave → admins
  v_approver := CASE WHEN v_type = 'supervisor' THEN 'admin' ELSE 'supervisor' END;

  v_dur_label := CASE NEW.duration
    WHEN 'first_half'  THEN 'Morning'
    WHEN 'second_half' THEN 'Afternoon'
    ELSE 'Full Day' END;

  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, delivery_channels)
  SELECT u.id, 'Leave Request',
         COALESCE(v_name, 'A team member') || ' requested leave on '
           || NEW.leave_date || ' (' || v_dur_label || ').',
         'leave_request', ARRAY['in_app']
  FROM public.users u
  WHERE u.user_type = v_approver AND u.is_active = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_leave_request ON public.leave_requests;
CREATE TRIGGER trg_notify_leave_request
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_leave_request();

-- ── 2. CASCADE when a leave is APPROVED ──
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
BEGIN
  -- Only act on the pending → approved transition
  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Notify the requester their leave was approved
  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, delivery_channels)
  VALUES (NEW.requester_id, 'Leave Approved',
          'Your leave on ' || NEW.leave_date || ' has been approved.',
          'leave_approved', ARRAY['in_app']);

  SELECT user_name INTO v_absent_name FROM public.users WHERE id = NEW.requester_id;

  -- Leave time window
  v_lstart := CASE NEW.duration WHEN 'second_half' THEN TIME '13:00' ELSE TIME '00:00' END;
  v_lend   := CASE NEW.duration
                WHEN 'first_half'  THEN TIME '13:00'
                WHEN 'second_half' THEN TIME '18:00'
                ELSE TIME '23:59' END;

  -- Walk the absent worker's active jobs
  FOR r_job IN
    SELECT j.*
    FROM public.jobs j
    JOIN public.job_associated_users jau ON jau.job_id = j.id
    WHERE jau.user_id = NEW.requester_id
      AND jau.role IN ('helper', 'supervisor')
      AND j.status NOT IN ('job_closed', 'cancelled', 'payment_confirmed')
  LOOP
    -- Is the job scheduled on the leave date?
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

    -- Time overlap check
    v_jstart := COALESCE(r_job.job_start_time, TIME '00:00');
    v_jend   := COALESCE(r_job.job_end_time, TIME '23:59');
    IF NOT (v_lstart < v_jend AND v_jstart < v_lend) THEN CONTINUE; END IF;

    -- Create the replacement flag (idempotent)
    INSERT INTO public.job_replacement_flags
      (job_id, flag_date, absent_user_id, leave_request_id)
    VALUES (r_job.id, NEW.leave_date, NEW.requester_id, NEW.id)
    ON CONFLICT (job_id, flag_date, absent_user_id) DO NOTHING;

    -- Notify the customer (helpee) on the job
    INSERT INTO public.notifications
      (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
    SELECT jau.user_id, 'Worker Unavailable',
           COALESCE(v_absent_name, 'A worker') || ' is unavailable on '
             || NEW.leave_date || ' for "' || r_job.job_name
             || '". We are assigning a replacement worker to ensure your service continues.',
           'replacement_needed', r_job.id, ARRAY['in_app']
    FROM public.job_associated_users jau
    WHERE jau.job_id = r_job.id AND jau.role = 'helpee';

    -- Notify internal team (admins + supervisors)
    INSERT INTO public.notifications
      (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
    SELECT u.id, 'Replacement Needed',
           COALESCE(v_absent_name, 'A worker') || ' is on leave ' || NEW.leave_date
             || '. Job "' || r_job.job_name || '" needs a replacement worker.',
           'replacement_needed', r_job.id, ARRAY['in_app']
    FROM public.users u
    WHERE u.user_type IN ('admin', 'supervisor') AND u.is_active = TRUE;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cascade_leave_approved ON public.leave_requests;
CREATE TRIGGER trg_cascade_leave_approved
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.cascade_on_leave_approved();

-- ── 3. NOTIFY requester on REJECTION ──
CREATE OR REPLACE FUNCTION public.notify_on_leave_rejected()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    INSERT INTO public.notifications
      (recipient_user_id, title, message, notification_type, delivery_channels)
    VALUES (NEW.requester_id, 'Leave Rejected',
            'Your leave on ' || NEW.leave_date || ' was rejected'
              || COALESCE(': ' || NEW.review_note, '.'),
            'leave_rejected', ARRAY['in_app']);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_leave_rejected ON public.leave_requests;
CREATE TRIGGER trg_notify_leave_rejected
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_leave_rejected();

-- ── 4. NOTIFY when a replacement is ASSIGNED (flag filled) ──
CREATE OR REPLACE FUNCTION public.notify_on_replacement_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_job_name TEXT;
  v_repl_name TEXT;
BEGIN
  -- Only when replacement_user_id transitions from null to set
  IF NEW.replacement_user_id IS NULL OR OLD.replacement_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT job_name INTO v_job_name FROM public.jobs WHERE id = NEW.job_id;
  SELECT user_name INTO v_repl_name FROM public.users WHERE id = NEW.replacement_user_id;

  -- Notify the customer (helpee) on the job
  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
  SELECT jau.user_id, 'Replacement Assigned',
         'Update for "' || COALESCE(v_job_name, 'your job') || '": '
           || COALESCE(v_repl_name, 'A replacement worker')
           || ' has been assigned to cover during the absence on ' || NEW.flag_date || '.',
         'replacement_assigned', NEW.job_id, ARRAY['in_app']
  FROM public.job_associated_users jau
  WHERE jau.job_id = NEW.job_id AND jau.role = 'helpee';

  -- Notify the replacement worker
  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
  VALUES (NEW.replacement_user_id, 'New Assignment',
          'You have been assigned to cover "' || COALESCE(v_job_name, 'a job')
            || '" on ' || NEW.flag_date || '.',
          'job_assigned', NEW.job_id, ARRAY['in_app']);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_replacement_assigned ON public.job_replacement_flags;
CREATE TRIGGER trg_notify_replacement_assigned
  AFTER UPDATE ON public.job_replacement_flags
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_replacement_assigned();
