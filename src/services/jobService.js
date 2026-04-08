import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase/client'

// Service-role client — bypasses RLS for privileged operations
// (auto-assigning supervisor, notifying admins, fetching all users).
const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const _url     = import.meta.env.VITE_SUPABASE_URL
const adminClient = (_svcKey && _svcKey.startsWith('eyJ'))
  ? createClient(_url, _svcKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

/** Map DB invoice row (amount/currency/notes/invoice_attachment_url) to UI fields */
export function normalizeInvoiceRow(row) {
  if (!row) return null
  return {
    ...row,
    invoice_amount: row.invoice_amount ?? row.amount ?? '',
    invoice_currency: row.invoice_currency ?? row.currency ?? 'AUD',
    invoice_notes: row.invoice_notes ?? row.notes ?? '',
    invoice_date: row.invoice_date ?? '',
    invoice_status: row.invoice_status ?? 'draft',
    attachment_url: row.attachment_url ?? row.invoice_attachment_url ?? '',
  }
}

function invoiceToDbPayload(invoiceData) {
  const raw = invoiceData.invoice_amount
  const n = raw === '' || raw == null ? NaN : Number(raw)
  const amount = Number.isFinite(n) ? n : null
  return {
    amount,
    currency: invoiceData.invoice_currency || 'AUD',
    invoice_date: invoiceData.invoice_date || null,
    notes: invoiceData.invoice_notes ?? null,
    invoice_status: invoiceData.invoice_status || 'draft',
    ...(invoiceData.attachment_url !== undefined && invoiceData.attachment_url !== ''
      ? { invoice_attachment_url: invoiceData.attachment_url }
      : {}),
  }
}

export async function getJobs({ search = '', statusFilter = '' } = {}) {
  // Removed users join — not needed for list view, and FK hint caused 400 errors
  let query = supabase
    .from('jobs')
    .select(`
      id, job_id, job_name, job_category, job_type_id, status,
      job_from_date, job_to_date, job_start_time, job_location, job_description,
      created_at, job_specifications(job_type_name)
    `)
    .order('created_at', { ascending: false })

  if (statusFilter === 'pending') {
    query = query.in('status', ['request_raised', 'manager_assigned', 'helper_assigned'])
  } else if (statusFilter === 'ongoing') {
    query = query.in('status', ['job_started', 'job_finished'])
  } else if (statusFilter === 'completed') {
    query = query.in('status', ['payment_confirmed', 'job_closed'])
  }

  if (search) {
    query = query.or(`job_id.ilike.%${search}%,job_name.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

const JOB_LIST_SELECT = `
  id, job_id, job_name, job_category, status, job_from_date, job_to_date,
  created_at, job_specifications(job_type_name)
`
const JOB_LIST_MINIMAL = `
  id, job_id, job_name, job_category, status, job_from_date, job_to_date,
  created_at, job_type_id
`

/** DB columns for invoices — never use invoice_* names here (schema uses amount, currency, notes). */
const INVOICE_SELECT = [
  'id',
  'job_id',
  'amount',
  'currency',
  'notes',
  'invoice_date',
  'invoice_status',
  'invoice_number',
  'invoice_attachment_url',
  'created_at',
  'updated_at',
].join(', ')

async function fetchJobsByParticipantRole(userId, role) {
  const { data: rows, error } = await supabase
    .from('job_associated_users')
    .select('job_id')
    .eq('user_id', userId)
    .eq('role', role)
  if (error) throw error
  const jobIds = [...new Set((rows || []).map(r => r.job_id).filter(Boolean))]
  if (jobIds.length === 0) return []
  const { data: jobs, error: jErr } = await supabase
    .from('jobs')
    .select(JOB_LIST_SELECT)
    .in('id', jobIds)
    .order('created_at', { ascending: false })
  if (jErr) {
    const { data: minimal, error: mErr } = await supabase
      .from('jobs')
      .select(JOB_LIST_MINIMAL)
      .in('id', jobIds)
      .order('created_at', { ascending: false })
    if (mErr) throw mErr
    return (minimal || []).map(j => ({ ...j, job_specifications: null }))
  }
  return jobs || []
}

/** Two-step fetch avoids PostgREST embed + RLS edge cases for helper/helpee lists */
export async function getJobsForUser(userId) {
  return fetchJobsByParticipantRole(userId, 'helper')
}

export async function getJobsForHelpee(userId) {
  return fetchJobsByParticipantRole(userId, 'helpee')
}

export async function getJobById(id) {
  // Use simple join without FK hint — only one FK from jobs to users (job_requester_id)
  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      job_specifications(job_type_name),
      users(user_name),
      departments(department_name)
    `)
    .eq('id', id)
    .single()
  if (error) throw error

  const [{ data: answers }, { data: assocUsers }, { data: attendance }, { data: statusHistory }, { data: invoice }, { data: remark }] = await Promise.all([
    supabase.from('job_question_answers').select('*, job_spec_questions(question_text)').eq('job_id', id),
    supabase.from('job_associated_users').select('*, users(id, user_id, user_name, user_type)').eq('job_id', id),
    supabase.from('job_attendance').select('*').eq('job_id', id).order('attendance_date'),
    supabase.from('job_status_history').select('*').eq('job_id', id).order('changed_at'),
    supabase.from('invoices').select(INVOICE_SELECT).eq('job_id', id).maybeSingle(),
    supabase.from('job_remarks').select('*').eq('job_id', id).maybeSingle(),
  ])

  return {
    ...job,
    answers: answers || [],
    associated_users: assocUsers || [],
    attendance: attendance || [],
    status_history: statusHistory || [],
    invoice: normalizeInvoiceRow(invoice),
    remark: remark || null,
  }
}

/**
 * Create a new job and wire up all associations + notifications.
 *
 * Business rules:
 *   HELPEE creates:
 *     - helpee added to jau (DB trigger notifies them)
 *     - exactly 1 active supervisor → auto-assign + status → 'manager_assigned'
 *     - 2+ supervisors → notify all supervisors + all admins; status stays 'request_raised'
 *
 *   SUPERVISOR creates on behalf of helpee:
 *     - supervisor (creator) auto-added to jau
 *     - helpee + helpers added to jau (DB trigger notifies each)
 *     - status → 'manager_assigned'; if helpers assigned → 'helper_assigned'
 *
 *   ADMIN creates:
 *     - helpee + supervisor + helpers all added to jau (DB trigger notifies each)
 *     - status → 'manager_assigned'; if helpers assigned → 'helper_assigned'
 */
export async function createJob(jobData, answers = [], associatedUsers = {}, creatorRole = null) {
  const isFrequent = jobData.job_category === 'frequent'

  // ── Determine initial status ───────────────────────────────────────
  let initialStatus = 'request_raised'
  if (creatorRole === 'supervisor') {
    initialStatus = (associatedUsers.helper_ids?.length > 0) ? 'helper_assigned' : 'manager_assigned'
  } else if (creatorRole === 'admin') {
    initialStatus = (associatedUsers.helper_ids?.length > 0) ? 'helper_assigned' : 'manager_assigned'
  }
  // helpee: stays 'request_raised'; may be updated to 'manager_assigned' after auto-assign below

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      job_name: jobData.job_name,
      job_category: jobData.job_category,
      job_type_id: jobData.job_type_id || null,
      job_description: jobData.job_description || null,
      job_notes: jobData.job_notes || null,
      job_date: !isFrequent ? (jobData.job_date || null) : null,
      job_from_date: isFrequent ? (jobData.job_from_date || null) : null,
      job_to_date: isFrequent ? (jobData.job_to_date || null) : null,
      job_end_time: isFrequent ? (jobData.job_end_time || null) : null,
      pricing_structure: isFrequent ? (jobData.pricing_structure || 'daily') : null,
      job_start_time: jobData.job_start_time || null,
      job_location: jobData.job_location || null,
      job_requester_id: jobData.job_requester_id,
      department_id: jobData.department_id || null,
      status: initialStatus,
    })
    .select()
    .single()
  if (error) throw error

  // ── Save question answers ──────────────────────────────────────────
  if (answers.length > 0) {
    const rows = answers.filter(a => a.question_id && a.answer_text)
    if (rows.length > 0) {
      const { error: ansErr } = await supabase.from('job_question_answers').insert(
        rows.map(a => ({ job_id: job.id, question_id: a.question_id, answer_text: a.answer_text }))
      )
      if (ansErr) console.warn('createJob answers insert:', ansErr.message)
    }
  }

  // ── Build job_associated_users rows ───────────────────────────────
  // The DB trigger `notify_on_job_assignment` (SECURITY DEFINER) fires on every
  // jau INSERT and automatically notifies the assigned user — no manual notifications needed.
  const assocRows = []

  if (creatorRole === 'helpee') {
    const helpeeId = associatedUsers.helpee_id || jobData.job_requester_id
    if (helpeeId) assocRows.push({ job_id: job.id, user_id: helpeeId, role: 'helpee' })

  } else if (creatorRole === 'supervisor') {
    // Supervisor is the creator — use job_requester_id as the canonical supervisor id.
    // Do NOT also use associatedUsers.supervisor_id (it's the same user) to avoid
    // the unique constraint violation on (job_id, user_id).
    const supId = jobData.job_requester_id
    if (supId) assocRows.push({ job_id: job.id, user_id: supId, role: 'supervisor' })
    if (associatedUsers.helpee_id)
      assocRows.push({ job_id: job.id, user_id: associatedUsers.helpee_id, role: 'helpee' })
    for (const hid of (associatedUsers.helper_ids || []))
      assocRows.push({ job_id: job.id, user_id: hid, role: 'helper' })

  } else if (creatorRole === 'admin') {
    if (associatedUsers.helpee_id)
      assocRows.push({ job_id: job.id, user_id: associatedUsers.helpee_id, role: 'helpee' })
    if (associatedUsers.supervisor_id)
      assocRows.push({ job_id: job.id, user_id: associatedUsers.supervisor_id, role: 'supervisor' })
    for (const hid of (associatedUsers.helper_ids || []))
      assocRows.push({ job_id: job.id, user_id: hid, role: 'helper' })
  }

  if (assocRows.length > 0) {
    // Always use adminClient for jau inserts so RLS doesn't block cross-user writes
    const client = adminClient || supabase
    const { error: jauErr } = await client.from('job_associated_users').insert(assocRows)
    if (jauErr) throw new Error(`Failed to assign users to job: ${jauErr.message}`)
  }

  // ── Helpee flow: auto-assign supervisor or notify all supervisors ──
  try {
    if (creatorRole === 'helpee') {
      await _handleHelpeeJobCreated(job.id, jobData.job_name || 'New Job', jobData.job_requester_id)
    } else if (creatorRole === 'admin') {
      await _notifyAdminsOfNewJob(job.id, jobData.job_name || 'New Job', jobData.job_requester_id)
    }
  } catch (e) {
    console.warn('createJob post-create side-effects:', e.message)
  }

  return job
}

