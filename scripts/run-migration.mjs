import pg from 'pg'
import dns from 'dns'

const { Client } = pg
dns.setDefaultResultOrder('ipv4first')

// Try multiple connection configs
const configs = [
  {
    label: 'Pooler session IPv4',
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 5432,
    user: 'postgres.asusrhebwmictwzrbumr',
    password: 'HelpingHands@123',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  },
  {
    label: 'Pooler txn mode',
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 6543,
    user: 'postgres.asusrhebwmictwzrbumr',
    password: 'HelpingHands@123',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  },
]

const statements = [
  `ALTER TABLE public.business_setup DROP COLUMN IF EXISTS customer_basis, DROP COLUMN IF EXISTS pricing_structure`,
  `ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_date DATE`,
  `ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_end_time TIME`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='jobs' AND column_name='pricing_structure'
    ) THEN
      ALTER TABLE public.jobs ADD COLUMN pricing_structure VARCHAR(10) CHECK (pricing_structure IN ('hourly','daily'));
    END IF;
  END $$`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS job_start_time TIME`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS job_end_time TIME`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS check_in_time TIME`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS check_out_time TIME`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS total_hours DECIMAL(5,2)`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS rate_for_day DECIMAL(10,2)`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='job_attendance' AND column_name='att_status'
    ) THEN
      ALTER TABLE public.job_attendance ADD COLUMN att_status VARCHAR(20) DEFAULT 'pending_approval'
        CHECK (att_status IN ('pending_approval','approved','rejected','resubmitted'));
    END IF;
  END $$`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
  `ALTER TABLE public.job_attendance ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ`,
  `ALTER TABLE public.job_specifications ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2) DEFAULT 0.00`,
  `ALTER TABLE public.job_specifications ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0.00`,
  `CREATE OR REPLACE FUNCTION public.calculate_attendance_hours_v2()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  BEGIN
    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
      NEW.total_hours := ROUND(
        CAST(EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0 AS DECIMAL(5,2)), 2
      );
    END IF;
    RETURN NEW;
  END;
  $fn$`,
  `DROP TRIGGER IF EXISTS trigger_calc_hours_v2 ON public.job_attendance`,
  `CREATE TRIGGER trigger_calc_hours_v2
   BEFORE INSERT OR UPDATE OF check_in_time, check_out_time
   ON public.job_attendance FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_hours_v2()`,
  `CREATE OR REPLACE FUNCTION public.calculate_attendance_rate_v2()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  DECLARE
    v_pricing VARCHAR(10); v_daily DECIMAL(10,2); v_hrly DECIMAL(10,2);
  BEGIN
    SELECT j.pricing_structure, js.daily_rate, js.hourly_rate
    INTO v_pricing, v_daily, v_hrly
    FROM public.jobs j LEFT JOIN public.job_specifications js ON j.job_type_id = js.id
    WHERE j.id = NEW.job_id;
    IF v_pricing = 'hourly' AND NEW.total_hours IS NOT NULL THEN
      NEW.rate_for_day := ROUND(NEW.total_hours * COALESCE(v_hrly, 0), 2);
    ELSIF v_pricing = 'daily' THEN
      NEW.rate_for_day := COALESCE(v_daily, 0);
    END IF;
    RETURN NEW;
  END;
  $fn$`,
  `DROP TRIGGER IF EXISTS trigger_calc_rate_v2 ON public.job_attendance`,
  `CREATE TRIGGER trigger_calc_rate_v2
   BEFORE INSERT OR UPDATE OF total_hours ON public.job_attendance
   FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_rate_v2()`,
  `CREATE OR REPLACE FUNCTION public.auto_assign_supervisor_creator()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  DECLARE v_type VARCHAR(20);
  BEGIN
    SELECT user_type INTO v_type FROM public.users WHERE id = NEW.job_requester_id;
    IF v_type = 'supervisor' THEN
      INSERT INTO public.job_associated_users (job_id, user_id, role)
      VALUES (NEW.id, NEW.job_requester_id, 'supervisor') ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END;
  $fn$`,
  `DROP TRIGGER IF EXISTS trigger_auto_assign_supervisor ON public.jobs`,
  `CREATE TRIGGER trigger_auto_assign_supervisor
   AFTER INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.auto_assign_supervisor_creator()`,
]

async function tryConnect(config) {
  const { label, ...opts } = config
  const client = new Client(opts)
  try {
    await client.connect()
    console.log(`Connected via: ${config.label}`)
    return client
  } catch (e) {
    console.log(`Failed ${config.label}: ${e.message}`)
    return null
  }
}

async function run() {
  let client = null
  for (const cfg of configs) {
    client = await tryConnect(cfg)
    if (client) break
  }
  if (!client) { console.error('Could not connect to any config'); process.exit(1) }

  let ok = 0, fail = 0
  for (const [i, sql] of statements.entries()) {
    const label = sql.trim().split('\n')[0].substring(0, 70)
    try {
      await client.query(sql)
      console.log(`  [OK] ${label}`)
      ok++
    } catch (e) {
      console.error(`  [ERR] ${label}\n    → ${e.message}`)
      fail++
    }
  }
  await client.end()
  console.log(`\nDone: ${ok} OK, ${fail} failed`)
}

run()
