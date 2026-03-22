import { supabase } from '../supabase/client'

function normalizeLoginEmail(identifier) {
  const value = identifier.trim()
  if (value.includes('@')) return value.toLowerCase()
  // Allow username-style login (e.g. "Admin") by mapping to a controlled domain.
  return `${value.toLowerCase()}@helpinghands.local`
}

export async function loginUser(identifier, password) {
  const email = normalizeLoginEmail(identifier)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function changeCurrentUserPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

export async function getUserProfile(authUserId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()
  if (error) throw error
  return data
}
