import { supabase } from '../../supabase/client'
import { isJobScheduledOnDate } from './jobService'

const ACTIVE_EXCLUDE = ['job_closed', 'payment_confirmed', 'cancelled']

// Local YYYY-MM-DD (no UTC round-trip — avoids timezone date shifts)
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Monday-based start of the week containing `dateStr` (YYYY-MM-DD)
export function weekStart(dateStr) {
  const d = new Date((dateStr || ymd(new Date())) + 'T12:00:00')
  const dow = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow)
  return ymd(d)
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/**
 * Roster for the 7-day week starting at weekStartStr.
 * Returns { days:[7 dates], workers:[{id,name,type}], cells:{workerId:{date:[jobs]}} }.
 * Supervisors pass their departmentId to scope; admins pass null for all.
 */
export async function getRoster(weekStartStr, departmentId = null) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartStr, i))

  let jq = supabase
    .from('jobs')
    .select('id, job_id, job_name, job_category, job_date, job_from_date, job_to_date, job_days, job_start_time, job_end_time, status, department_id')
    .not('status', 'in', `(${ACTIVE_EXCLUDE.join(',')})`)
  if (departmentId) jq = jq.eq('department_id', departmentId)
  const { data: jobs, error } = await jq
  if (error) throw error
  const jobsList = jobs || []
  const jobIds = jobsList.map(j => j.id)
  if (jobIds.length === 0) return { days, workers: [], cells: {} }

  const { data: assoc } = await supabase
    .from('job_associated_users')
    .select('job_id, user_id, role, users(id, user_name, user_type)')
    .in('job_id', jobIds)
    .in('role', ['helper', 'supervisor'])

  const jobById = {}
  jobsList.forEach(j => { jobById[j.id] = j })

  const workers = {}
  const workerJobs = {}
  for (const a of assoc || []) {
    const u = a.users
    if (!u) continue
    workers[u.id] = { id: u.id, name: u.user_name, type: u.user_type }
    ;(workerJobs[u.id] ||= []).push(jobById[a.job_id])
  }

  const cells = {}
  for (const wid of Object.keys(workerJobs)) {
    cells[wid] = {}
    for (const day of days) {
      const jobsToday = workerJobs[wid].filter(j => j && isJobScheduledOnDate(j, day))
      if (jobsToday.length) cells[wid][day] = jobsToday
    }
  }

  const workerList = Object.values(workers).sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'supervisor' ? -1 : 1)
  )

  return { days, workers: workerList, cells }
}
