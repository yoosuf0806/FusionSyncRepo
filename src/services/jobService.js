import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase/client'

// Service-role client — bypasses RLS for privileged operations
// (auto-assigning supervisor, notifying admins, fetching all users).
const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const _url     = import.meta.env.VITE_SUPABASE_URL
const adminClient = (_svcKey && _svcKey.startsWith('eyJ'))
  ? createClient(_url, _svcKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

/** Map DB invoice row (amount/currency/notes/invoice_attachment_url) to UI fields.
 *  amount_payable is DERIVED here (amount − amount_paid) and never stored. */
export function normalizeInvoiceRow(row) {
  if (!row) return null
  const amount = Number(row.amount ?? 0)
  const amountPaid = Number(row.amount_paid ?? 0)
  const payable = Math.max(amount - amountPaid, 0)
  let paymentState = 'unbilled'
  if (amount > 0) {
    if (amountPaid <= 0) paymentState = 'unpaid'
    else if (amountPaid >= amount) paymentState = 'paid'
    else paymentState = 'partial'
  }
  return {
    ...row,
    invoice_amount: row.invoice_amount ?? row.amount ?? '',
    invoice_amount_paid: row.amount_paid ?? 0,
    invoice_amount_payable: payable,   // DERIVED — not stored
    invoice_payment_state: paymentState,
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
  const paidRaw = invoiceData.invoice_amount_paid
  const paidN = paidRaw === '' || paidRaw == null ? 0 : Number(paidRaw)
  const amount_paid = Number.isFinite(paidN) && paidN >= 0 ? paidN : 0
  return {
    amount,
    amount_paid,
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
  'amount_paid',
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
      .insert(row)
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
  // Check if remark already exists — avoids onConflict named constraint requirement
  const { data: existing } = await supabase
    .from('job_remarks')
    .select('id')
    .eq('job_id', jobId)
    .eq('helpee_id', helpeeId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('job_remarks')
      .update({ rating, remark_text: remark })
      .eq('job_id', jobId)
      .eq('helpee_id', helpeeId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('job_remarks')
      .insert({ job_id: jobId, helpee_id: helpeeId, rating, remark_text: remark })
    if (error) throw error
  }
}

export async function upsertAssociatedUser(jobId, userId, roleInJob) {
  const client = adminClient || supabase
  // Check if row already exists — avoids onConflict which requires a named constraint
  const { data: existing } = await client
    .from('job_associated_users')
    .select('id')
    .eq('job_id', jobId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    // Row exists — update role in case it changed
    const { error } = await client
      .from('job_associated_users')
      .update({ role: roleInJob })
      .eq('job_id', jobId)
      .eq('user_id', userId)
    if (error) throw error
  } else {
    // Row does not exist — insert
    const { error } = await client
      .from('job_associated_users')
      .insert({ job_id: jobId, user_id: userId, role: roleInJob })
    if (error) throw error
  }
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
  const rows = data || []

  // Look up helper names for any rows that have a helper_id set
  const helperIds = [...new Set(rows.map(r => r.helper_id).filter(Boolean))]
  if (helperIds.length > 0) {
    const client = supabase
    const { data: users } = await client
      .from('users')
      .select('id, user_name')
      .in('id', helperIds)
    const nameMap = {}
    ;(users || []).forEach(u => { nameMap[u.id] = u.user_name })
    return rows.map(r => ({ ...r, helper_name: r.helper_id ? (nameMap[r.helper_id] || null) : null }))
  }

  return rows.map(r => ({ ...r, helper_name: null }))
}

/** Fetch only the current helper's own attendance rows for a job */
export async function getAttendanceForHelper(jobId, helperId) {
  const { data, error } = await supabase
    .from('job_attendance')
    .select('*')
    .eq('job_id', jobId)
    .eq('helper_id', helperId)
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
    // helper_id tracks which helper owns this row for multi-helper support
    ...(rowData.helper_id ? { helper_id: rowData.helper_id } : {}),
  }
  if (rowData.id) {
    // Existing row: update by primary key
    const { data, error } = await supabase
      .from('job_attendance')
      .update(payload)
      .eq('id', rowData.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }
  // New row: INSERT (each helper has their own independent row per date)
  const { data, error } = await supabase
    .from('job_attendance')
    .insert(payload)
    .select('*')
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
    .select('*')
    .single()
  if (error) throw error

  // Notify helpers assigned to this job about approve/reject
  try {
    const client = adminClient || supabase
    const jobId = data.job_id
    const jobName = 'your job'
    const date = data.attendance_date || ''

    // Get all helpers on this job
    const { data: helpers } = await client
      .from('job_associated_users')
      .select('user_id')
      .eq('job_id', jobId)
      .eq('role', 'helper')

    const title = newStatus === 'approved'
      ? 'Attendance Approved'
      : 'Attendance Rejected'
    const message = newStatus === 'approved'
      ? `Your attendance for ${date} on "${jobName}" has been approved.`
      : `Your attendance for ${date} on "${jobName}" was rejected${rejectionReason ? ': ' + rejectionReason : '. Please review and resubmit.'}`

    for (const h of (helpers || [])) {
      await client.from('notifications').insert({
        recipient_user_id: h.user_id,
        title,
        message,
        notification_type: 'general',
        related_job_id: jobId,
      }).catch(() => {})
    }
  } catch (e) {
    console.warn('updateAttendanceStatus notification error:', e.message)
  }

  return data
}

// ════════════════════════════════════════════════════════════════════════
// Check-in / Check-out (Phase 3 — per-job, no approval)
// ════════════════════════════════════════════════════════════════════════

/**
 * Try to capture the device's GPS location. Resolves to {lat, lng} or null.
 * Never rejects — a denied/failed permission resolves to null so check-in
 * is never blocked (low-literacy workers must not be stuck on a popup).
 */
export function captureLocation(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),                       // denied or error → null
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  })
}

/**
 * Worker/supervisor checks IN to a job for today.
 * Auto-captures timestamp + GPS. Creates the attendance row if needed.
 * Location null → row flagged location_missing, check-in still succeeds.
 */
export async function checkInToJob(jobId, helperId, { attendanceDate } = {}) {
  const now = new Date()
  const date = attendanceDate || now.toISOString().slice(0, 10)
  const loc = await captureLocation()

  const payload = {
    job_id: jobId,
    helper_id: helperId,
    attendance_date: date,
    checkin_at: now.toISOString(),
    checkin_latitude: loc?.lat ?? null,
    checkin_longitude: loc?.lng ?? null,
    location_missing: loc === null,
  }

  // Upsert on (job_id, attendance_date, helper_id)
  const { data, error } = await supabase
    .from('job_attendance')
    .upsert(payload, { onConflict: 'job_id,attendance_date,helper_id' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * Worker/supervisor checks OUT of a job for today.
 * Auto-captures timestamp + GPS. Updates the existing checked-in row.
 */
export async function checkOutOfJob(rowId, { } = {}) {
  const now = new Date()
  const loc = await captureLocation()

  const payload = {
    checkout_at: now.toISOString(),
    checkout_latitude: loc?.lat ?? null,
    checkout_longitude: loc?.lng ?? null,
  }
  // If checkout location is missing, ensure the flag is set too
  if (loc === null) payload.location_missing = true

  const { data, error } = await supabase
    .from('job_attendance')
    .update(payload)
    .eq('id', rowId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * Supervisor/Admin corrects an attendance record (forgotten checkout,
 * wrong tap, etc.). Preserves the original values in corrected_from for audit.
 */
export async function correctAttendanceRecord(rowId, corrections, correctedByUserId, note) {
  // Fetch current row to snapshot original values
  const { data: current, error: fetchErr } = await supabase
    .from('job_attendance')
    .select('*')
    .eq('id', rowId)
    .single()
  if (fetchErr) throw fetchErr

  const snapshot = {
    checkin_at: current.checkin_at,
    checkout_at: current.checkout_at,
    in_time: current.in_time,
    out_time: current.out_time,
    att_status: current.att_status,
    total_hours: current.total_hours,
  }

  const payload = {
    ...corrections,                       // e.g. { checkin_at, checkout_at }
    corrected_by: correctedByUserId,
    corrected_at: new Date().toISOString(),
    corrected_from: snapshot,
    correction_note: note ?? null,
  }

  const { data, error } = await supabase
    .from('job_attendance')
    .update(payload)
    .eq('id', rowId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * Get the jobs a helper/supervisor should see for check-in/out on a given date.
 * Returns active jobs they're assigned to, with any existing attendance row
 * for that date merged in (so the UI knows check-in/out state).
 */
/**
 * Is a job actually scheduled to run on the given date?
 *   • One-time job  → date must equal job_date
 *   • Recurring job → date must be within [job_from_date, job_to_date]
 *                     AND match the job_days day-of-week filter
 * Used to keep expired/non-scheduled jobs off the My Day check-in surface
 * even when their status is still open (nobody closed them).
 */
export function isJobScheduledOnDate(job, dateStr) {
  if (!job) return false

  // One-time job: single job_date
  if (job.job_date) {
    return job.job_date === dateStr
  }

  // Recurring job: must be within the date range
  const from = job.job_from_date
  const to = job.job_to_date
  if (from && dateStr < from) return false
  if (to && dateStr > to) return false
  // If neither bound exists we can't say it's scheduled — treat as not scheduled
  if (!from && !to) return false

  // Day-of-week filter
  const dow = new Date(dateStr + 'T00:00:00').getDay() // 0=Sun..6=Sat
  const isWeekend = dow === 0 || dow === 6
  if (job.job_days === 'weekdays_only') return !isWeekend
  if (job.job_days === 'weekends_only') return isWeekend
  return true // weekdays_and_weekends (or null) → runs every day in range
}

export async function getJobsForCheckin(userId, attendanceDate) {
  const date = attendanceDate || new Date().toISOString().slice(0, 10)

  // Jobs the user is assigned to (helper or supervisor)
  const { data: assoc, error: assocErr } = await supabase
    .from('job_associated_users')
    .select('job_id, role')
    .eq('user_id', userId)
    .in('role', ['helper', 'supervisor'])
  if (assocErr) throw assocErr

  const jobIds = [...new Set((assoc || []).map(a => a.job_id))]
  if (jobIds.length === 0) return []

  // Fetch the actual jobs, active statuses only
  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('*')
    .in('id', jobIds)
    .not('status', 'in', '(job_closed,cancelled,payment_confirmed)')
  if (jobsErr) throw jobsErr

  // Only surface jobs actually SCHEDULED for this date. A job whose schedule
  // has expired (e.g. recurring job past job_to_date, or a one-time job on a
  // different day) must not appear on My Day even if its status is still open
  // because nobody closed it.
  const scheduledJobs = (jobs || []).filter(job => isJobScheduledOnDate(job, date))

  // Fetch existing attendance rows for this user + date
  const scheduledIds = scheduledJobs.map(j => j.id)
  const { data: attRows } = scheduledIds.length ? await supabase
    .from('job_attendance')
    .select('*')
    .eq('helper_id', userId)
    .eq('attendance_date', date)
    .in('job_id', scheduledIds) : { data: [] }

  const attByJob = {}
  ;(attRows || []).forEach(r => { attByJob[r.job_id] = r })

  // Merge: each job + its attendance state for the date
  return scheduledJobs.map(job => ({
    ...job,
    attendance: attByJob[job.id] || null,
    checkin_state: !attByJob[job.id] ? 'not_started'
      : attByJob[job.id].checkout_at ? 'completed'
      : attByJob[job.id].checkin_at ? 'checked_in'
      : 'not_started',
  }))
}

/**
 * Get upcoming (future) scheduled jobs for a helper/supervisor.
 * Covers ALL future scheduled days. Recurring jobs are returned grouped
 * (one entry per job, with a date range), not one row per day.
 * Excludes today (that's handled by getJobsForCheckin) and closed/cancelled jobs.
 */
export async function getUpcomingJobsForUser(userId, fromDate) {
  const today = fromDate || new Date().toISOString().slice(0, 10)

  const { data: assoc, error: assocErr } = await supabase
    .from('job_associated_users')
    .select('job_id, role')
    .eq('user_id', userId)
    .in('role', ['helper', 'supervisor'])
  if (assocErr) throw assocErr

  const jobIds = [...new Set((assoc || []).map(a => a.job_id))]
  if (jobIds.length === 0) return []

  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('*')
    .in('id', jobIds)
    .not('status', 'in', '(job_closed,cancelled,payment_confirmed)')
  if (jobsErr) throw jobsErr

  const upcoming = []
  for (const job of jobs || []) {
    if (job.job_category === 'frequent') {
      // Recurring — show as a grouped range if any part is still in the future
      const start = job.job_from_date
      const end = job.job_to_date || job.job_from_date
      if (!start) continue
      if (end && end > today) {
        // Range starts either at its own start (if future) or tomorrow
        const displayStart = start > today ? start : nextDay(today)
        upcoming.push({
          ...job,
          is_recurring: true,
          upcoming_from: displayStart,
          upcoming_to: end,
        })
      }
      // else: recurring job has fully expired (end <= today) → don't show
    } else {
      // One-time — single date lives in job_date. Show only if it's in the future.
      const oneDate = job.job_date
      if (oneDate && oneDate > today) {
        upcoming.push({
          ...job,
          is_recurring: false,
          upcoming_from: oneDate,
          upcoming_to: oneDate,
        })
      }
    }
  }

  // Sort by soonest upcoming date
  upcoming.sort((a, b) => (a.upcoming_from < b.upcoming_from ? -1 : 1))
  return upcoming
}

function nextDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Fetch attendance records for the internal team (admin/supervisor) to review
 * and correct. Returns rows enriched with job name/id and helper name.
 *
 * Scoping (enforced here in UI + by RLS in DB):
 *   • admin       → all rows (workers + supervisors)
 *   • supervisor  → workers only (NOT other supervisors, NOT themselves)
 *
 * Optional filters: dateFrom, dateTo, jobId, helperId.
 */
export async function getAllAttendanceRecords({ dateFrom, dateTo, jobId, helperId, viewerType } = {}) {
  let query = supabase
    .from('job_attendance')
    .select('*')
    .order('attendance_date', { ascending: false })

  if (dateFrom) query = query.gte('attendance_date', dateFrom)
  if (dateTo) query = query.lte('attendance_date', dateTo)
  if (jobId) query = query.eq('job_id', jobId)
  if (helperId) query = query.eq('helper_id', helperId)

  const { data: rows, error } = await query
  if (error) throw error
  if (!rows || rows.length === 0) return []

  // Enrich with job + helper names
  const jobIds = [...new Set(rows.map(r => r.job_id).filter(Boolean))]
  const helperIds = [...new Set(rows.map(r => r.helper_id).filter(Boolean))]

  const [{ data: jobs }, { data: users }] = await Promise.all([
    jobIds.length
      ? supabase.from('jobs').select('id, job_id, job_name').in('id', jobIds)
      : Promise.resolve({ data: [] }),
    helperIds.length
      ? supabase.from('users').select('id, user_name, user_type').in('id', helperIds)
      : Promise.resolve({ data: [] }),
  ])

  const jobMap = {}
  ;(jobs || []).forEach(j => { jobMap[j.id] = j })
  const userMap = {}
  ;(users || []).forEach(u => { userMap[u.id] = u })

  let enriched = rows.map(r => ({
    ...r,
    job_code: jobMap[r.job_id]?.job_id || '—',
    job_name: jobMap[r.job_id]?.job_name || '—',
    worker_name: userMap[r.helper_id]?.user_name || '—',
    worker_type: userMap[r.helper_id]?.user_type || null,
  }))

  // Supervisor sees workers (helpers) only — never other supervisors, never self.
  if (viewerType === 'supervisor') {
    enriched = enriched.filter(r => r.worker_type === 'helper')
  }

  return enriched
}

/**
 * Calculate invoice amount from job schedule using the database function.
 * Does NOT create/update the invoice — just returns the computed amount.
 * Returns null if job schedule is incomplete or no rate is configured.
 */
export async function calculateInvoiceAmountFromJobSchedule(jobId) {
  const { data, error } = await supabase.rpc('calc_invoice_amount_from_job', {
    p_job_id: jobId,
  })
  if (error) {
    console.warn('calculateInvoiceAmountFromJobSchedule error:', error.message)
    return null
  }
  return data
}

/**
 * Create or update an invoice for a job, auto-calculating amount from schedule.
 * Called when a job is created, when workers are assigned, or when dates are changed.
 * If an invoice already exists for the job, updates it. Otherwise creates a new one.
 */
export async function autoCreateOrUpdateInvoice(jobId) {
  try {
    // Calculate the amount from job schedule
    const amount = await calculateInvoiceAmountFromJobSchedule(jobId)
    if (amount === null) {
      console.warn(`autoCreateOrUpdateInvoice: no invoice amount for job ${jobId} — job schedule may be incomplete`)
      return null
    }

    // Check if invoice already exists
    const { data: existing, error: selectError } = await supabase
      .from('invoices')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle()

    if (selectError) throw selectError

    if (existing && existing.id) {
      // Update existing invoice with new calculated amount
      const { data: updated, error: updateError } = await supabase
        .from('invoices')
        .update({ amount: amount })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (updateError) throw updateError
      console.log(`Updated invoice for job ${jobId}: amount = ${amount}`)
      return updated
    } else {
      // Create new invoice
      const { data: created, error: insertError } = await supabase
        .from('invoices')
        .insert({
          job_id: jobId,
          amount: amount,
          invoice_status: 'draft',
        })
        .select('*')
        .single()
      if (insertError) throw insertError
      console.log(`Created invoice for job ${jobId}: amount = ${amount}`)
      return created
    }
  } catch (err) {
    console.error('autoCreateOrUpdateInvoice error:', err.message)
    return null
  }
}