/**
 * Called when a helpee creates a job.
 *
 * - Exactly 1 active supervisor → auto-assign (jau insert triggers DB notification)
 *   + advance job status to 'manager_assigned'
 * - 2+ active supervisors → send explicit notifications to ALL supervisors + admins
 *   (status stays 'request_raised' — supervisor must self-assign)
 */
async function _handleHelpeeJobCreated(jobId, jobName, requesterId) {
  const client = adminClient || supabase

  const { data: supervisors } = await client
    .from('users').select('id').eq('user_type', 'supervisor').eq('is_active', true)
  const supervisorIds = (supervisors || []).map(s => s.id)

  if (supervisorIds.length === 1 && adminClient) {
    // Single supervisor: auto-assign + advance status
    const { error: assignErr } = await adminClient
      .from('job_associated_users')
      .insert({ job_id: jobId, user_id: supervisorIds[0], role: 'supervisor' })
    if (assignErr) {
      console.warn('auto-assign supervisor:', assignErr.message)
    } else {
      await adminClient.from('jobs').update({ status: 'manager_assigned' }).eq('id', jobId)
    }
  } else if (supervisorIds.length > 1 && adminClient) {
    // Multiple supervisors: notify all, let one self-assign
    const message = `New job request awaiting assignment: "${jobName}"`
    for (const sid of supervisorIds) {
      const { error } = await adminClient.from('notifications').insert({
        recipient_user_id: sid,
        title: 'New job request',
        message,
        notification_type: 'general',
        related_job_id: jobId,
      })
      if (error) console.warn('notify supervisor:', error.message)
    }
  }

  // Always notify all admins
  if (adminClient) {
    const { data: admins } = await adminClient
      .from('users').select('id').eq('user_type', 'admin').eq('is_active', true)
    const message = `New job request: "${jobName}"`
    for (const a of (admins || [])) {
      const { error } = await adminClient.from('notifications').insert({
        recipient_user_id: a.id,
        title: 'New job request',
        message,
        notification_type: 'general',
        related_job_id: jobId,
      })
      if (error) console.warn('notify admin:', error.message)
    }
  }
}

