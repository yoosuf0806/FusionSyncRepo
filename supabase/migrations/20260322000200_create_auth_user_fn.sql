-- Migration: Create helper function to create auth users from within the DB
-- This avoids needing the auth admin REST API (which has issues with new sb_secret_ key format)

CREATE OR REPLACE FUNCTION public.create_app_user(
  p_email    TEXT,
  p_password TEXT,
  p_username TEXT DEFAULT '',
  p_role     TEXT DEFAULT 'helper'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    jsonb_build_object('username', p_username, 'role', p_role),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  RETURN v_user_id;
END;
$$;

-- Only service role can execute (prevents misuse from anon/authenticated)
REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, TEXT) TO service_role;
