import { supabase } from '../supabase/client'

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

export async function getJobsForUser(userId) {
  const { data, error } = await supabase
    .from('job_associated_users')
    .select(`
      jobs(id, job_id, job_name, job_category, status, job_from_date, job_to_date,
           job_specifications(job_type_name))
    `)
    .eq('user_id', userId)
    .eq('role_in_job', 'helper')
  if (error) throw error
  return (data || []).map(r => r.jobs).filter(Boolean)
}

export async function getJobsForHelpee(userId) {
  const { data, error } = await supabase
    .from('job_associated_users')
    .select(`
      jobs(id, job_id, job_name, job_category, status, job_from_date, job_to_date,
           job_specifications(job_type_name))
    `)
    .eq('user_id', userId)
    .eq('role_in_job', 'helpee')
  if (error) throw error
  return (data || []).map(r => r.jobs).filter(Boolean)
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
    supabase.from('invoices').select('*').eq('job_id', id).maybeSingle(),
    supabase.from('job_remarks').select('*').eq('job_id', id).maybeSingle(),
  ])

  return {
    ...job,
    answers: answers || [],
    associated_users: assocUsers || [],
    attendance: attendance || [],
    status_history: statusHistory || [],
    invoice: invoice || null,
    remark: remark || null,
  }
}

export async function createJob(jobData, answers = [], associatedUsers = {}) {
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      job_name: jobData.job_name,
      job_category: jobData.job_category,
      job_type_id: jobData.job_type_id || null,
      job_description: jobData.job_description || null,
      job_from_date: jobData.job_from_date,
      job_to_date: jobData.job_to_date,
      job_start_time: jobData.job_start_time || null,
      job_location: jobData.job_location || null,
      job_requester_id: jobData.job_requester_id,
      department_id: jobData.department_id || null,
      status: 'request_raised',
    })
    .select()
    .single()
  if (error) throw error

  if (answers.length > 0) {
    const rows = answers.filter(a => a.question_id && a.answer_text)
    if (rows.length > 0) {
      await supabase.from('job_question_answers').insert(
        rows.map(a => ({ job_id: job.id, question_id: a.question_id, answer_text: a.answer_text }))
      )
    }
  }

  const assocRows = []
  if (associatedUsers.helpee_id) assocRows.push({ job_id: job.id, user_id: associatedUsers.helpee_id, role_in_job: 'helpee' })
  if (associatedUsers.supervisor_id) assocRows.push({ job_id: job.id, user_id: associatedUsers.supervisor_id, role_in_job: 'supervisor' })
  if (associatedUsers.helper_ids?.length) {
    for (const hid of associatedUsers.helper_ids) {
      assocRows.push({ job_id: job.id, user_id: hid, role_in_job: 'helper' })
    }
  }
  if (assocRows.length > 0) {
    await supabase.from('job_associated_users').insert(assocRows)
  }

  return job
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
  const { data, error } = await supabase
    .from('jobs')
    .update({
      job_name: jobData.job_name,
      job_description: jobData.job_description || null,
      job_from_date: jobData.job_from_date,
      job_to_date: jobData.job_to_date,
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

  if (existing.data) {
    const { error } = await supabase
      .from('invoices')
      .update({
        invoice_amount: invoiceData.invoice_amount,
        invoice_currency: invoiceData.invoice_currency || 'AUD',
        invoice_date: invoiceData.invoice_date || null,
        invoice_notes: invoiceData.invoice_notes || null,
        invoice_status: invoiceData.invoice_status || 'draft',
      })
      .eq('job_id', jobId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('invoices').insert({
      job_id: jobId,
      invoice_amount: invoiceData.invoice_amount,
      invoice_currency: invoiceData.invoice_currency || 'AUD',
      invoice_date: invoiceData.invoice_date || null,
      invoice_notes: invoiceData.invoice_notes || null,
      invoice_status: invoiceData.invoice_status || 'draft',
    })
    if (error) throw error
  }
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
  const { error } = await supabase
    .from('job_associated_users')
    .upsert({ job_id: jobId, user_id: userId, role_in_job: roleInJob }, { onConflict: 'job_id,user_id' })
  if (error) throw error
}