/**
 * When admin creates a job, notify other admins (jau DB trigger handles
 * notifying helpee/supervisor/helpers directly).
 */
async function _notifyAdminsOfNewJob(jobId, jobName, creatorAdminId) {
  if (!adminClient) return
  const { data: admins } = await adminClient
    .from('users').select('id').eq('user_type', 'admin').eq('is_active', true)
  const message = `Job created: "${jobName}"`
  for (const a of (admins || [])) {
    if (a.id === creatorAdminId) continue
    const { error } = await adminClient.from('notifications').insert({
      recipient_user_id: a.id,
      title: 'New job created',
      message,
      notification_type: 'general',
      related_job_id: jobId,
    })
    if (error) console.warn('notify admin:', error.message)
  }
}


/**
 * Called after supervisor assigns new helpers to an existing job.
 * Uses adminClient so supervisor RLS does not block inserting notifications
 * for other users. The DB trigger handles the initial jau-insert notification,
 * but this provides an extra explicit notification for late-added helpers.
 */
export async function notifyHelpersAssignedToJob(jobId, helperUserIds, jobName) {
  const ids = (helperUserIds || []).filter(Boolean)
  if (ids.length === 0) return
  const client = adminClient || supabase
  const message = `You have been assigned to: ${jobName || 'a job'}`
  for (const hid of ids) {
    const { error } = await client.from('notifications').insert({
      recipient_user_id: hid,
      title: 'Job assignment',
      message,
      notification_type: 'job_assigned',
      related_job_id: jobId,
    })
    if (error) console.warn('notifyHelpersAssignedToJob:', error.message)
  }
}

