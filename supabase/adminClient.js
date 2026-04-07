import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

/**
 * Admin Supabase client initialized with service role key.
 * Used for auth.admin operations (creating/deleting auth users).
 *
 * NOTE: The new sb_secret_ key format requires BOTH the apikey header
 * AND explicit Authorization header for Supabase Auth admin endpoints.
 * We set these via global.headers to ensure correct forwarding.
 */
export const adminSupabase = (supabaseUrl && serviceKey)
  ? createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      },
    })
  : null
