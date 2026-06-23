import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase/client'

// Service-role client for privileged notification inserts to multiple recipients
const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const _url = import.meta.env.VITE_SUPABASE_URL
const adminClient = (_svcKey && _svcKey.startsWith('eyJ'))
  ? createClient(_url, _svcKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

const notifyClient = adminClient || supabase

/* ────────────────────────────────────────────────────────────────────────
   Half-day time windows (locked):
     first_half  = 08:00–13:00
     second_half = 13:00–18:00
     full_day    = 00:00–23:59
──────────────────────────────────────────────────────────────────────────*/
const LEAVE_WINDOWS = {
  full_day:    { start: '00:00', end: '23:59' },
  first_half:  { start: '08:00', end: '13:00' },
  second_half: { start: '13:00', end: '18:00' },
}

/** Does [aStart,aEnd) overlap [bStart,bEnd)?  times are 'HH:MM' strings */
function timeOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

/** Does a date fall within a job's day-of-week filter? */
function dateMatchesJobDays(dateStr, jobDays) {
  const dow = new Date(dateStr + 'T00:00:00').getDay() // 0=Sun..6=Sat
  const isWeekend = dow === 0 || dow === 6
  if (jobDays === 'weekdays_only') return !isWeekend
  if (jobDays === 'weekends_only') return isWeekend
  return true // weekdays_and_weekends
}

// ════════════════════════════════════════════════════════════════════════
// Apply / list / review leave
// ════════════════════════════════════════════════════════════════════════

/** Worker or supervisor submits a leave request. */
export async function applyForLeave(requesterId, { leaveDate, duration, reason, note }) {
  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      requester_id: requesterId,
      leave_date: leaveDate,
      duration: duration || 'full_day',
      reason,
      note: note || null,
      status: 'pending',
    })
    .select('*')
    .single()
  if (error) throw error

  // Notify approver(s): supervisor's leave → admins; helper's leave → supervisors
  await notifyApproversOfLeaveRequest(requesterId, data)
  return data
}

/** Get the current user's own leave requests. */
export async function getMyLeaveRequests(userId) {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('requester_id', userId)
    .order('leave_date', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Get leave requests the current viewer can review.
 * Supervisor → helper requests; Admin → all (filtered to supervisors by default
 * in the UI, but service returns all so admin can see everything).
 */
export async function getLeaveRequestsToReview({ viewerType, statusFilter } = {}) {
  let query = supabase
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: rows, error } = await query
  if (error) throw error
  if (!rows || rows.length === 0) return []

  // Enrich with requester name + type
  const ids = [...new Set(rows.map(r => r.requester_id))]
  const { data: users } = await supabase
    .from('users').select('id, user_name, user_type').in('id', ids)
  const uMap = {}
  ;(users || []).forEach(u => { uMap[u.id] = u })

  let enriched = rows.map(r => ({
    ...r,
    requester_name: uMap[r.requester_id]?.user_name || '—',
    requester_type: uMap[r.requester_id]?.user_type || null,
  }))

  // Supervisor can only review helper leave
  if (viewerType === 'supervisor') {
    enriched = enriched.filter(r => r.requester_type === 'helper')
  }
  return enriched
}

/**
 * Approve or reject a leave request. On approval, fires the replacement cascade.
 */
export async function reviewLeaveRequest(leaveId, decision, reviewerId, reviewNote) {
  const status = decision === 'approve' ? 'approved' : 'rejected'

  const { data: leave, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
    })
    .eq('id', leaveId)
    .select('*')
    .single()
  if (error) throw error

  // Notify the requester of the decision
  await notifyClient.from('notifications').insert({
    recipient_user_id: leave.requester_id,
    title: status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
    message: status === 'approved'
      ? `Your leave on ${leave.leave_date} has been approved.`
      : `Your leave on ${leave.leave_date} was rejected${reviewNote ? ': ' + reviewNote : '.'}`,
    notification_type: status === 'approved' ? 'leave_approved' : 'leave_rejected',
  }).catch(() => {})

  // Cascade only on approval
  if (status === 'approved') {
    await runReplacementCascade(leave)
  }
  return leave
}