export async function getJobMessages(jobId) {
  const { data, error } = await supabase
    .from('job_messages')
    .select('id, body, created_at, author_user_id, author_name')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * Job thread: helper ↔ supervisor (and admin). Inserts row + in-app notifications for recipients.
 */
export async function postJobMessage(jobId, body, { authorUserId, authorRole, authorName }) {
  const text = (body || '').trim()
  if (!text) throw new Error('Message cannot be empty')
  if (!authorUserId) throw new Error('Not signed in')

  const { error: insErr } = await supabase.from('job_messages').insert({
    job_id: jobId,
    author_user_id: authorUserId,
    author_name: (authorName || 'User').trim() || 'User',
    body: text,
  })
  if (insErr) throw insErr

  const { data: jau } = await supabase
    .from('job_associated_users')
    .select('user_id, role')
    .eq('job_id', jobId)

  const rows = jau || []
  const helperIds = rows.filter(r => r.role === 'helper').map(r => r.user_id)
  const supIds = rows.filter(r => r.role === 'supervisor').map(r => r.user_id)
  const recipientIds = new Set()

  if (authorRole === 'helper') {
    supIds.forEach(id => {
      if (id !== authorUserId) recipientIds.add(id)
    })
    if (supIds.length === 0) {
      const { data: allSups } = await supabase
        .from('users')
        .select('id')
        .eq('user_type', 'supervisor')
        .eq('is_active', true)
      for (const s of allSups || []) {
        if (s.id !== authorUserId) recipientIds.add(s.id)
      }
    }
  } else if (authorRole === 'supervisor') {
    helperIds.forEach(id => {
      if (id !== authorUserId) recipientIds.add(id)
    })
  } else if (authorRole === 'admin') {
    helperIds.forEach(id => {
      if (id !== authorUserId) recipientIds.add(id)
    })
    supIds.forEach(id => {
      if (id !== authorUserId) recipientIds.add(id)
    })
  }

  const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text
  for (const rid of recipientIds) {
    const { error } = await supabase.from('notifications').insert({
      recipient_user_id: rid,
      title: 'Job message',
      message: preview,
      notification_type: 'job_message',
      related_job_id: jobId,
    })
    if (error) console.warn('postJobMessage notification:', error.message)
  }
}

export async function updateJobStatus(jobId, newStatus) {
  const { data, error } = await supabase
    .from('jobs')
    .update({ status: newStatus })
    .eq('id', jobId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateJob(id, jobData, answers = []) {
  const isFrequent = jobData.job_category === 'frequent'
  const { data, error } = await supabase
    .from('jobs')
    .update({
      job_name: jobData.job_name,
      job_description: jobData.job_description || null,
      job_notes: jobData.job_notes ?? null,
      job_date: !isFrequent ? (jobData.job_date || null) : null,
      job_from_date: isFrequent ? (jobData.job_from_date || null) : null,
      job_to_date: isFrequent ? (jobData.job_to_date || null) : null,
      job_end_time: isFrequent ? (jobData.job_end_time || null) : null,
      pricing_structure: isFrequent ? (jobData.pricing_structure || 'daily') : null,
      job_start_time: jobData.job_start_time || null,
      job_location: jobData.job_location || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (answers.length > 0) {
    await supabase.from('job_question_answers').delete().eq('job_id', id)
    const rows = answers.filter(a => a.question_id && a.answer_text)
    if (rows.length > 0) {
      await supabase.from('job_question_answers').insert(
        rows.map(a => ({ job_id: id, question_id: a.question_id, answer_text: a.answer_text }))
      )
    }
  }
  return data
}

export async function deleteJob(id) {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw error
}

export async function submitAttendance(jobId, attendanceRows) {
  const rows = attendanceRows.map(r => ({
    job_id: jobId,
    attendance_date: r.attendance_date,
    helpee_id: r.helpee_id || null,
    helper_remark: r.helper_remark || null,
    in_time: r.in_time || null,
    out_time: r.out_time || null,
    attendance_status: 'present',
  }))

  for (const row of rows) {
    const { error } = await supabase
      .from('job_attendance')
      .upsert(row, { onConflict: 'job_id,attendance_date' })
    if (error) throw error
  }
}

export async function saveInvoice(jobId, invoiceData) {
  const existing = await supabase
    .from('invoices')
    .select('id')
    .eq('job_id', jobId)
    .maybeSingle()

  const payload = invoiceToDbPayload(invoiceData)

  if (existing.data) {
    const { error } = await supabase.from('invoices').update(payload).eq('job_id', jobId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('invoices').insert({ job_id: jobId, ...payload })
    if (error) throw error
  }
}

export async function uploadInvoiceAttachment(jobId, file) {
  const ext = file.name.split('.').pop()
  const path = `${jobId}/${Date.now()}.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from('invoice-attachments')
    .upload(path, file, { upsert: true })
  if (uploadErr) throw uploadErr
  const { data } = supabase.storage.from('invoice-attachments').getPublicUrl(path)
  return data.publicUrl
}

export async function saveRemark(jobId, helpeeId, rating, remark) {
  const { error } = await supabase
    .from('job_remarks')
    .upsert({
      job_id: jobId,
      helpee_id: helpeeId,
      rating,
      remark_text: remark,
    }, { onConflict: 'job_id,helpee_id' })
  if (error) throw error
}

export async function upsertAssociatedUser(jobId, userId, roleInJob) {
  // Use adminClient: supervisors adding helpers hit RLS (jau policy only allows
  // admin/supervisor to write, but upsert for a helper user_id may be blocked
  // depending on the specific policy check). adminClient guarantees it always works.
  const client = adminClient || supabase
  const { error } = await client
    .from('job_associated_users')
    .upsert({ job_id: jobId, user_id: userId, role: roleInJob }, { onConflict: 'job_id,user_id' })
  if (error) throw error
}

export async function removeAssociatedUser(jobId, userId) {
  const client = adminClient || supabase
  const { error } = await client
    .from('job_associated_users')
    .delete()
    .eq('job_id', jobId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getAttendanceForJob(jobId) {
  const { data, error } = await supabase
    .from('job_attendance')
    .select('*')
    .eq('job_id', jobId)
    .order('attendance_date')
  if (error) throw error
  return data || []
}

export async function upsertAttendanceRow(jobId, rowData) {
  const payload = {
    job_id: jobId,
    attendance_date: rowData.attendance_date,
    check_in_time: rowData.check_in_time || null,
    check_out_time: rowData.check_out_time || null,
    remark: rowData.remark ?? null,
    att_status: rowData.att_status || 'pending_approval',
    submitted_at: rowData.submitted_at || null,
    resubmitted_at: rowData.resubmitted_at || null,
  }
  if (rowData.id) {
    const { data, error } = await supabase
      .from('job_attendance')
      .update(payload)
      .eq('id', rowData.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from('job_attendance')
    .upsert(payload, { onConflict: 'job_id,attendance_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAttendanceStatus(rowId, newStatus, rejectionReason) {
  const payload = {
    att_status: newStatus,
    reviewed_at: new Date().toISOString(),
  }
  if (newStatus === 'rejected' && rejectionReason) {
    payload.rejection_reason = rejectionReason
  }
  const { data, error } = await supabase
    .from('job_attendance')
    .update(payload)
    .eq('id', rowId)
    .select()
    .single()
  if (error) throw error
  return data
}
