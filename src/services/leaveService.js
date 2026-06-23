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
export async function applyForLeave(requesterId, { leaveDate, duration, reason, note }) {
  const newDuration = duration || 'full_day'

  // One leave request per day — with a half-day exception:
  //   • If a full-day request already exists → block any new request that day.
  //   • If a half-day exists → only allow the OPPOSITE half (not the same half,
  //     not a full day).
  // Rejected requests don't count (the day is effectively free again).
  const { data: existing, error: exErr } = await supabase
    .from('leave_requests')
    .select('id, duration, status')
    .eq('requester_id', requesterId)
    .eq('leave_date', leaveDate)
    .neq('status', 'rejected')
  if (exErr) throw exErr

  if (existing && existing.length > 0) {
    const hasFull = existing.some(r => r.duration === 'full_day')
    const hasFirst = existing.some(r => r.duration === 'first_half')
    const hasSecond = existing.some(r => r.duration === 'second_half')

    if (hasFull) {
      throw new Error('You already have a full-day leave request for this date.')
    }
    if (newDuration === 'full_day') {
      throw new Error('You already have a half-day leave request for this date. You can only request the remaining half.')
    }
    if (newDuration === 'first_half' && hasFirst) {
      throw new Error('You already requested the morning (first half) for this date.')
    }
    if (newDuration === 'second_half' && hasSecond) {
      throw new Error('You already requested the afternoon (second half) for this date.')
    }
    // Otherwise: existing half + opposite half → allowed.
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      requester_id: requesterId,
      leave_date: leaveDate,
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

export async function assignReplacement(flagId, replacementUserId) {
  // Add the replacement worker to the job's associated users first, so the
  // customer-visible assignment exists before notifications fire.
  const { data: existingFlag } = await supabase
    .from('job_replacement_flags').select('job_id').eq('id', flagId).single()
  if (existingFlag?.job_id) {
    try {
      await supabase.from('job_associated_users').upsert({
        job_id: existingFlag.job_id,
        user_id: replacementUserId,
        role: 'helper',
      }, { onConflict: 'job_id,user_id,role' })
    } catch (e) {
      console.warn('Associating replacement worker failed:', e?.message || e)
    }
  }

  // Fill the flag — the trg_notify_replacement_assigned trigger (SECURITY
  // DEFINER) notifies the customer + replacement worker server-side.
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

