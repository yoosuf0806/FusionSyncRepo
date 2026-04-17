-- ============================================================
-- HELPING HANDS — PRODUCTION DATABASE SCHEMA
-- Version: 1.0 CONFIRMED | Date: 2026-03-12
-- Execute in: Supabase → SQL Editor → New Query
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- SECTION 1: EXTENSIONS & SEQUENCES
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SEQUENCE IF NOT EXISTS public.seq_users       START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_departments START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_job_specs   START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_jobs        START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_invoices    START 1 INCREMENT 1;


-- ════════════════════════════════════════════════════════════
-- SECTION 2: TABLE CREATION (correct dependency order)
-- ════════════════════════════════════════════════════════════

-- ── TABLE 1: departments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id       VARCHAR(50)  UNIQUE NOT NULL,
  department_name     VARCHAR(150) NOT NULL,
  department_location VARCHAR(255) NOT NULL,
  department_address  TEXT         NOT NULL,
  currency            VARCHAR(10)  CHECK (currency IS NULL OR LENGTH(currency) BETWEEN 2 AND 5),
  customer_basis      VARCHAR(20)  CHECK (customer_basis IN ('one-time','recurring','corporate','all')),
  pricing_structure   VARCHAR(20)  CHECK (pricing_structure IN ('quotation','hourly','daily')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── TABLE 2: job_specifications ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_specifications (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type_id   VARCHAR(50)  UNIQUE NOT NULL,
  job_type_name VARCHAR(150) NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── TABLE 3: users ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  VARCHAR(50)  UNIQUE NOT NULL,
  user_type                VARCHAR(20)  NOT NULL
                             CHECK (user_type IN ('admin','supervisor','helper','helpee')),
  user_name                VARCHAR(100) NOT NULL,
  user_email               VARCHAR(255) UNIQUE NOT NULL
                             CHECK (user_email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
  user_phone               VARCHAR(20),
  department_id            UUID         NOT NULL
                             REFERENCES public.departments(id) ON DELETE RESTRICT,
  user_location            VARCHAR(255),
  preferred_job_type_id    UUID
                             REFERENCES public.job_specifications(id) ON DELETE SET NULL,
  profile_image_url        TEXT,
  notification_preferences JSONB        NOT NULL
                             DEFAULT '{"in_app": true, "email": true, "sms": false}'::JSONB,
  auth_user_id             UUID         UNIQUE
                             REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active                BOOLEAN      NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── TABLE 4: business_setup ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_setup (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name     VARCHAR(200),
  business_address  TEXT,
  business_reg_id   VARCHAR(100),
  currency          VARCHAR(10) CHECK (currency IS NULL OR LENGTH(currency) BETWEEN 2 AND 5),
  customer_basis    VARCHAR(20) CHECK (customer_basis IN ('one-time','recurring','corporate','all')),
  pricing_structure VARCHAR(20) CHECK (pricing_structure IN ('quotation','hourly','daily')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLE 5: department_users ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.department_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID        NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, user_id)
);

-- ── TABLE 6: job_spec_questions ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_spec_questions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_spec_id    UUID        NOT NULL REFERENCES public.job_specifications(id) ON DELETE CASCADE,
  question_text  TEXT        NOT NULL,
  question_order INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLE 7: jobs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           VARCHAR(50) UNIQUE NOT NULL,
  job_type_id      UUID        REFERENCES public.job_specifications(id) ON DELETE RESTRICT,
  department_id    UUID        REFERENCES public.departments(id) ON DELETE SET NULL,
  job_category     VARCHAR(20) NOT NULL CHECK (job_category IN ('one-time','frequent')),
  job_name         VARCHAR(200) NOT NULL,
  job_description  TEXT,
  job_from_date    DATE,
  job_to_date      DATE,
  job_start_time   TIME,
  job_location     VARCHAR(255),
  job_requester_id UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'request_raised'
                     CHECK (status IN (
                       'request_raised','manager_assigned','helper_assigned',
                       'job_started','job_finished','payment_confirmed','job_closed'
                     )),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_job_dates CHECK (
    job_to_date IS NULL OR job_from_date IS NULL OR job_to_date >= job_from_date
  )
);

-- ── TABLE 8: job_question_answers ────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_question_answers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  question_id UUID        NOT NULL REFERENCES public.job_spec_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, question_id)
);

