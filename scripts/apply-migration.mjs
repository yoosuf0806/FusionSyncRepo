import pg from 'pg'
const { Client } = pg

const sql = `
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
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'authenticated', 'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    jsonb_build_object('username', p_username, 'role', p_role),
    NOW(), NOW(), '', '', '', ''
  );
  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, TEXT) TO service_role;
`

const client = new Client({
  host: 'db.asusrhebwmictwzrbumr.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'HelpingHands@123',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
})

try {
  await client.connect()
  console.log('Connected to DB')
  await client.query(sql)
  console.log('✅ create_app_user function deployed successfully')
} catch (err) {
  console.error('❌ Error:', err.message)
} finally {
  await client.end()
}
