import { supabase } from '../../supabase/client'

// ════════════════════════════════════════════════════════════════════════
// Apply / list / review leave
//
// Note: the notification + replacement cascade logic lives in the database
// (SECURITY DEFINER triggers from migration 20260426000000), so the client
// only performs the core writes and lets the triggers handle the rest. This
// avoids RLS blocking cross-user notification/flag writes from the browser.
// ════════════════════════════════════════════════════════════════════════

/** Worker or supervisor submits a leave request. */
export async function applyForLeave(requesterId, { leaveDate, leaveToDate, duration, reason, note }) {
  const newDuration = duration || 'full_day'
  const toDate = leaveToDate || leaveDate

  if (toDate < leaveDate) {
    throw new Error('The "to" date must be on or after the "from" date.')
  }

  const isSingleDay = toDate === leaveDate

  // Find any non-rejected leave that overlaps the requested range.
  const { data: existing, error: exErr } = await supabase
    .from('leave_requests')
    .select('id, duration, status, leave_date, leave_to_date')
    .eq('requester_id', requesterId)
    .neq('status', 'rejected')
  if (exErr) throw exErr

  const overlapping = (existing || []).filter(r => {
    const rFrom = r.leave_date
    const rTo = r.leave_to_date || r.leave_date
    return rFrom <= toDate && leaveDate <= rTo  // ranges intersect
  })

  if (overlapping.length > 0) {
    if (isSingleDay && overlapping.every(r => (r.leave_date === leaveDate && (r.leave_to_date || r.leave_date) === leaveDate))) {
      // Single-day half-day exception still applies when the only overlap is
      // the same single day.
      const hasFull = overlapping.some(r => r.duration === 'full_day')
      const hasFirst = overlapping.some(r => r.duration === 'first_half')
      const hasSecond = overlapping.some(r => r.duration === 'second_half')
      if (hasFull) throw new Error('You already have a full-day leave request for this date.')
      if (newDuration === 'full_day') throw new Error('You already have a half-day leave request for this date. You can only request the remaining half.')
      if (newDuration === 'first_half' && hasFirst) throw new Error('You already requested the morning (first half) for this date.')
      if (newDuration === 'second_half' && hasSecond) throw new Error('You already requested the afternoon (second half) for this date.')
      // else opposite half → allowed
    } else {
      throw new Error('You already have a leave request that overlaps these dates.')
    }
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      requester_id: requesterId,
      leave_date: leaveDate,
      leave_to_date: toDate,
      duration: newDuration,
      reason,
      note: note || null,
      status: 'pending',
    })
    .select('*')
    .single()
  if (error) throw error

  // Notifications to approvers are handled server-side by the
  // trg_notify_leave_request trigger (SECURITY DEFINER) — no client write needed.
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
 * All APPROVED leave (everyone — workers AND supervisors), for the "On Leave"
 * view in Manage Attendance. By default returns leave that is current or
 * upcoming (ends today or later); pass includePast=true for the full history.
 * Each row is enriched with the person's name, role, and a duration label.
 */
export async function getUsersOnLeave({ includePast = false } = {}) {
  const today = new Date().toISOString().slice(0, 10)
  let query = supabase
    .from('leave_requests')
    .select('*')
    .eq('status', 'approved')
    .order('leave_date', { ascending: true })

  // Current or upcoming: the leave's end date is today or later
  if (!includePast) {
    query = query.or(`leave_to_date.gte.${today},and(leave_to_date.is.null,leave_date.gte.${today})`)
  }

  const { data: rows, error } = await query
  if (error) throw error
  if (!rows || rows.length === 0) return []

  const ids = [...new Set(rows.map(r => r.requester_id))]
  const { data: users } = await supabase
    .from('users').select('id, user_name, user_type').in('id', ids)
  const uMap = {}
  ;(users || []).forEach(u => { uMap[u.id] = u })

  const durLabel = { full_day: 'Full Day', first_half: 'Morning (8am–1pm)', second_half: 'Afternoon (1pm–6pm)' }

  return rows.map(r => {
    const to = r.leave_to_date || r.leave_date
    const isRange = to && to !== r.leave_date
    return {
      ...r,
      to_date: to,
      is_range: isRange,
      person_name: uMap[r.requester_id]?.user_name || '—',
      person_type: uMap[r.requester_id]?.user_type || null,
      duration_label: durLabel[r.duration] || r.duration,
      // "On leave now" if today falls within the range
      active: today >= r.leave_date && today <= to,
    }
  })
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

  // The decision notification AND the full replacement cascade (flags +
  // customer/internal notifications) are handled server-side by the
  // trg_cascade_leave_approved / trg_notify_leave_rejected triggers
  // (SECURITY DEFINER). No client-side cascade needed — this avoids the
  // RLS issues that silently dropped notifications and flags before.
  return leave
}

