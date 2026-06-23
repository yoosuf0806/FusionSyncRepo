import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase/client'

const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const _url     = import.meta.env.VITE_SUPABASE_URL
const adminClient = (_svcKey && _svcKey.startsWith('eyJ'))
  ? createClient(_url, _svcKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

const PENDING_STATUSES   = ['request_raised', 'manager_assigned', 'helper_assigned']
const ONGOING_STATUSES   = ['job_started', 'job_finished']
const COMPLETED_STATUSES = ['payment_confirmed', 'job_closed']

// ── Helper dashboard ──────────────────────────────────────────────────────
export async function getHelperDashboard(userId) {
  const { data: jauRows } = await supabase
    .from('job_associated_users')
    .select('job_id')
    .eq('user_id', userId)
    .eq('role', 'helper')

  const jobIds = (jauRows || []).map(r => r.job_id)
  if (jobIds.length === 0) return { pending: 0, completed: 0 }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('status')
    .in('id', jobIds)

  const all = jobs || []
  return {
    pending:   all.filter(j => PENDING_STATUSES.includes(j.status) || ONGOING_STATUSES.includes(j.status)).length,
    completed: all.filter(j => COMPLETED_STATUSES.includes(j.status)).length,
  }
}

// ── Helpee dashboard ──────────────────────────────────────────────────────
export async function getHelpeeDashboard(userId) {
  const { data: jauRows } = await supabase
    .from('job_associated_users')
    .select('job_id')
    .eq('user_id', userId)
    .eq('role', 'helpee')

  const jobIds = (jauRows || []).map(r => r.job_id)
  if (jobIds.length === 0) {
    return {
      completed: 0, ongoing: 0, payment_confirmed: 0,
      amount_spent: 0, amount_payable: 0, total_invoiced: 0,
    }
  }

  const [{ data: jobs }, { data: invoices }] = await Promise.all([
    supabase.from('jobs').select('id, status').in('id', jobIds),
    supabase.from('invoices').select('job_id, amount').in('job_id', jobIds),
  ])

  const all = jobs || []

  // Build a map of job status for quick lookup
  const jobStatusMap = {}
  for (const job of all) {
    jobStatusMap[job.id] = job.status
  }

  // Account balance — based on job status, not amount_paid.
  // amount_spent = invoices for jobs that are payment_confirmed or job_closed
  // amount_payable = invoices for jobs still in progress
  let amountSpent = 0
  let amountPayable = 0
  let totalInvoiced = 0

  for (const inv of invoices || []) {
    const amt = Number(inv.amount ?? 0)
    const jobStatus = jobStatusMap[inv.job_id]
    totalInvoiced += amt

    if (jobStatus === 'payment_confirmed' || jobStatus === 'job_closed') {
      amountSpent += amt
    } else {
      amountPayable += amt
    }
  }

  return {
    ongoing:           all.filter(j => ONGOING_STATUSES.includes(j.status)).length,
    completed:         all.filter(j => COMPLETED_STATUSES.includes(j.status)).length,
    payment_confirmed: all.filter(j => j.status === 'payment_confirmed' || j.status === 'job_closed').length,
    amount_spent:      Math.round(amountSpent * 100) / 100,
    amount_payable:    Math.round(amountPayable * 100) / 100,
    total_invoiced:    Math.round(totalInvoiced * 100) / 100,
  }
}

// ── Supervisor dashboard ──────────────────────────────────────────────────
export async function getSupervisorDashboard() {
  const client = adminClient || supabase

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status')

  const all = jobs || []

  // Helpers not assigned to any job
  const { data: assignedHelpers } = await client
    .from('job_associated_users')
    .select('user_id')
    .eq('role', 'helper')
  const assignedHelperIds = new Set((assignedHelpers || []).map(r => r.user_id))

  const { data: allHelpers } = await client
    .from('users')
    .select('id')
    .eq('user_type', 'helper')
    .eq('is_active', true)
  const unassignedHelpers = (allHelpers || []).filter(h => !assignedHelperIds.has(h.id)).length

  // Open replacement flags (per-job-per-date, unfilled)
  const { count: replacementsNeeded } = await client
    .from('job_replacement_flags')
    .select('id', { count: 'exact', head: true })
    .is('replacement_user_id', null)

  return {
    unassigned_jobs: all.filter(j => j.status === 'request_raised').length,
    pending:         all.filter(j => PENDING_STATUSES.includes(j.status)).length,
    ongoing:         all.filter(j => ONGOING_STATUSES.includes(j.status)).length,
    completed:       all.filter(j => COMPLETED_STATUSES.includes(j.status)).length,
    unassigned_helpers: unassignedHelpers,
    replacements_needed: replacementsNeeded || 0,
  }
}

// ── Admin dashboard ───────────────────────────────────────────────────────
export async function getAdminDashboard() {
  const client = adminClient || supabase

  const [
    { data: users },
    { data: jobs },
    { data: assignedHelpers },
    { data: allHelpers },
  ] = await Promise.all([
    client.from('users').select('id').eq('is_active', true),
    client.from('jobs').select('id, status'),
    client.from('job_associated_users').select('user_id').eq('role', 'helper'),
    client.from('users').select('id').eq('user_type', 'helper').eq('is_active', true),
  ])

  const allJobs = jobs || []
  const assignedHelperIds = new Set((assignedHelpers || []).map(r => r.user_id))
  const unassignedHelpers = (allHelpers || []).filter(h => !assignedHelperIds.has(h.id)).length

  const { count: replacementsNeeded } = await client
    .from('job_replacement_flags')
    .select('id', { count: 'exact', head: true })
    .is('replacement_user_id', null)

  return {
    total_users:        (users || []).length,
    total_jobs:         allJobs.length,
    completed:          allJobs.filter(j => COMPLETED_STATUSES.includes(j.status)).length,
    pending:            allJobs.filter(j => PENDING_STATUSES.includes(j.status)).length,
    unassigned_helpers: unassignedHelpers,
    replacements_needed: replacementsNeeded || 0,
  }
}
