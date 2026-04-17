-- ============================================================
-- Add 'username' login field to users table.
-- 'user_name' = full display name (e.g. "John Smith")
-- 'username'  = login handle used for SSO (e.g. "jsmith")
-- ============================================================

-- 1. Add the column (nullable initially so existing rows don't break)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;

-- 2. Back-fill existing rows: derive username from user_name
--    (same logic as normalizeLoginEmail — lowercase, spaces→dots)
UPDATE public.users
SET username = LOWER(REPLACE(TRIM(user_name), ' ', '.'))
WHERE username IS NULL;

-- 3. Index for fast login lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
