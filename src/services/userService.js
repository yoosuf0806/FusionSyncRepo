import { supabase } from '../supabase/client'
import { adminSupabase } from '../supabase/adminClient'

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
  if (!adminSupabase) throw new Error('Admin client not available')

  const email = `${userData.user_name.toLowerCase().replace(/\s+/g, '.')}@helpinghands.local`

  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: userData.user_name, role: userData.user_type },
  })
  if (authError) throw authError

  const { data, error } = await supabase.from('users').insert({
    auth_user_id: authData.user.id,
    user_name: userData.user_name,
    user_email: email,
    user_type: userData.user_type,
    user_phone: userData.user_phone || null,
    user_location: userData.user_location || null,
    department_id: userData.department_id || null,
    preferred_job_type_id: userData.preferred_job_type_id || null,
    is_active: true,
  }).select().single()

  if (error) {
    await adminSupabase.auth.admin.deleteUser(authData.user.id).catch(() => {})
    throw error
  }

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

  if (adminSupabase && user.auth_user_id) {
    await adminSupabase.auth.admin.deleteUser(user.auth_user_id).catch(() => {})
  }
}