-- ── TABLE 9: job_associated_users ────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_associated_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  role       VARCHAR(20) NOT NULL CHECK (role IN ('helpee','helper','supervisor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, user_id)
);

-- ── TABLE 10: invoices ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id                     UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                 UUID           NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  invoice_number         VARCHAR(50)    UNIQUE,
  invoice_status         VARCHAR(20)    NOT NULL DEFAULT 'draft'
                           CHECK (invoice_status IN ('draft','sent','paid','void')),
  amount                 DECIMAL(10,2)  CHECK (amount IS NULL OR amount > 0),
  currency               VARCHAR(10),
  invoice_date           DATE,
  notes                  TEXT,
  invoice_attachment_url TEXT,
  created_by             UUID           REFERENCES public.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── TABLE 11: job_attendance ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_attendance (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  helpee_id       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  attendance_date DATE        NOT NULL,
  remark          TEXT,
  in_time         TIME,
  out_time        TIME,
  submitted_by    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, attendance_date)
);

-- ── TABLE 12: job_remarks ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_remarks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  helpee_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  rating      INTEGER     CHECK (rating BETWEEN 1 AND 5),
  remark_text TEXT        CHECK (remark_text IS NULL OR LENGTH(remark_text) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, helpee_id)
);

-- ── TABLE 13: job_status_history ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  previous_status VARCHAR(30),
  new_status      VARCHAR(30) NOT NULL,
  changed_by      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLE 14: notifications ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title             VARCHAR(255) NOT NULL,
  message           TEXT,
  is_read           BOOLEAN     NOT NULL DEFAULT false,
  notification_type VARCHAR(50)
                      CHECK (notification_type IN (
                        'job_assigned','status_update','payment','remark_added','general'
                      )),
  related_job_id    UUID        REFERENCES public.jobs(id) ON DELETE SET NULL,
  delivery_channels TEXT[]      NOT NULL DEFAULT ARRAY['in_app'],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════
-- SECTION 3: PERFORMANCE INDEXES
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_user_type           ON public.users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_department_id       ON public.users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id        ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active           ON public.users(is_active);

CREATE INDEX IF NOT EXISTS idx_jobs_status               ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_job_category         ON public.jobs(job_category);
CREATE INDEX IF NOT EXISTS idx_jobs_job_requester_id     ON public.jobs(job_requester_id);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type_id          ON public.jobs(job_type_id);
CREATE INDEX IF NOT EXISTS idx_jobs_department_id        ON public.jobs(department_id);
CREATE INDEX IF NOT EXISTS idx_jobs_from_date            ON public.jobs(job_from_date);

CREATE INDEX IF NOT EXISTS idx_jau_job_id                ON public.job_associated_users(job_id);
CREATE INDEX IF NOT EXISTS idx_jau_user_id               ON public.job_associated_users(user_id);
CREATE INDEX IF NOT EXISTS idx_jau_role                  ON public.job_associated_users(role);