// ════════════════════════════════════════════════════════════════════════
// Replacement cascade
// ════════════════════════════════════════════════════════════════════════

/**
 * On leave approval: find the jobs the absent worker is assigned to whose
 * schedule overlaps the leave (date + time-aware), flag each affected
 * job-date, and notify customer + internal team.
 */
export async function runReplacementCascade(leave) {
  const leaveWin = LEAVE_WINDOWS[leave.duration] || LEAVE_WINDOWS.full_day

  // Jobs the absent worker is assigned to
  const { data: assoc } = await supabase
    .from('job_associated_users')
    .select('job_id')
    .eq('user_id', leave.requester_id)
    .in('role', ['helper', 'supervisor'])

  const jobIds = [...new Set((assoc || []).map(a => a.job_id))]
  if (jobIds.length === 0) return

  // Active jobs only
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .in('id', jobIds)
    .not('status', 'in', '(job_closed,cancelled,payment_confirmed)')

  for (const job of jobs || []) {
    // Is the job actually scheduled on the leave date?
    //   • one-time → job_date must equal the leave date
    //   • recurring → leave date within range AND matches day-of-week filter
    if (job.job_category === 'frequent') {
      const start = job.job_from_date
      const end = job.job_to_date || job.job_from_date
      if (!start) continue
      if (leave.leave_date < start || leave.leave_date > end) continue
      if (!dateMatchesJobDays(leave.leave_date, job.job_days)) continue
    } else {
      // one-time job
      if (!job.job_date || job.job_date !== leave.leave_date) continue
    }

    // Time-aware overlap: leave window vs job scheduled time
    const jobStart = (job.job_start_time || '00:00').slice(0, 5)
    const jobEnd = (job.job_end_time || '23:59').slice(0, 5)
    if (!timeOverlaps(leaveWin.start, leaveWin.end, jobStart, jobEnd)) continue

    // Create the replacement flag for this job-date (idempotent on unique key)
    await supabase.from('job_replacement_flags').upsert({
      job_id: job.id,
      flag_date: leave.leave_date,
      absent_user_id: leave.requester_id,
      leave_request_id: leave.id,
    }, { onConflict: 'job_id,flag_date,absent_user_id' }).catch(() => {})

    // Notify customer (helpee) + internal (supervisor/admin)
    await notifyJobReplacementNeeded(job, leave)
  }
}

async function notifyJobReplacementNeeded(job, leave) {
  // Absent worker's name
  const { data: absentUser } = await supabase
    .from('users').select('user_name').eq('id', leave.requester_id).single()
  const absentName = absentUser?.user_name || 'A worker'

  // Recipients: helpee (customer) on the job + all supervisors/admins
  const { data: jau } = await supabase
    .from('job_associated_users')
    .select('user_id, role')
    .eq('job_id', job.id)

  const recipients = []

  // Customer
  const helpee = (jau || []).find(u => u.role === 'helpee')
  if (helpee) {
    recipients.push({
      recipient_user_id: helpee.user_id,
      title: 'Worker Unavailable',
      message: `${absentName} is unavailable on ${leave.leave_date} for "${job.job_name}". We are assigning a replacement worker to ensure your service continues without interruption.`,
      notification_type: 'replacement_needed',
      related_job_id: job.id,
    })
  }

  // Internal team (supervisors + admins)
  const { data: internal } = await supabase
    .from('users')
    .select('id')
    .in('user_type', ['admin', 'supervisor'])
    .eq('is_active', true)
  for (const u of internal || []) {
    recipients.push({
      recipient_user_id: u.id,
      title: 'Replacement Needed',
      message: `${absentName} is on leave ${leave.leave_date}. Job "${job.job_name}" needs a replacement worker.`,
      notification_type: 'replacement_needed',
      related_job_id: job.id,
    })
  }

  if (recipients.length) {
    await notifyClient.from('notifications').insert(recipients).catch(() => {})
  }
}

/**
 * Assign a replacement worker for a flagged job-date.
 * Clears the flag and notifies the customer.
 */
