-- ════════════════════════════════════════════════════════════════════════
-- Phase 1b: Schedule-based invoice calculation
-- ════════════════════════════════════════════════════════════════════════
-- Adds job_end_time and job_days fields to enable man-hour calculation:
--
--   working_days = count of dates in [job_from_date ... job_to_date]
--                  matching job_days filter
--   daily_hours = job_end_time - job_start_time
--   man_hours = working_days × daily_hours × number_of_workers
--   invoice_amount = man_hours × rate_per_hour (or daily_hours × rate_per_day)
--
-- Decisions locked:
--   • Invoicing based on SCHEDULED hours, not approved attendance
--   • job_days determines which days count (weekdays only / weekends only / both)
--   • Both one-time and recurring jobs use the same calculation
--   • amount_paid tracks partial payments separately; job status drives "spent" label
-- ════════════════════════════════════════════════════════════════════════

-- 1. Add job_end_time field (required for man-hour calculation)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_end_time TIME;

-- 2. Add job_days field (required for working day count)
--    LOV: 'weekdays_only' | 'weekends_only' | 'weekdays_and_weekends'
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_days VARCHAR(30)
    NOT NULL DEFAULT 'weekdays_and_weekends'
    CHECK (job_days IN ('weekdays_only', 'weekends_only', 'weekdays_and_weekends'));

-- 3. Convenience function: count working days in a date range matching job_days filter
CREATE OR REPLACE FUNCTION public.count_working_days(
  p_from_date DATE,
  p_to_date DATE,
  p_job_days VARCHAR(30)
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_current_date DATE;
BEGIN
  v_current_date := p_from_date;
  WHILE v_current_date <= p_to_date LOOP
    -- Check if this day matches the job_days filter
    -- 1 = Monday, 7 = Sunday (ISO 8601)
    IF p_job_days = 'weekdays_only' AND EXTRACT(ISODOW FROM v_current_date) < 6 THEN
      v_count := v_count + 1;
    ELSIF p_job_days = 'weekends_only' AND EXTRACT(ISODOW FROM v_current_date) >= 6 THEN
      v_count := v_count + 1;
    ELSIF p_job_days = 'weekdays_and_weekends' THEN
      v_count := v_count + 1;
    END IF;
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Convenience function: calculate man-hours for a job
--    (used by invoice calculation and reporting)
CREATE OR REPLACE FUNCTION public.calc_job_man_hours(
  p_job_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  v_job_record RECORD;
  v_working_days INTEGER;
  v_daily_hours DECIMAL;
  v_worker_count INTEGER;
  v_man_hours DECIMAL;
BEGIN
  -- Fetch job details
  SELECT
    j.job_from_date, j.job_to_date, j.job_start_time, j.job_end_time, j.job_days
  INTO v_job_record
  FROM public.jobs j
  WHERE j.id = p_job_id;

  IF v_job_record IS NULL THEN
    RETURN 0;
  END IF;

  -- If any required field is missing, return 0
  IF v_job_record.job_from_date IS NULL
     OR v_job_record.job_to_date IS NULL
     OR v_job_record.job_start_time IS NULL
     OR v_job_record.job_end_time IS NULL THEN
    RETURN 0;
  END IF;

  -- Count working days matching job_days filter
  v_working_days := public.count_working_days(
    v_job_record.job_from_date,
    v_job_record.job_to_date,
    v_job_record.job_days
  );

  -- Calculate daily hours
  v_daily_hours := EXTRACT(EPOCH FROM (v_job_record.job_end_time - v_job_record.job_start_time)) / 3600.0;

  -- Count workers assigned to this job
  SELECT COUNT(*) INTO v_worker_count
  FROM public.job_associated_users
  WHERE job_id = p_job_id AND role = 'helper';

  -- If no workers assigned, use 1 (default)
  IF v_worker_count = 0 THEN
    v_worker_count := 1;
  END IF;

  -- man_hours = working_days × daily_hours × worker_count
  v_man_hours := v_working_days * v_daily_hours * v_worker_count;

  RETURN COALESCE(v_man_hours, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Helper function: calculate invoice amount for a job based on its schedule
--    Returns the computed amount (not stored; called on invoice creation/update)
CREATE OR REPLACE FUNCTION public.calc_invoice_amount_from_job(
  p_job_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  v_man_hours DECIMAL;
  v_hourly_rate DECIMAL;
  v_daily_rate DECIMAL;
  v_invoice_amount DECIMAL;
  v_job_spec_id UUID;
BEGIN
  -- Get the job's spec (contains rates)
  SELECT job_type_id INTO v_job_spec_id
  FROM public.jobs
  WHERE id = p_job_id;

  IF v_job_spec_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate man-hours
  v_man_hours := public.calc_job_man_hours(p_job_id);

  -- Try hourly rate first (hourly_rate × man_hours)
  SELECT hourly_rate INTO v_hourly_rate
  FROM public.job_specifications
  WHERE id = v_job_spec_id;

  IF v_hourly_rate IS NOT NULL AND v_hourly_rate > 0 THEN
    v_invoice_amount := v_man_hours * v_hourly_rate;
  ELSE
    -- Fall back to daily rate (daily_rate × number_of_working_days × number_of_workers)
    SELECT daily_rate INTO v_daily_rate
    FROM public.job_specifications
    WHERE id = v_job_spec_id;

    IF v_daily_rate IS NOT NULL AND v_daily_rate > 0 THEN
      -- daily_rate is typically per worker per day
      -- This is simplified; adjust if your rate model is different
      v_invoice_amount := v_man_hours * v_daily_rate / 8;  -- assumes 8-hour work day
    ELSE
      RETURN NULL;  -- No rate configured
    END IF;
  END IF;

  RETURN ROUND(COALESCE(v_invoice_amount, 0), 2);
END;
$$ LANGUAGE plpgsql STABLE;
