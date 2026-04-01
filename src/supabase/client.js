import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Supabase] ⚠️  Missing environment variables.\n' +
    'Check your .env.local file:\n' +
    '  VITE_SUPABASE_URL\n' +
    '  VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken:    true,
    persistSession:      true,
    detectSessionInUrl:  true,
  },
})

// Connection health check — call this once on app start
export async function testConnection() {
  try {
    const { error } = await supabase.from('_connection_test_').select('*').limit(1)
    // A "relation does not exist" error is fine — it means Supabase is reachable
    // Any other error (like network failure) means connection is broken
    if (error && error.code === '42P01') {
      console.log('[Supabase] ✅ Connected to:', supabaseUrl)
      return true
    }
    if (!error) {
      console.log('[Supabase] ✅ Connected to:', supabaseUrl)
      return true
    }
    // Auth-related errors still mean we're connected
    if (error.message?.includes('JWT') || error.code === 'PGRST301') {
      console.log('[Supabase] ✅ Connected to:', supabaseUrl)
      return true
    }
    console.error('[Supabase] ❌ Connection error:', error.message)
    return false
  } catch (err) {
    console.error('[Supabase] ❌ Cannot reach Supabase:', err.message)
    return false
  }
}
