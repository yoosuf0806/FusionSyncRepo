-- Migration: SECURITY DEFINER login resolver so the login page no longer needs
-- a service-role key in the browser.
--
-- Background:
--   LoginPage used a browser-side service-role client to look up the typed
--   username in public.users (step 1), because RLS blocks an unauthenticated
--   (anon) caller from reading the users table. When the service key env var is
--   missing/misnamed, that client is null, the lookup falls back to the anon
--   client, RLS returns zero rows, and EVERY login fails with
--   "Wrong username — no account found" — even for accounts that exist.
--
--   Shipping the service-role key to the browser is also a critical security
--   hole (full RLS bypass, readable in the public JS bundle).
--
-- This function does the minimal privileged lookup login needs, server-side,
-- under a controlled SECURITY DEFINER boundary. It returns only what the login
-- flow requires: whether an account matches, whether it is active, and the
-- current auth email (auth.users is the source of truth — a pending "secure
-- email change" can leave the stored email different from the one derived from
-- the username). It never returns password hashes or other columns.
--
-- Password verification still happens through supabase.auth.signInWithPassword
-- on the client; this function does not check the password.

CREATE OR REPLACE FUNCTION public.resolve_login_identity(p_identifier TEXT)
RETURNS TABLE (found BOOLEAN, is_active BOOLEAN, login_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_user_id UUID;
  v_is_active    BOOLEAN;
  v_email        TEXT;
BEGIN
  IF p_identifier IS NULL OR btrim(p_identifier) = '' THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::TEXT;
    RETURN;
  END IF;

  -- Match by the login identifier (user_name), case-insensitively, same as the
  -- previous client-side lookup.
  SELECT u.auth_user_id, u.is_active
    INTO v_auth_user_id, v_is_active
  FROM public.users u
  WHERE u.user_name ILIKE btrim(p_identifier)
  ORDER BY u.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::TEXT;
    RETURN;
  END IF;

  -- Current auth email (may differ from the username-derived email).
  IF v_auth_user_id IS NOT NULL THEN
    SELECT au.email INTO v_email FROM auth.users au WHERE au.id = v_auth_user_id;
  END IF;

  RETURN QUERY SELECT TRUE, COALESCE(v_is_active, FALSE), v_email;
END;
$$;

-- Login happens before authentication, so the anon role must be able to call it.
REVOKE ALL ON FUNCTION public.resolve_login_identity(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_identity(TEXT) TO anon, authenticated;
