-- =====================================================================
-- Enforce forward-only job status transitions at the DB level.
-- A status can only move forward in the defined workflow order.
-- Prevents UI bypasses and direct API calls from going backwards.
-- Run in Supabase Dashboard → SQL Editor
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_job_status_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_rank INT[] := ARRAY[
    1,  -- request_raised
    2,  -- manager_assigned
    3,  -- helper_assigned
    4,  -- job_started
    5,  -- job_finished
    6,  -- payment_confirmed
    7   -- job_closed
  ];
  status_list TEXT[] := ARRAY[
    'request_raised',
    'manager_assigned',
    'helper_assigned',
    'job_started',
    'job_finished',
    'payment_confirmed',
    'job_closed'
  ];
  old_rank INT;
  new_rank INT;
  i INT;
BEGIN
  -- Resolve ranks
  old_rank := 0;
  new_rank := 0;
  FOR i IN 1..array_length(status_list, 1) LOOP
    IF status_list[i] = OLD.status THEN old_rank := i; END IF;
    IF status_list[i] = NEW.status THEN new_rank := i; END IF;
  END LOOP;

  -- If status is unknown (rank 0), allow the change
  IF old_rank = 0 OR new_rank = 0 THEN
    RETURN NEW;
  END IF;

  -- Block backward transitions
  IF new_rank < old_rank THEN
    RAISE EXCEPTION 'Job status cannot go backwards: % → %', OLD.status, NEW.status;
  END IF;

  -- Block re-setting the same status (no-op that could confuse clients)
  -- Actually allow same status (idempotent) — just block backward
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_status_forward_only ON public.jobs;
CREATE TRIGGER trg_job_status_forward_only
  BEFORE UPDATE OF status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_job_status_order();
