import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase/client'
import { normalizeLoginEmail } from './authService'

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
  const contactEmail = userData.user_email?.trim() || null
  // Auth email is always username-based so username login always works
  const authEmail = normalizeLoginEmail(userData.user_name)

  let authUserId

  if (adminClient) {
    // Path A: legacy JWT service role key available — use admin API (no rate limits, no email confirm needed)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { username: userData.user_name, role: userData.user_type },
    })
    if (authError) throw authError
    authUserId = authData.user.id
  } else {
    // Path B: fallback — use anon signUp (requires email confirmation DISABLED in Supabase Auth settings)
    const { data: authData, error: authError } = await signupClient.auth.signUp({
      email: authEmail,
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
    user_email: contactEmail,
    user_type: userData.user_type,
    user_phone: userData.user_phone || null,
    user_location: userData.user_location || null,
    department_id: userData.department_id || null,
    preferred_job_type_id: userData.preferred_job_type_id || null,
    is_active: true,
  }).select().single()

  if (error) throw error

  // Send welcome notification — ignore errors so user creation still succeeds
  await supabase.from('notifications').insert({
    recipient_user_id: data.id,
    title: 'Welcome',
    message: `Welcome to Helping Hands, ${userData.user_name}! Your account has been created as ${userData.user_type}.`,
    notification_type: 'general',
    is_read: false,
    delivery_channels: ['in_app'],
  }).then(() => {}, () => {})

  return data
}

export async function updateUser(id, userData) {
  if (!adminClient) throw new Error(
    'Updating users requires the service role key (VITE_SUPABASE_SERVICE_ROLE_KEY).'
  )

  // Use adminClient for both fetch and update — bypasses RLS so the RETURNING clause
  // always comes back correctly regardless of the caller's role (admin, supervisor, etc.)
  // and ensures auth_user_id is always available for the SSO email sync.
  const { data: existing, error: fetchErr } = await adminClient
    .from('users')
    .select('user_name, user_type, auth_user_id')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const { error } = await adminClient
    .from('users')
    .update({
      user_name: userData.user_name,
      user_email: userData.user_email?.trim() || null,
      user_phone: userData.user_phone || null,
      user_location: userData.user_location || null,
      department_id: userData.department_id || null,
      preferred_job_type_id: userData.preferred_job_type_id || null,
      user_type: userData.user_type,
    })
    .eq('id', id)
  if (error) throw error

  const data = { id, ...userData }

  const nameChanged = (userData.user_name || '').trim() !== (existing.user_name || '').trim()
  const typeChanged = (userData.user_type || '') !== (existing.user_type || '')

  if (!existing.auth_user_id) {
    // No auth account linked — DB update is all we can do
    return data
  }

  if (nameChanged || typeChanged) {
    // Always sync both email and metadata together when either changes
    const { error: auErr } = await adminClient.auth.admin.updateUserById(existing.auth_user_id, {
      ...(nameChanged ? { email: normalizeLoginEmail(userData.user_name) } : {}),
      user_metadata: { username: userData.user_name, role: userData.user_type },
    })
    if (auErr) {
      throw new Error(
        `Profile saved, but SSO login email could not be updated: ${auErr.message}`
      )
    }
  }

  return data
}

export async function adminResetUserPassword(dbUserId, newPassword) {
  const { data: user, error: fetchErr } = await supabase
    .from('users')
    .select('auth_user_id')
    .eq('id', dbUserId)
    .single()
  if (fetchErr) throw fetchErr

  if (!adminClient) throw new Error('Admin client not available. Service role key required.')

  const { error } = await adminClient.auth.admin.updateUserById(user.auth_user_id, {
    password: newPassword,
  })
  if (error) throw error
}


/**
 * Fetch all job type IDs associated with a user (from user_job_types junction table).
 */
export async function getUserJobTypes(userId) {
  const { data, error } = await supabase
    .from('user_job_types')
    .select('job_type_id')
    .eq('user_id', userId)
  if (error) {
    // Table may not exist yet (migration not run) — return empty gracefully
    console.warn('getUserJobTypes:', error.message)
    return []
  }
  return (data || []).map(r => r.job_type_id)
}

/**
 * Replace all job type associations for a user.
 * Uses adminClient so admin/supervisor can manage helper job types.
 */
export async function saveUserJobTypes(userId, jobTypeIds = []) {
  const client = adminClient || supabase
  // Delete existing then re-insert
  const { error: delErr } = await client
    .from('user_job_types')
    .delete()
    .eq('user_id', userId)
  if (delErr) throw delErr

  const ids = (jobTypeIds || []).filter(Boolean)
  if (ids.length === 0) return

  const rows = ids.map(jid => ({ user_id: userId, job_type_id: jid }))
  const { error: insErr } = await client.from('user_job_types').insert(rows)
  if (insErr) throw insErr
}


/**
 * Check if a user has any active (non-completed) job assignments.
 * Returns the list of active jobs the user is assigned to.
 * "Active" = any status that is NOT payment_confirmed or job_closed.
 */
export async function checkUserActiveJobs(userId) {
  const client = adminClient || supabase
  // Get all job IDs this user is assigned to
  const { data: jauRows, error: jauErr } = await client
    .from('job_associated_users')
    .select('job_id')
    .eq('user_id', userId)
  if (jauErr) throw jauErr
  if (!jauRows || jauRows.length === 0) return []

  const jobIds = jauRows.map(r => r.job_id)
  // Fetch only jobs that are still active (not completed/closed)
  const { data: activeJobs, error: jobErr } = await client
    .from('jobs')
    .select('id, job_id, job_name, status')
    .in('id', jobIds)
    .not('status', 'in', '("payment_confirmed","job_closed")')
  if (jobErr) throw jobErr
  return activeJobs || []
}

export async function deleteUser(id) {
  if (!adminClient) throw new Error(
    'Hard delete requires the service role key (VITE_SUPABASE_SERVICE_ROLE_KEY).'
  )

  // 1. Fetch the auth_user_id so we can delete from auth.users too
  const { data: user, error: fetchErr } = await adminClient
    .from('users')
    .select('auth_user_id, user_name')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  // 2. Remove from job_associated_users — ON DELETE RESTRICT blocks users row deletion.
  //    Job records themselves are fully preserved; only the assignment link is removed.
  const { error: jauErr } = await adminClient
    .from('job_associated_users')
    .delete()
    .eq('user_id', id)
  if (jauErr) throw new Error(`Failed to remove job assignments: ${jauErr.message}`)

  // 3. Remove from job_remarks — helpee_id is ON DELETE RESTRICT.
  //    The remark text/rating is lost but the job record itself remains intact.
  const { error: remarkErr } = await adminClient
    .from('job_remarks')
    .delete()
    .eq('helpee_id', id)
  if (remarkErr) throw new Error(`Failed to remove job remarks: ${remarkErr.message}`)

  // 4. Hard-delete the public.users row.
  //    Cascades automatically: notifications, department_users, user_job_types.
  //    SET NULL automatically: job_requester_id, job_attendance.helpee_id,
  //    job_attendance.submitted_by, invoices.created_by, job_status_history.changed_by.
  const { error: dbErr } = await adminClient
    .from('users')
    .delete()
    .eq('id', id)
  if (dbErr) throw new Error(`Failed to delete user record: ${dbErr.message}`)

  // 5. Hard-delete from auth.users — removes login credentials entirely
  if (user.auth_user_id) {
    const { error: authErr } = await adminClient.auth.admin.deleteUser(user.auth_user_id)
    if (authErr) throw new Error(`User record deleted but auth account removal failed: ${authErr.message}`)
  }
}
