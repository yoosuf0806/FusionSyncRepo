import { createClient } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'

// Admin client using service role key. Works when the key is a legacy JWT (eyJ...).
// If VITE_SUPABASE_SERVICE_ROLE_KEY is set to a legacy JWT (from Supabase dashboard →
// Settings → API → Legacy Keys → service_role), admin.createUser() will work without
// rate limits and without needing email confirmation disabled.
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const isLegacyJwt = serviceKey && serviceKey.startsWith('eyJ')

const adminClient = isLegacyJwt
  ? createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// Fallback signup client — used when legacy JWT admin key is NOT available.
// No session persistence so it never overwrites the logged-in admin's session.
// Requires "Enable email confirmations" to be DISABLED in Supabase Auth settings.
const signupClient = createClient(
  supabaseUrl,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
)

export async function getUsers({ search = '', userType = '' } = {}) {
  let query = supabase
    .from('users')
    .select('id, user_id, user_name, user_type, user_email, user_phone, user_location, department_id, preferred_job_type_id, profile_image_url, is_active, departments(department_name), job_specifications(job_type_name)')
    .eq('is_active', true)
    .order('user_id')

  if (userType) query = query.eq('user_type', userType)
  if (search) {
    query = query.or(
      `user_id.ilike.%${search}%,user_name.ilike.%${search}%,user_email.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*, departments(department_name), job_specifications(job_type_name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getUserByAuthId(authId) {
  const { data, error } = await supabase
    .from('users')
    .select('*, departments(department_name), job_specifications(job_type_name)')
    .eq('auth_user_id', authId)
    .single()
  if (error) throw error
  return data
}

export async function createUser(userData, password) {
  const email = userData.user_email?.trim()
  if (!email) throw new Error('Email address is required')

  let authUserId

  if (adminClient) {
    // Path A: legacy JWT service role key available — use admin API (no rate limits, no email confirm needed)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: userData.user_name, role: userData.user_type },
    })
    if (authError) throw authError
    authUserId = authData.user.id
  } else {
    // Path B: fallback — use anon signUp (requires email confirmation DISABLED in Supabase Auth settings)
    const { data: authData, error: authError } = await signupClient.auth.signUp({
      email,
      password,
      options: { data: { username: userData.user_name, role: userData.user_type } },
    })
    if (authError) throw authError
    if (!authData.user) throw new Error(
      'User creation failed. Please disable "Enable email confirmations" in Supabase Dashboard → Authentication → Providers → Email.'
    )
    authUserId = authData.user.id
  }

  const { data, error } = await supabase.from('users').insert({
    auth_user_id: authUserId,
    user_name: userData.user_name,
    user_email: email,
    user_type: userData.user_type,
    user_phone: userData.user_phone || null,
    user_location: userData.user_location || null,
    department_id: userData.department_id || null,
    preferred_job_type_id: userData.preferred_job_type_id || null,
    is_active: true,
  }).select().single()

  if (error) throw error

  // Send welcome notification
  await supabase.from('notifications').insert({
    recipient_user_id: data.id,
    message: `Welcome to Helping Hands, ${userData.user_name}! Your account has been created as ${userData.user_type}.`,
    notification_type: 'system',
    is_read: false,
    delivery_channels: ['in_app'],
  }).catch(() => {})

  return data
}

export async function updateUser(id, userData) {
  const { data, error } = await supabase
    .from('users')
    .update({
      user_name: userData.user_name,
      user_phone: userData.user_phone || null,
      user_location: userData.user_location || null,
      department_id: userData.department_id || null,
      preferred_job_type_id: userData.preferred_job_type_id || null,
      user_type: userData.user_type,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteUser(id) {
  const { data: user, error: fetchErr } = await supabase
    .from('users')
    .select('auth_user_id')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error

  // Auth user is soft-deleted via is_active=false above.
  // Hard-delete from auth.users can be done from the Supabase dashboard if needed.
}
