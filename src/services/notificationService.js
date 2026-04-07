import { supabase } from '../../supabase/client'

export async function getNotifications(userId, { limit = 20, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return data || []
}

export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .eq('is_read', false)
  if (error) throw error
  return count || 0
}

export async function markAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  if (error) throw error
}

export async function markAllRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

export function subscribeToNotifications(userId, onInsert) {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` },
      payload => onInsert(payload.new)
    )
    .subscribe()
}
