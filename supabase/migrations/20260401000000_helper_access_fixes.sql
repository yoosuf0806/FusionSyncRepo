-- =====================================================================
-- Migration: Helper access fixes + invoice attachment column
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================================

-- 1. Add attachment_url column to invoices (safe to run multiple times)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Create invoice-attachments storage bucket (public so URLs work directly)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-attachments', 'invoice-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for invoice-attachments bucket
DROP POLICY IF EXISTS "invoice_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "invoice_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "invoice_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "invoice_attachments_delete" ON storage.objects;

CREATE POLICY "invoice_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-attachments');

CREATE POLICY "invoice_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-attachments');

CREATE POLICY "invoice_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoice-attachments');

CREATE POLICY "invoice_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoice-attachments');

-- 4–6. Helper access WITHOUT querying job_associated_users inside RLS (avoids infinite recursion)
--    See 20260402000000_fix_jau_rls_recursion.sql for the same logic in a standalone patch.

DROP POLICY IF EXISTS "helpers_view_all_job_associated_users" ON public.job_associated_users;
DROP POLICY IF EXISTS "helpers_view_job_question_answers" ON public.job_question_answers;
DROP POLICY IF EXISTS "helpers_update_job_status" ON public.jobs;

CREATE OR REPLACE FUNCTION public.is_helper_for_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_associated_users jau
    WHERE jau.job_id = p_job_id
      AND jau.user_id = public.auth_user_id()
      AND jau.role = 'helper'
  );
$$;

REVOKE ALL ON FUNCTION public.is_helper_for_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_helper_for_job(uuid) TO authenticated;

CREATE POLICY "helpers_view_all_job_associated_users"
  ON public.job_associated_users FOR SELECT TO authenticated
  USING (public.is_helper_for_job(job_id));

CREATE POLICY "helpers_view_job_question_answers"
  ON public.job_question_answers FOR SELECT TO authenticated
  USING (public.auth_user_type() = 'helper' AND public.is_helper_for_job(job_id));

CREATE POLICY "helpers_update_job_status"
  ON public.jobs FOR UPDATE TO authenticated
  USING (public.auth_user_type() = 'helper' AND public.is_helper_for_job(id))
  WITH CHECK (public.auth_user_type() = 'helper' AND public.is_helper_for_job(id));
v