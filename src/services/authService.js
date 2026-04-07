import { supabase } from '../../supabase/client'

// Converts a plain username to the internal login email format.
// Spaces become dots; special chars are stripped.
export function normalizeLoginEmail(identifier) {
  const value = identifier.trim()
  if (value.includes('@')) return value.toLowerCase()
  return `${value.toLowerCase().replace(/\s+/g, '.')}@helpinghands.local`
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

export async function sendPasswordResetEmail(identifier) {
  const email = normalizeLoginEmail(identifier)
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
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
