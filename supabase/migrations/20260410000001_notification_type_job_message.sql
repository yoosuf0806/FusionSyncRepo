-- ============================================================
-- Add 'job_message' to notification_type CHECK constraint
-- and update status-change trigger to always notify helpee
-- ============================================================

-- 1. Drop the old CHECK constraint and re-add with job_message included
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'job_assigned', 'status_update', 'payment',
    'remark_added', 'general', 'job_message'
  ));

-- 2. Update notify_on_job_status_change to explicitly include helpee
--    (the existing trigger already covers job_associated_users which includes helpee,
--     and also job_requester_id — so this is a safety re-confirm with no logic change)
CREATE OR REPLACE FUNCTION public.notify_on_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
  rec       RECORD;
  v_title   VARCHAR(255);
  v_message TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_title   := 'Job Status Updated';
    v_message := 'Job ' || NEW.job_id || ' status changed to: '
                 || REPLACE(NEW.status, '_', ' ');

    -- Notify everyone in job_associated_users (includes helpee, helper, supervisor)
    FOR rec IN
      SELECT DISTINCT user_id FROM public.job_associated_users WHERE job_id = NEW.id
    LOOP
      INSERT INTO public.notifications
        (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
      VALUES
        (rec.user_id, v_title, v_message, 'status_update', NEW.id, ARRAY['in_app'])
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Also notify job_requester_id if not already in jau (e.g. helpee who isn't in jau yet)
    IF NEW.job_requester_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = NEW.id AND user_id = NEW.job_requester_id
    ) THEN
      INSERT INTO public.notifications
        (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
      VALUES
        (NEW.job_requester_id, v_title, v_message, 'status_update', NEW.id, ARRAY['in_app'])
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