/**
 * Assign a replacement worker (B) for an absent worker (A) on a job over a
 * chosen [fromDate, toDate] window. Fills any open per-date flags that fall in
 * the window, records a worker_replacements coverage row (drives the
 * "Replaced"/"Replacement for" tags + customer "Replaced" tag), and adds B to
 * the job. Notifications fire via DB triggers.
 *
 * group = { job_id, absent_user_id, flag_ids:[...] }
 */
export async function assignReplacement(group, replacementUserId, fromDate, toDate, createdBy) {
  const jobId = group.job_id
  const from = fromDate || group.from_date
  const to = toDate || group.to_date

  // Add B to the job first
  try {
    await supabase.from('job_associated_users').upsert({
      job_id: jobId, user_id: replacementUserId, role: 'helper',
    }, { onConflict: 'job_id,user_id,role' })
  } catch (e) {
    console.warn('Associating replacement worker failed:', e?.message || e)
  }

  // Fill the open per-date flags that fall within the chosen window.
  // (Re-query rather than trusting the passed ids, since the supervisor may
  //  have widened/narrowed the range away from the original flag dates.)
  const { data: openFlags } = await supabase
    .from('job_replacement_flags')
    .select('id, flag_date')
    .eq('job_id', jobId)
    .eq('absent_user_id', group.absent_user_id)
    .is('replacement_user_id', null)
    .gte('flag_date', from)
    .lte('flag_date', to)
  const fillIds = (openFlags || []).map(f => f.id)
  if (fillIds.length) {
    await supabase
      .from('job_replacement_flags')
      .update({ replacement_user_id: replacementUserId, replaced_at: new Date().toISOString() })
      .in('id', fillIds)
  }

  // Record the coverage window (A→B) so the "Replaced" / "Replacement for"
  // tags reflect the supervisor-chosen range. Notifications to B + customer
  // fire from the trg_notify_worker_replacement trigger on this insert.
  const { data: cover, error } = await supabase
    .from('worker_replacements')
    .insert({
      job_id: jobId,
      replaced_user_id: group.absent_user_id,
      replacement_user_id: replacementUserId,
      from_date: from,
      to_date: to,
      reason: 'Leave coverage',
      created_by: createdBy || null,
    })
    .select('*')
    .single()
  if (error) throw error

  return cover
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
    supabase.from('jobs').select('id, job_id, job_name, status').in('id', jobIds),
    supabase.from('users').select('id, user_name').in('id', userIds),
  ])
  const jMap = {}; (jobs || []).forEach(j => { jMap[j.id] = j })
  const uMap = {}; (users || []).forEach(u => { uMap[u.id] = u })

  // Only surface replacements for jobs that are still active/ongoing.
  const CLOSED = ['job_closed', 'payment_confirmed', 'cancelled']
  const open = flags.filter(f => {
    const st = jMap[f.job_id]?.status
    return st && !CLOSED.includes(st)
  })

  // Group by job + absent worker, then collapse CONSECUTIVE dates into ranges.
  // Each grouped entry carries every underlying flag id so a single "Replace
  // Worker" action can fill the whole range at once.
  const byKey = {}
  for (const f of open) {
    const key = `${f.job_id}__${f.absent_user_id}`
    ;(byKey[key] ||= []).push(f)
  }

  const addDays = (dateStr, n) => {
    const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  const groups = []
  for (const key of Object.keys(byKey)) {
    const items = byKey[key].sort((a, b) => a.flag_date.localeCompare(b.flag_date))
    let run = null
    for (const f of items) {
      if (run && f.flag_date === addDays(run.to_date, 1)) {
        // extends the current consecutive run
        run.to_date = f.flag_date
        run.flag_ids.push(f.id)
      } else {
        if (run) groups.push(run)
        run = {
          job_id: f.job_id,
          absent_user_id: f.absent_user_id,
          from_date: f.flag_date,
          to_date: f.flag_date,
          flag_ids: [f.id],
          job_code: jMap[f.job_id]?.job_id || '—',
          job_name: jMap[f.job_id]?.job_name || '—',
          absent_name: uMap[f.absent_user_id]?.user_name || '—',
        }
      }
    }
    if (run) groups.push(run)
  }

  // Sort by soonest start date
  groups.sort((a, b) => a.from_date.localeCompare(b.from_date))
  return groups
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

