-- =====================================================================
-- Change Orders 1–4 — 2026-03-22
-- CO1: Remove customer_basis/pricing_structure from business_setup
-- CO2: Job redesign (one-time vs frequent), attendance overhaul
-- CO3: Job spec pricing (daily_rate, hourly_rate)
-- CO4: Auto-assign supervisor creator trigger
-- =====================================================================

-- ── CO1: Remove fields from business_setup ───────────────────────────
ALTER TABLE public.business_setup
  DROP COLUMN IF EXISTS customer_basis,
  DROP COLUMN IF EXISTS pricing_structure;

-- ── CO2: New columns on jobs table ───────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_date          DATE,
  ADD COLUMN IF NOT EXISTS job_end_time      TIME,
  ADD COLUMN IF NOT EXISTS pricing_structure VARCHAR(10)
    CHECK (pricing_structure IN ('hourly', 'daily'));

-- ── CO2: New columns on job_attendance table ─────────────────────────
ALTER TABLE public.job_attendance
  ADD COLUMN IF NOT EXISTS job_start_time    TIME,
  ADD COLUMN IF NOT EXISTS job_end_time      TIME,
  ADD COLUMN IF NOT EXISTS check_in_time     TIME,
  ADD COLUMN IF NOT EXISTS check_out_time    TIME,
  ADD COLUMN IF NOT EXISTS total_hours       DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS rate_for_day      DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS att_status        VARCHAR(20) DEFAULT 'pending_approval'
    CHECK (att_status IN ('pending_approval','approved','rejected','resubmitted')),
  ADD COLUMN IF NOT EXISTS submitted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by       UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS resubmitted_at    TIMESTAMPTZ;

-- ── CO3: Rate fields on job_specifications ───────────────────────────
ALTER TABLE public.job_specifications
  ADD COLUMN IF NOT EXISTS daily_rate   DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS hourly_rate  DECIMAL(10,2) DEFAULT 0.00;

-- ── CO2: Trigger — auto-calculate total_hours ────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_attendance_hours_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
    NEW.total_hours := ROUND(
      CAST(EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0 AS DECIMAL(5,2)),
      2
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_hours_v2 ON public.job_attendance;
CREATE TRIGGER trigger_calc_hours_v2
BEFORE INSERT OR UPDATE OF check_in_time, check_out_time
ON public.job_attendance
FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_hours_v2();

-- ── CO3: Trigger — auto-calculate rate_for_day ───────────────────────
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
  ELSIF v_pricing = 'daily' THEN
    NEW.rate_for_day := COALESCE(v_daily_rate, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_rate_v2 ON public.job_attendance;
CREATE TRIGGER trigger_calc_rate_v2
BEFORE INSERT OR UPDATE OF total_hours
ON public.job_attendance
FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_rate_v2();

-- ── CO4: Trigger — auto-assign supervisor creator ─────────────────────
CREATE OR REPLACE FUNCTION public.auto_assign_supervisor_creator()
RETURNS TRIGGER AS $$
DECLARE
  v_type VARCHAR(20);
BEGIN
  SELECT user_type INTO v_type FROM public.users WHERE id = NEW.job_requester_id;
  IF v_type = 'supervisor' THEN
    INSERT INTO public.job_associated_users (job_id, user_id, role)
    VALUES (NEW.id, NEW.job_requester_id, 'supervisor')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_assign_supervisor ON public.jobs;
CREATE TRIGGER trigger_auto_assign_supervisor
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_supervisor_creator();