export async function assignReplacement(flagId, replacementUserId, assignerName) {
  // Update the flag
  const { data: flag, error } = await supabase
    .from('job_replacement_flags')
    .update({
      replacement_user_id: replacementUserId,
      replaced_at: new Date().toISOString(),
    })
    .eq('id', flagId)
    .select('*')
    .single()
  if (error) throw error

  // Add the replacement worker to the job's associated users (if not already)
  await supabase.from('job_associated_users').upsert({
    job_id: flag.job_id,
    user_id: replacementUserId,
    role: 'helper',
  }, { onConflict: 'job_id,user_id,role' }).catch(() => {})

  // Names for the notification
  const [{ data: job }, { data: repl }] = await Promise.all([
    supabase.from('jobs').select('job_name').eq('id', flag.job_id).single(),
    supabase.from('users').select('user_name').eq('id', replacementUserId).single(),
  ])
  const jobName = job?.job_name || 'your job'
  const replName = repl?.user_name || 'A replacement worker'

  // Notify customer + replacement worker
  const { data: jau } = await supabase
    .from('job_associated_users')
    .select('user_id, role')
    .eq('job_id', flag.job_id)

  const recipients = []
  const helpee = (jau || []).find(u => u.role === 'helpee')
  if (helpee) {
    recipients.push({
      recipient_user_id: helpee.user_id,
      title: 'Replacement Assigned',
      message: `Update for "${jobName}": ${replName} has been assigned to cover your service during the absence on ${flag.flag_date}.`,
      notification_type: 'replacement_assigned',
      related_job_id: flag.job_id,
    })
  }
  recipients.push({
    recipient_user_id: replacementUserId,
    title: 'New Assignment',
    message: `You have been assigned to cover "${jobName}" on ${flag.flag_date}.`,
    notification_type: 'job_assigned',
    related_job_id: flag.job_id,
  })
  if (recipients.length) {
    await notifyClient.from('notifications').insert(recipients).catch(() => {})
  }

  return flag
}

/** Get open (unfilled) replacement flags for the internal dashboard. */
export async function getOpenReplacementFlags() {
  const { data: flags, error } = await supabase
    .from('job_replacement_flags')
    .select('*')
    .is('replacement_user_id', null)
    .order('flag_date', { ascending: true })
  if (error) throw error
  if (!flags || flags.length === 0) return []

  const jobIds = [...new Set(flags.map(f => f.job_id))]
  const userIds = [...new Set(flags.map(f => f.absent_user_id))]
  const [{ data: jobs }, { data: users }] = await Promise.all([
    supabase.from('jobs').select('id, job_id, job_name').in('id', jobIds),
    supabase.from('users').select('id, user_name').in('id', userIds),
  ])
  const jMap = {}; (jobs || []).forEach(j => { jMap[j.id] = j })
  const uMap = {}; (users || []).forEach(u => { uMap[u.id] = u })

  return flags.map(f => ({
    ...f,
    job_code: jMap[f.job_id]?.job_id || '—',
    job_name: jMap[f.job_id]?.job_name || '—',
    absent_name: uMap[f.absent_user_id]?.user_name || '—',
  }))
}

/** Get replacement flags for a specific job (for the badge on job views). */
export async function getReplacementFlagsForJob(jobId) {
  const { data, error } = await supabase
    .from('job_replacement_flags')
    .select('*')
    .eq('job_id', jobId)
    .is('replacement_user_id', null)
  if (error) return []
  return data || []
}

// ── internal: notify the correct approvers when a leave is requested ──
async function notifyApproversOfLeaveRequest(requesterId, leave) {
  const { data: requester } = await supabase
    .from('users').select('user_name, user_type').eq('id', requesterId).single()
  const name = requester?.user_name || 'A team member'

  // helper's leave → supervisors; supervisor's leave → admins
  const approverType = requester?.user_type === 'supervisor' ? 'admin' : 'supervisor'
  const { data: approvers } = await supabase
    .from('users').select('id').eq('user_type', approverType).eq('is_active', true)

  const rows = (approvers || []).map(a => ({
    recipient_user_id: a.id,
    title: 'Leave Request',
    message: `${name} requested leave on ${leave.leave_date} (${leave.duration.replace('_', ' ')}).`,
    notification_type: 'leave_request',
  }))
  if (rows.length) {
    await notifyClient.from('notifications').insert(rows).catch(() => {})
  }
}
