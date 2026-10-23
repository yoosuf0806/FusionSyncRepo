-- Migration: admin password reset without a browser service-role key.
--
-- Background:
--   adminResetUserPassword() in the frontend used a browser-side service-role
--   client to call auth.admin.updateUserById(). When that key is missing or
--   stored under a different env var name, the client is null and the reset
--   fails with "Admin client not available. Service role key required."
--   Shipping the service-role key to the browser is also a full-DB-bypass
--   security hole.
--
--   This function performs the privileged password update server-side, behind a
--   SECURITY DEFINER boundary, and only for a caller who is an authenticated
--   admin (verified from their own JWT via auth.uid()). It sets the bcrypt hash
--   the same way Supabase Auth does, so signInWithPassword works afterwards.

CREATE OR REPLACE FUNCTION public.admin_set_user_password(
  p_target_auth_user_id UUID,
  p_new_password        TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
-- Include extensions so pgcrypto's crypt()/gen_salt() resolve (Supabase installs
-- pgcrypto in the extensions schema).
SET search_path = auth, public, extensions
AS $$
DECLARE
  v_caller_type TEXT;
BEGIN
  -- Only an authenticated admin may reset another user's password.
  SELECT u.user_type INTO v_caller_type
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();

  IF v_caller_type IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can reset user passwords';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at         = NOW()
  WHERE id = p_target_auth_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target auth user not found';
  END IF;
END;
$$;

-- Callable only by authenticated users; the admin check inside gates it further.
REVOKE ALL ON FUNCTION public.admin_set_user_password(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_password(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_password(UUID, TEXT) TO authenticated;