CREATE INDEX IF NOT EXISTS idx_attendance_job_id         ON public.job_attendance(job_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date           ON public.job_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_helpee_id      ON public.job_attendance(helpee_id);

CREATE INDEX IF NOT EXISTS idx_remarks_job_id            ON public.job_remarks(job_id);
CREATE INDEX IF NOT EXISTS idx_remarks_helpee_id         ON public.job_remarks(helpee_id);

CREATE INDEX IF NOT EXISTS idx_jsh_job_id                ON public.job_status_history(job_id);
CREATE INDEX IF NOT EXISTS idx_jsh_changed_at            ON public.job_status_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_recipient           ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_is_read             ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created_at          ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_job_id           ON public.invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status           ON public.invoices(invoice_status);


-- ════════════════════════════════════════════════════════════
-- SECTION 4: TRIGGER FUNCTIONS
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.user_id = '' THEN
    NEW.user_id := 'USR-' || LPAD(nextval('public.seq_users')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_department_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.department_id IS NULL OR NEW.department_id = '' THEN
    NEW.department_id := 'DEPT-' || LPAD(nextval('public.seq_departments')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_job_type_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_type_id IS NULL OR NEW.job_type_id = '' THEN
    NEW.job_type_id := 'JT-' || LPAD(nextval('public.seq_job_specs')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_job_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_id IS NULL OR NEW.job_id = '' THEN
    NEW.job_id := 'JOB-' || LPAD(nextval('public.seq_jobs')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('public.seq_invoices')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.auto_create_attendance_rows()
RETURNS TRIGGER AS $$
DECLARE
  day_cursor DATE;
BEGIN
  IF NEW.job_category = 'frequent'
     AND NEW.job_from_date IS NOT NULL
     AND NEW.job_to_date   IS NOT NULL
     AND NEW.job_to_date >= NEW.job_from_date THEN

    day_cursor := NEW.job_from_date;
    WHILE day_cursor <= NEW.job_to_date LOOP
      INSERT INTO public.job_attendance (job_id, attendance_date)
      VALUES (NEW.id, day_cursor)
      ON CONFLICT (job_id, attendance_date, helper_id) DO NOTHING;
      day_cursor := day_cursor + INTERVAL '1 day';
    END LOOP;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.regenerate_attendance_rows()
RETURNS TRIGGER AS $$
DECLARE
  day_cursor DATE;
BEGIN
  IF NEW.job_category = 'frequent'
     AND NEW.job_from_date IS NOT NULL
     AND NEW.job_to_date   IS NOT NULL
     AND NEW.job_to_date >= NEW.job_from_date THEN

    day_cursor := NEW.job_from_date;
    WHILE day_cursor <= NEW.job_to_date LOOP
      INSERT INTO public.job_attendance (job_id, attendance_date)
      VALUES (NEW.id, day_cursor)
      ON CONFLICT (job_id, attendance_date, helper_id) DO NOTHING;
      day_cursor := day_cursor + INTERVAL '1 day';
    END LOOP;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE auth_user_id = auth.uid()
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;

    INSERT INTO public.job_status_history (job_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, v_user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

    FOR rec IN
      SELECT user_id FROM public.job_associated_users WHERE job_id = NEW.id
    LOOP
      INSERT INTO public.notifications
        (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
      VALUES
        (rec.user_id, v_title, v_message, 'status_update', NEW.id, ARRAY['in_app']);
    END LOOP;

    IF NEW.job_requester_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = NEW.id AND user_id = NEW.job_requester_id
    ) THEN
      INSERT INTO public.notifications
        (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
      VALUES
        (NEW.job_requester_id, v_title, v_message, 'status_update', NEW.id, ARRAY['in_app']);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_on_job_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_job_display_id VARCHAR;
  v_role_label     VARCHAR;
BEGIN
  SELECT job_id INTO v_job_display_id
  FROM public.jobs WHERE id = NEW.job_id;

  v_role_label := CASE NEW.role
    WHEN 'helper'     THEN 'Helper'
    WHEN 'helpee'     THEN 'Client'
    WHEN 'supervisor' THEN 'Supervisor'
    ELSE NEW.role
  END;

  INSERT INTO public.notifications
    (recipient_user_id, title, message, notification_type, related_job_id, delivery_channels)
  VALUES (
    NEW.user_id,
    'You have been assigned to a job',
    'You have been assigned as ' || v_role_label
      || ' for job ' || COALESCE(v_job_display_id, NEW.job_id::TEXT),
    'job_assigned',
    NEW.job_id,
    ARRAY['in_app']
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.enforce_business_setup_singleton()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.business_setup) >= 1 THEN
    RAISE EXCEPTION
      'Only one business_setup record is allowed. Update the existing record instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════════════════
-- SECTION 5: TRIGGER BINDINGS
-- ════════════════════════════════════════════════════════════

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_job_specs_updated_at
  BEFORE UPDATE ON public.job_specifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_business_setup_updated_at
  BEFORE UPDATE ON public.business_setup
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_job_remarks_updated_at
  BEFORE UPDATE ON public.job_remarks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_generate_user_id
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.generate_user_id();

CREATE TRIGGER trg_generate_department_id
  BEFORE INSERT ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.generate_department_id();

CREATE TRIGGER trg_generate_job_type_id
  BEFORE INSERT ON public.job_specifications
  FOR EACH ROW EXECUTE FUNCTION public.generate_job_type_id();

CREATE TRIGGER trg_generate_job_id
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.generate_job_id();

CREATE TRIGGER trg_generate_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

CREATE TRIGGER trg_auto_attendance
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_attendance_rows();

CREATE TRIGGER trg_update_attendance_on_date_change
  AFTER UPDATE OF job_from_date, job_to_date ON public.jobs
  FOR EACH ROW
  WHEN (NEW.job_category = 'frequent')
  EXECUTE FUNCTION public.regenerate_attendance_rows();

CREATE TRIGGER trg_log_status_change
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.log_job_status_change();

CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_on_job_status_change();

CREATE TRIGGER trg_notify_on_assignment
  AFTER INSERT ON public.job_associated_users
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_job_assignment();

CREATE TRIGGER trg_business_setup_singleton
  BEFORE INSERT ON public.business_setup
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_setup_singleton();


-- ════════════════════════════════════════════════════════════
-- SECTION 6: ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auth_user_type()
RETURNS TEXT AS $$
  SELECT user_type FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_admin_all" ON public.departments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

CREATE POLICY "departments_others_select" ON public.departments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() IN ('supervisor','helper'));

ALTER TABLE public.job_specifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_specs_admin_supervisor_all" ON public.job_specifications
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

CREATE POLICY "job_specs_helper_select" ON public.job_specifications
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'helper');

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_admin_all" ON public.users
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

CREATE POLICY "users_supervisor_select_all" ON public.users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'supervisor');

CREATE POLICY "users_supervisor_update_non_admin" ON public.users
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.auth_user_type() = 'supervisor' AND user_type <> 'admin')
  WITH CHECK (public.auth_user_type() = 'supervisor' AND user_type <> 'admin');

CREATE POLICY "users_self_select" ON public.users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid()
         AND public.auth_user_type() IN ('helper','helpee'));

CREATE POLICY "users_self_update" ON public.users
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid()
         AND public.auth_user_type() IN ('helper','helpee'))
  WITH CHECK (auth_user_id = auth.uid()
              AND public.auth_user_type() IN ('helper','helpee'));

ALTER TABLE public.business_setup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_setup_admin_only" ON public.business_setup
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

ALTER TABLE public.department_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "department_users_admin_all" ON public.department_users
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

ALTER TABLE public.job_spec_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_spec_q_admin_supervisor_all" ON public.job_spec_questions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

CREATE POLICY "job_spec_q_helper_select" ON public.job_spec_questions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'helper');

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_admin_all" ON public.jobs
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

