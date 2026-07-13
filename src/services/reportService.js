import { supabase } from '../../supabase/client'
import { JOB_STATUS_LABELS } from '../constants/jobStatuses'

/**
 * Aggregate analytics for the admin Reports page. Runs under the admin's
 * session (RLS grants full read). All computation is client-side over
 * lightweight selects.
 */
export async function getReports() {
  const [jobsRes, invRes, usersRes, deptRes, attRes] = await Promise.all([
    supabase.from('jobs').select('id, status, job_category, department_id'),
    supabase.from('invoice_balances').select('amount, amount_paid, amount_payable, payment_state, job_id'),
    supabase.from('users').select('user_type, is_active'),
    supabase.from('departments').select('id, department_name'),
    supabase.from('job_attendance').select('total_hours, att_status'),
  ])

  const jobs = jobsRes.data || []
  const invoices = invRes.data || []
  const users = usersRes.data || []
  const depts = deptRes.data || []
  const att = attRes.data || []

  const deptName = {}
  depts.forEach(d => { deptName[d.id] = d.department_name })

  const count = (arr, keyFn) => arr.reduce((m, x) => { const k = keyFn(x); if (k == null) return m; m[k] = (m[k] || 0) + 1; return m }, {})

  const byStatusRaw = count(jobs, j => j.status)
  const jobsByStatus = Object.entries(byStatusRaw).map(([k, v]) => ({ label: JOB_STATUS_LABELS[k] || k, value: v }))
    .sort((a, b) => b.value - a.value)

  const byDeptRaw = count(jobs, j => j.department_id)
  const jobsByDept = Object.entries(byDeptRaw).map(([k, v]) => ({ label: deptName[k] || 'Unassigned', value: v }))
    .sort((a, b) => b.value - a.value)

  const byCategory = count(jobs, j => j.job_category === 'frequent' ? 'Recurring' : 'One-time')

  // Map each job to its status so we can treat invoices for jobs that reached
  // 'Payment Confirmed' or 'Job Closed' as paid/collected — the invoice→paid
  // loop is driven by job lifecycle here rather than a manually-recorded
  // payment field (which isn't being used).
  const jobStatusById = {}
  jobs.forEach(j => { jobStatusById[j.id] = j.status })
  const PAID_STATUSES = ['payment_confirmed', 'job_closed']

  const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const totalCollected = invoices.reduce((s, i) => {
    const paidByStatus = PAID_STATUSES.includes(jobStatusById[i.job_id])
    // Count the full invoice amount as collected when the job is paid/closed;
    // otherwise fall back to any manually recorded amount_paid.
    return s + (paidByStatus ? (Number(i.amount) || 0) : (Number(i.amount_paid) || 0))
  }, 0)
  const outstanding = Math.max(totalInvoiced - totalCollected, 0)
  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0

  const roleCounts = count(users.filter(u => u.is_active), u => u.user_type)

  const approvedHours = att.filter(a => a.att_status === 'approved' || a.att_status === 'completed')
    .reduce((s, a) => s + (Number(a.total_hours) || 0), 0)

  return {
    jobsTotal: jobs.length,
    jobsByStatus,
    jobsByDept,
    byCategory,
    revenue: {
      invoiced: Math.round(totalInvoiced * 100) / 100,
      collected: Math.round(totalCollected * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      collectionRate,
    },
    roleCounts,
    approvedHours: Math.round(approvedHours * 100) / 100,
    attendanceRecords: att.length,
  }
}
