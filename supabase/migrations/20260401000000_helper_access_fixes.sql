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

-- 4. Allow helpers to read ALL associated users for jobs they are assigned to
--    (Required for workflow display to show "Supervisor Assigned" as green)
DROP POLICY IF EXISTS "helpers_view_all_job_associated_users" ON job_associated_users;
CREATE POLICY "helpers_view_all_job_associated_users"
  ON job_associated_users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM job_associated_users my_row
      JOIN users u ON u.auth_user_id = auth.uid()
      WHERE my_row.job_id = job_associated_users.job_id
        AND my_row.user_id = u.id
        AND my_row.role = 'helper'
    )
  );

-- 5. Allow helpers to read job question answers for their assigned jobs
--    (Required for questionnaire answers to show in Helper view)
DROP POLICY IF EXISTS "helpers_view_job_question_answers" ON job_question_answers;
CREATE POLICY "helpers_view_job_question_answers"
  ON job_question_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM job_associated_users jau
      JOIN users u ON u.auth_user_id = auth.uid()
      WHERE jau.job_id = job_question_answers.job_id
        AND jau.user_id = u.id
        AND jau.role = 'helper'
    )
  );

-- 6. Allow helpers to update job status (job_started and job_finished only)
--    The application code limits which statuses helpers can set.
DROP POLICY IF EXISTS "helpers_update_job_status" ON jobs;
CREATE POLICY "helpers_update_job_status"
  ON jobs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM job_associated_users jau
      JOIN users u ON u.auth_user_id = auth.uid()
      WHERE jau.job_id = jobs.id
        AND jau.user_id = u.id
        AND jau.role = 'helper'
    )
  );