CREATE POLICY "jobs_supervisor_select" ON public.jobs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'supervisor');

CREATE POLICY "jobs_supervisor_insert" ON public.jobs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_type() = 'supervisor');

CREATE POLICY "jobs_supervisor_update" ON public.jobs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.auth_user_type() = 'supervisor')
  WITH CHECK (public.auth_user_type() = 'supervisor');

CREATE POLICY "jobs_helper_select_assigned" ON public.jobs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = jobs.id AND user_id = public.auth_user_id()
    )
  );

CREATE POLICY "jobs_helper_update_assigned" ON public.jobs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = jobs.id AND user_id = public.auth_user_id()
    )
  )
  WITH CHECK (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = jobs.id AND user_id = public.auth_user_id()
    )
  );

CREATE POLICY "jobs_helpee_select_own" ON public.jobs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = jobs.id AND user_id = public.auth_user_id()
    )
  );

ALTER TABLE public.job_question_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jqa_admin_supervisor_all" ON public.job_question_answers
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

CREATE POLICY "jqa_helper_select_assigned" ON public.job_question_answers
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_question_answers.job_id AND user_id = public.auth_user_id()
    )
  );

CREATE POLICY "jqa_helpee_select_own" ON public.job_question_answers
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_question_answers.job_id AND user_id = public.auth_user_id()
    )
  );

