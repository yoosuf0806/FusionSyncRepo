-- ============================================================
-- Migration: user_job_types junction table
-- Allows a helper (or any user) to be associated with
-- multiple job specification types.
-- ============================================================

-- ── 1. Create junction table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_job_types (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_type_id   UUID        NOT NULL REFERENCES public.job_specifications(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_type_id)
);

-- ── 2. RLS ────────────────────────────────────────────────────
ALTER TABLE public.user_job_types ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "ujt_admin_all" ON public.user_job_types
  AS PERMISSIVE FOR ALL TO authenticated
  USING  (public.auth_user_type() = 'admin')
  WITH CHECK (public.auth_user_type() = 'admin');

-- Supervisor: read all, write all (they manage helpers)
CREATE POLICY "ujt_supervisor_all" ON public.user_job_types
  AS PERMISSIVE FOR ALL TO authenticated
  USING  (public.auth_user_type() = 'supervisor')
  WITH CHECK (public.auth_user_type() = 'supervisor');

-- Helper / helpee: read own rows only
CREATE POLICY "ujt_self_select" ON public.user_job_types
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.auth_user_type() IN ('helper', 'helpee')
    AND user_id = public.auth_user_id()
  );

-- ── 3. Index for fast lookups ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_job_types_user_id
  ON public.user_job_types(user_id);
