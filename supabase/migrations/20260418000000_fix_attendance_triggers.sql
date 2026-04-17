-- ============================================================
-- Fix attendance triggers:
-- 1. Stop auto-creating rows without helper_id (orphan rows)
-- 2. Only set rate_for_day when check-in/out times are filled
-- 3. Document: delete orphan rows with helper_id IS NULL
-- ============================================================

-- Fix 1: Disable auto row creation — helpers create their own rows on submit
CREATE OR REPLACE FUNCTION public.auto_create_attendance_rows()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.regenerate_attendance_rows()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Only set rate_for_day when times are actually filled
CREATE OR REPLACE FUNCTION public.calculate_attendance_rate_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_pricing    VARCHAR(10);
  v_daily_rate DECIMAL(10,2);
  v_hrly_rate  DECIMAL(10,2);
BEGIN
  SELECT j.pricing_structure, js.daily_rate, js.hourly_rate
  INTO v_pricing, v_daily_rate, v_hrly_rate
  FROM public.jobs j
  LEFT JOIN public.job_specifications js ON j.job_type_id = js.id
  WHERE j.id = NEW.job_id;

  IF v_pricing = 'hourly' AND NEW.total_hours IS NOT NULL THEN
    NEW.rate_for_day := ROUND(NEW.total_hours * COALESCE(v_hrly_rate, 0), 2);
  ELSIF v_pricing = 'daily'
    AND NEW.check_in_time IS NOT NULL
    AND NEW.check_out_time IS NOT NULL THEN
    NEW.rate_for_day := COALESCE(v_daily_rate, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix 3: Remove orphan rows (no helper_id = created by old trigger)
DELETE FROM public.job_attendance WHERE helper_id IS NULL;
