import { createClient } from '@supabase/supabase-js'

const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

export const adminSupabase = serviceKey
  ? createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
