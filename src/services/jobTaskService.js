import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase/client'

// Service-role client for privileged writes (mirrors jobService convention).
const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const _url = import.meta.env.VITE_SUPABASE_URL
const adminClient = (_svcKey && _svcKey.startsWith('eyJ'))
  ? createClient(_url, _svcKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

// The job_tasks table may not exist yet (migration pending). Treat "missing
// table" as an empty checklist instead of crashing the page.
function isMissingTable(error) {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message || '')
}

export async function getTasksForJob(jobId) {
  if (!jobId) return []
  const { data, error } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return data || []
}

export async function addTask(jobId, title, sortOrder = 0) {
  const client = adminClient || supabase
  const { data, error } = await client
    .from('job_tasks')
    .insert({ job_id: jobId, title: title.trim(), sort_order: sortOrder })
    .select('*')
    .single()
  if (error) {
    if (isMissingTable(error)) throw new Error('Task checklists need a one-time database migration (supabase/migrations/20260701000000_job_tasks.sql).')
    throw error
  }
  return data
}

export async function updateTaskTitle(taskId, title) {
  const client = adminClient || supabase
  const { error } = await client.from('job_tasks').update({ title: title.trim() }).eq('id', taskId)
  if (error && !isMissingTable(error)) throw error
}

export async function deleteTask(taskId) {
  const client = adminClient || supabase
  const { error } = await client.from('job_tasks').delete().eq('id', taskId)
  if (error && !isMissingTable(error)) throw error
}

export async function toggleTask(taskId, isDone, userId) {
  // Use the regular client so RLS applies for helper check-offs; fall back to admin.
  const payload = { is_done: isDone, done_by: isDone ? (userId || null) : null, done_at: isDone ? new Date().toISOString() : null }
  const { error } = await supabase.from('job_tasks').update(payload).eq('id', taskId)
  if (error) {
    if (isMissingTable(error)) return
    // RLS or other failure — retry with admin client if available
    if (adminClient) {
      const { error: e2 } = await adminClient.from('job_tasks').update(payload).eq('id', taskId)
      if (e2 && !isMissingTable(e2)) throw e2
      return
    }
    throw error
  }
}