ALTER TABLE public.job_associated_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jau_admin_supervisor_all" ON public.job_associated_users
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

CREATE POLICY "jau_helper_helpee_select_own" ON public.job_associated_users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() IN ('helper','helpee')
    AND user_id = public.auth_user_id()
  );

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_admin_supervisor_all" ON public.invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

CREATE POLICY "invoices_helpee_select_own" ON public.invoices
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = invoices.job_id AND user_id = public.auth_user_id()
    )
  );

ALTER TABLE public.job_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_admin_supervisor_all" ON public.job_attendance
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() IN ('admin','supervisor'))
  WITH CHECK (public.auth_user_type() IN ('admin','supervisor'));

CREATE POLICY "attendance_helper_insert" ON public.job_attendance
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_attendance.job_id AND user_id = public.auth_user_id()
    )
  );

CREATE POLICY "attendance_helper_update" ON public.job_attendance
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_attendance.job_id AND user_id = public.auth_user_id()
    )
  )
  WITH CHECK (
    public.auth_user_type() = 'helper'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_attendance.job_id AND user_id = public.auth_user_id()
    )
  );

ALTER TABLE public.job_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "remarks_admin_all" ON public.job_remarks
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

CREATE POLICY "remarks_supervisor_select" ON public.job_remarks
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'supervisor');

CREATE POLICY "remarks_helper_select" ON public.job_remarks
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'helper');

CREATE POLICY "remarks_helpee_insert_own" ON public.job_remarks
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_type() = 'helpee'
    AND helpee_id = public.auth_user_id()
  );

CREATE POLICY "remarks_helpee_update_own" ON public.job_remarks
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND helpee_id = public.auth_user_id()
  )
  WITH CHECK (
    public.auth_user_type() = 'helpee'
    AND helpee_id = public.auth_user_id()
  );

ALTER TABLE public.job_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jsh_admin_all" ON public.job_status_history
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

CREATE POLICY "jsh_supervisor_helper_select" ON public.job_status_history
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.auth_user_type() IN ('supervisor','helper'));

CREATE POLICY "jsh_helpee_select_own" ON public.job_status_history
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() = 'helpee'
    AND EXISTS (
      SELECT 1 FROM public.job_associated_users
      WHERE job_id = job_status_history.job_id AND user_id = public.auth_user_id()
    )
  );

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_admin_all" ON public.notifications
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

CREATE POLICY "notifications_others_select_own" ON public.notifications
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() IN ('supervisor','helper','helpee')
    AND recipient_user_id = public.auth_user_id()
  );

CREATE POLICY "notifications_others_update_own" ON public.notifications
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.auth_user_type() IN ('supervisor','helper','helpee')
    AND recipient_user_id = public.auth_user_id()
  )
  WITH CHECK (
    public.auth_user_type() IN ('supervisor','helper','helpee')
    AND recipient_user_id = public.auth_user_id()
  );


-- ════════════════════════════════════════════════════════════
-- SECTION 7: STORAGE BUCKETS
-- ════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('profile-images',    'profile-images',    false),
  ('job-attachments',   'job-attachments',   false),
  ('invoice-documents', 'invoice-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "profile_images_own_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "profile_images_own_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "job_attachments_authenticated" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'job-attachments')
  WITH CHECK (bucket_id = 'job-attachments');

CREATE POLICY "invoice_docs_admin_supervisor" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'invoice-documents'
    AND public.auth_user_type() IN ('admin','supervisor')
  )
  WITH CHECK (
    bucket_id = 'invoice-documents'
    AND public.auth_user_type() IN ('admin','supervisor')
  );

CREATE POLICY "invoice_docs_helpee_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-documents'
    AND public.auth_user_type() = 'helpee'
  );


-- ════════════════════════════════════════════════════════════
-- VERIFICATION QUERY (run separately after execution)
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
-- Expected: 14 tables
-- ════════════════════════════════════════════════════════════
