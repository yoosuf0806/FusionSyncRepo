import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  getJobById, createJob, updateJob, updateJobStatus,
  submitAttendance, saveInvoice, upsertAssociatedUser,
} from '../../services/jobService'
import { getJobSpecs, getQuestionsForSpec } from '../../services/jobSpecService'
import { getUsers } from '../../services/userService'
import FormRow from '../../components/FormRow'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import ConfirmModal from '../../components/ConfirmModal'
import { WORKFLOW_STAGES, JOB_STATUS_LABELS, isStageComplete } from '../../constants/jobStatuses'

// ── User Picker Modal ──────────────────────────────────────────────────────
function UserPickerModal({ roleFilter, onSelect, onClose }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getUsers({ search, userType: roleFilter }).then(data => {
      setUsers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [search, roleFilter])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold">Select {roleFilter}</h3>
          <button onClick={onClose} className="btn-icon w-8 h-8 text-xl">✕</button>
        </div>
        <div className="px-5 py-3">
          <input
            className="form-cell w-full outline-none text-sm"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {loading ? (
            <p className="text-sm text-hh-placeholder py-4 text-center">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-hh-placeholder py-4 text-center">No users found</p>
          ) : (
            users.map(u => (
              <div key={u.id} className="flex items-center justify-between hh-card px-4 py-2">
                <div>
                  <p className="text-sm font-medium">{u.user_name}</p>
                  <p className="text-xs text-hh-placeholder">{u.user_id} · {u.user_type}</p>
                </div>
                <button onClick={() => onSelect(u)} className="btn-select px-4 text-sm">Select</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Invoice Modal ──────────────────────────────────────────────────────────
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void']

function InvoiceModal({ jobId, existing, onSave, onClose }) {
  const [form, setForm] = useState({
    invoice_amount: existing?.invoice_amount || '',
    invoice_currency: existing?.invoice_currency || 'AUD',
    invoice_date: existing?.invoice_date || '',
    invoice_notes: existing?.invoice_notes || '',
    invoice_status: existing?.invoice_status || 'draft',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.invoice_amount) { setError('Amount is required'); return }
    setSaving(true)
    try {
      await saveInvoice(jobId, form)
      onSave({ ...form })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Invoice Details</h3>
          <button onClick={onClose} className="btn-icon w-8 h-8">✕</button>
        </div>
        {error && <p className="text-hh-error text-xs">{error}</p>}
        {[
          { label: 'Amount', key: 'invoice_amount', type: 'number', placeholder: '0.00' },
          { label: 'Currency', key: 'invoice_currency', type: 'text', placeholder: 'AUD' },
          { label: 'Date', key: 'invoice_date', type: 'date' },
          { label: 'Notes', key: 'invoice_notes', type: 'text', placeholder: 'Notes' },
        ].map(({ label, key, type, placeholder }) => (
          <FormRow key={key} label={label} labelWidth="w-28">
            <input type={type} className="form-cell flex-1 outline-none text-sm w-full"
              value={form[key]} placeholder={placeholder}
              onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} />
          </FormRow>
        ))}
        <FormRow label="Status" labelWidth="w-28">
          <select className="form-cell flex-1 outline-none text-sm w-full" value={form.invoice_status}
            onChange={e => setForm(prev => ({ ...prev, invoice_status: e.target.value }))}>
            {INVOICE_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </FormRow>
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-action px-6">
            {saving ? 'Saving...' : 'Save Invoice'}
          </button>
          <button onClick={onClose} className="btn-filter">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Workflow Display ───────────────────────────────────────────────────────
function WorkflowDisplay({ status }) {
  return (
    <div className="w-full overflow-x-auto py-2">
      <div className="flex items-center gap-1 min-w-max">
        {WORKFLOW_STAGES.map((stage, i) => {
          const complete = isStageComplete(status, stage.key)
          return (
            <div key={stage.key} className="flex items-center gap-1">
              <div className={`
                flex flex-col items-center justify-center rounded-hh text-xs font-medium text-center
                w-20 h-11 px-1
                ${complete ? 'bg-hh-green text-white' : 'bg-hh-node-off text-white'}
              `}>
                {stage.label.map((l, j) => <span key={j}>{l}</span>)}
              </div>
              {i < WORKFLOW_STAGES.length - 1 && (
                <svg className={`w-4 h-4 flex-shrink-0 ${complete ? 'text-hh-green' : 'text-hh-node-off'}`}
                  fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
const JOB_CATEGORIES = { ONETIME: 'one-time', FREQUENT: 'frequent' }

export default function JobForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const { user: authUser, isAdmin, isSupervisor, isHelper, isHelpee } = useAuth()

  const isEdit = Boolean(id)
  const [category, setCategory] = useState(
    location.pathname.includes('frequent') ? JOB_CATEGORIES.FREQUENT : JOB_CATEGORIES.ONETIME
  )

  // detect category from existing job's job_category field

  const [form, setForm] = useState({
    job_name: '', job_description: '', job_type_id: '', job_from_date: '', job_to_date: '',
    job_start_time: '', job_location: '', job_requester_id: null, department_id: null,
  })
  const [jobId, setJobId] = useState('Auto-generated')
  const [status, setStatus] = useState('request_raised')
  const [dbJobId, setDbJobId] = useState(null)

  const [specs, setSpecs] = useState([])
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])

  const [helpee, setHelpee] = useState(null)
  const [helper, setHelper] = useState(null)
  const [supervisor, setSupervisor] = useState(null)

  const [invoice, setInvoice] = useState(null)
  const [attendance, setAttendance] = useState([])

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [userPickerRole, setUserPickerRole] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showInvoiceView, setShowInvoiceView] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState(null)
  const [dbUser, setDbUser] = useState(null)

  const canManage = isAdmin || isSupervisor

  // authUser from context IS the DB user record — use directly
  useEffect(() => {
    if (!authUser) return
    setDbUser(authUser)
    if (!isEdit) setForm(prev => ({ ...prev, job_requester_id: authUser.id }))
  }, [authUser, isEdit])

  // Load job specs dropdown
  useEffect(() => {
    getJobSpecs().then(setSpecs).catch(() => {})
  }, [])

  // Load questions when job type selected
  const loadQuestions = useCallback(async (specId) => {
    if (!specId) { setQuestions([]); setAnswers([]); return }
    try {
      const qs = await getQuestionsForSpec(specId)
      setQuestions(qs)
      setAnswers(qs.map(q => ({ question_id: q.id, answer_text: '' })))
    } catch {
      setQuestions([])
    }
  }, [])

  useEffect(() => {
    loadQuestions(form.job_type_id)
  }, [form.job_type_id, loadQuestions])

  // Load existing job
  useEffect(() => {
    if (!isEdit) return
    getJobById(id).then(job => {
      setForm({
        job_name: job.job_name || '',
        job_description: job.job_description || '',
        job_type_id: job.job_type_id || '',
        job_from_date: job.job_from_date || '',
        job_to_date: job.job_to_date || '',
        job_start_time: job.job_start_time || '',
        job_location: job.job_location || '',
        job_requester_id: job.job_requester_id,
        department_id: job.department_id,
      })
      setJobId(job.job_id || 'Auto-generated')
      setStatus(job.status || 'request_raised')
      setDbJobId(job.id)
      setCategory(job.job_category === JOB_CATEGORIES.FREQUENT ? JOB_CATEGORIES.FREQUENT : JOB_CATEGORIES.ONETIME)

      // Answers
      if (job.answers?.length) {
        setAnswers(job.answers.map(a => ({ question_id: a.question_id, answer_text: a.answer_text })))
        setQuestions(job.answers.map(a => ({
          id: a.question_id,
          question_text: a.job_spec_questions?.question_text || '',
        })))
      }

      // Associated users
      const assoc = job.associated_users || []
      const h = assoc.find(a => a.role_in_job === 'helpee')
      const he = assoc.find(a => a.role_in_job === 'helper')
      const sv = assoc.find(a => a.role_in_job === 'supervisor')
      if (h?.users) setHelpee(h.users)
      if (he?.users) setHelper(he.users)
      if (sv?.users) setSupervisor(sv.users)

      setInvoice(job.invoice || null)
      setAttendance(job.attendance || [])
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [id, isEdit])

  // Generate attendance rows when dates change (frequent jobs)
  useEffect(() => {
    if (category !== JOB_CATEGORIES.FREQUENT || !form.job_from_date || !form.job_to_date) return
    if (isEdit) return // don't regenerate existing rows
    const rows = []
    const start = new Date(form.job_from_date)
    const end = new Date(form.job_to_date)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      rows.push({
        attendance_date: d.toISOString().split('T')[0],
        helpee_id: null,
        helper_remark: '',
        in_time: '',
        out_time: '',
      })
    }
    setAttendance(rows)
  }, [form.job_from_date, form.job_to_date, category, isEdit])

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const setAnswer = (qId, val) => setAnswers(prev => prev.map(a => a.question_id === qId ? { ...a, answer_text: val } : a))
  const setAttRow = (idx, key, val) => setAttendance(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r))

  const handleUserSelected = (user) => {
    if (userPickerRole === 'helpee') setHelpee(user)
    else if (userPickerRole === 'helper') setHelper(user)
    else if (userPickerRole === 'supervisor') setSupervisor(user)
    setUserPickerRole(null)
  }

  const handleSave = async () => {
    if (!form.job_name.trim()) { setError('Job Name is required'); return }
    if (!form.job_from_date) { setError('From Date is required'); return }
    if (!form.job_to_date) { setError('To Date is required'); return }
    setSaving(true)
    setError('')
    try {
      const assocUsers = {
        helpee_id: helpee?.id,
        helper_ids: helper ? [helper.id] : [],
        supervisor_id: supervisor?.id,
      }
      if (isEdit) {
        await updateJob(dbJobId, form, answers)
        if (helpee) await upsertAssociatedUser(dbJobId, helpee.id, 'helpee')
        if (helper) await upsertAssociatedUser(dbJobId, helper.id, 'helper')
        if (supervisor) await upsertAssociatedUser(dbJobId, supervisor.id, 'supervisor')
      } else {
        await createJob({ ...form, job_category: category }, answers, assocUsers)
      }
      navigate('/admin/manage-jobs')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusAction = async (newStatus) => {
    try {
      await updateJobStatus(dbJobId, newStatus)
      setStatus(newStatus)
    } catch (e) {
      setError(e.message)
    }
    setStatusConfirm(null)
  }

  const handleSubmitAttendance = async () => {
    try {
      await submitAttendance(dbJobId, attendance)
      setError('')
      alert('Attendance submitted successfully!')
    } catch (e) {
      setError(e.message)
    }
  }

  const inputClass = 'form-cell flex-1 w-full outline-none text-sm'
  const isFrequent = category === JOB_CATEGORIES.FREQUENT
  const isReadOnly = isHelpee || (isHelper && !isEdit)
  const jobTitle = isFrequent ? 'Job (Frequent Job)' : 'Job (One time Job)'

  if (loading) return <MainLayout title={jobTitle}><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title={jobTitle}>
      {/* Category toggle */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setCategory(isFrequent ? JOB_CATEGORIES.ONETIME : JOB_CATEGORIES.FREQUENT)}
          className="btn-select px-4 text-sm"
        >
          {isFrequent ? 'View One time Job option' : 'View Frequent Job option'}
        </button>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {/* ── JOB DETAILS ─────────────────────────── */}
        <section>
          <h2 className="font-semibold text-base mb-3">Job Details</h2>
          <div className={`grid gap-3 ${isFrequent ? 'grid-cols-2' : 'grid-cols-1 max-w-xl'}`}>
            <div className="space-y-2">
              <FormRow label="Job ID" labelWidth="w-40">
                <div className="form-cell flex-1 text-sm text-hh-placeholder">{jobId}</div>
              </FormRow>
              <FormRow label="Job Type" labelWidth="w-40">
                <select className={inputClass} value={form.job_type_id}
                  onChange={e => setField('job_type_id', e.target.value)} disabled={isReadOnly}>
                  <option value="">-- Select Job Type --</option>
                  {specs.map(s => <option key={s.id} value={s.id}>{s.job_type_name}</option>)}
                </select>
              </FormRow>
              <FormRow label="Job Name" labelWidth="w-40">
                <input className={inputClass} value={form.job_name}
                  onChange={e => setField('job_name', e.target.value)} placeholder="Job Name" readOnly={isReadOnly} />
              </FormRow>
              <FormRow label="Job Description" labelWidth="w-40">
                <textarea className="form-cell flex-1 w-full outline-none text-sm h-16 resize-none py-2"
                  value={form.job_description} onChange={e => setField('job_description', e.target.value)}
                  placeholder="Description" readOnly={isReadOnly} />
              </FormRow>
              {!isFrequent && (
                <>
                  <FormRow label="Job From Date" labelWidth="w-40">
                    <input type="date" className={inputClass} value={form.job_from_date}
                      onChange={e => setField('job_from_date', e.target.value)} readOnly={isReadOnly} />
                  </FormRow>
                  <FormRow label="Job To Date" labelWidth="w-40">
                    <input type="date" className={inputClass} value={form.job_to_date}
                      onChange={e => setField('job_to_date', e.target.value)} readOnly={isReadOnly} />
                  </FormRow>
                  <FormRow label="Job Time" labelWidth="w-40">
                    <input type="time" className={inputClass} value={form.job_start_time}
                      onChange={e => setField('job_start_time', e.target.value)} readOnly={isReadOnly} />
                  </FormRow>
                  <FormRow label="Job Location" labelWidth="w-40">
                    <input className={inputClass} value={form.job_location}
                      onChange={e => setField('job_location', e.target.value)} placeholder="Location" readOnly={isReadOnly} />
                  </FormRow>
                </>
              )}
            </div>
            {isFrequent && (
              <div className="space-y-2">
                <FormRow label="Job From Date" labelWidth="w-40">
                  <input type="date" className={inputClass} value={form.job_from_date}
                    onChange={e => setField('job_from_date', e.target.value)} readOnly={isReadOnly} />
                </FormRow>
                <FormRow label="Job To Date" labelWidth="w-40">
                  <input type="date" className={inputClass} value={form.job_to_date}
                    onChange={e => setField('job_to_date', e.target.value)} readOnly={isReadOnly} />
                </FormRow>
                <FormRow label="Job Start Time" labelWidth="w-40">
                  <input type="time" className={inputClass} value={form.job_start_time}
                    onChange={e => setField('job_start_time', e.target.value)} readOnly={isReadOnly} />
                </FormRow>
                <FormRow label="Job Location" labelWidth="w-40">
                  <input className={inputClass} value={form.job_location}
                    onChange={e => setField('job_location', e.target.value)} placeholder="Location" readOnly={isReadOnly} />
                </FormRow>
                <FormRow label="Job Requester" labelWidth="w-40">
                  <div className="form-cell flex-1 text-sm text-hh-placeholder">
                    {dbUser?.user_name || 'Current User'}
                  </div>
                </FormRow>
              </div>
            )}
          </div>
          {!isFrequent && (
            <div className="mt-2 max-w-xl">
              <FormRow label="Job Requester" labelWidth="w-40">
                <div className="form-cell flex-1 text-sm text-hh-placeholder">
                  {dbUser?.user_name || 'Current User'}
                </div>
              </FormRow>
            </div>
          )}
        </section>

        {/* ── JOB SPECIFIC QUESTIONS ────────────────── */}
        {questions.length > 0 && (
          <section>
            <h2 className="font-semibold text-base mb-3">Job Specific Questions</h2>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <FormRow key={q.id} label={q.question_text} labelWidth="w-48">
                  <input
                    className={inputClass}
                    value={answers[i]?.answer_text || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    placeholder="Enter Answer"
                    readOnly={isReadOnly}
                  />
                </FormRow>
              ))}
            </div>
          </section>
        )}

        {/* ── ASSOCIATED USERS + INVOICE ─────────────── */}
        <div className={`grid gap-6 ${canManage ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Associated Users */}
          <section>
            <h2 className="font-semibold text-base mb-3">Job Associated Users</h2>
            <div className="space-y-2">
              {[
                { role: 'helpee', user: helpee, setUser: setHelpee },
                { role: 'helper', user: helper, setUser: setHelper },
                { role: 'supervisor', user: supervisor, setUser: setSupervisor },
              ].map(({ role, user }) => (
                <div key={role} className="flex gap-2 items-center">
                  <div className="form-label w-28 capitalize flex-shrink-0">{role}</div>
                  <div className="form-cell flex-1 text-sm">
                    {user ? user.user_name : <span className="text-hh-placeholder capitalize">{role} Name</span>}
                  </div>
                  {canManage && (
                    <button onClick={() => setUserPickerRole(role)} className="btn-add w-9 h-9 flex-shrink-0" title={`Add ${role}`}>⊕</button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Invoice — Admin/Supervisor only */}
          {canManage && (
            <section>
              <h2 className="font-semibold text-base mb-3">Invoice Details</h2>
              <div className="flex gap-2 items-center">
                {invoice && (
                  <button onClick={() => setShowInvoiceView(true)} className="btn-select px-4 text-sm">
                    View Invoice
                  </button>
                )}
                {isEdit && dbJobId && (
                  <button onClick={() => setShowInvoiceModal(true)} className="btn-add w-9 h-9" title="Add/Edit Invoice">⊕</button>
                )}
              </div>
              {invoice && (
                <div className="mt-3 space-y-1 text-sm">
                  <p><span className="font-medium">Amount:</span> {invoice.invoice_currency} {invoice.invoice_amount}</p>
                  <p><span className="font-medium">Status:</span> <span className="capitalize">{invoice.invoice_status}</span></p>
                  {invoice.invoice_notes && <p><span className="font-medium">Notes:</span> {invoice.invoice_notes}</p>}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── VIEW REMARK ───────────────────────────── */}
        {isEdit && (
          <div className="flex justify-end">
            <button
              onClick={() => navigate(`/helpee/jobs/${dbJobId}/remark`)}
              className="btn-select px-5 text-sm"
            >
              View Remark
            </button>
          </div>
        )}

        {/* ── ACTION BUTTONS ────────────────────────── */}
        {isEdit && canManage && (
          <section>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Job Started', newStatus: 'job_started' },
                { label: 'Job Complete', newStatus: 'job_finished' },
                ...(!isHelper ? [
                  { label: 'Payment Confirmed', newStatus: 'payment_confirmed' },
                  { label: 'Job Close', newStatus: 'job_closed' },
                ] : []),
              ].map(({ label, newStatus }) => (
                <button
                  key={newStatus}
                  onClick={() => setStatusConfirm({ label, newStatus })}
                  disabled={status === newStatus}
                  className={`btn-action ${status === newStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── WORKFLOW DISPLAY ─────────────────────── */}
        {isEdit && (
          <section>
            <h2 className="font-semibold text-base mb-3">Job Stage</h2>
            <WorkflowDisplay status={status} />
            <p className="text-xs text-hh-placeholder mt-2">
              Current: <span className="font-medium capitalize">{JOB_STATUS_LABELS[status] || status}</span>
            </p>
          </section>
        )}

        {/* ── ATTENDANCE (Frequent only) ──────────── */}
        {isFrequent && isEdit && (
          <section>
            <h2 className="font-semibold text-base mb-3">Job Attendance</h2>
            <div className="overflow-x-auto">
              <div className="space-y-2 min-w-[600px]">
                {/* Header */}
                <div className="grid grid-cols-[90px_1fr_90px_90px_90px] gap-2">
                  {['Helpee', 'Remark', 'Date', 'In Time', 'Out Time'].map(h => (
                    <div key={h} className="table-header rounded-hh px-2 text-xs">{h}</div>
                  ))}
                </div>
                {attendance.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[90px_1fr_90px_90px_90px] gap-2">
                    <input type="text" className="form-cell text-xs outline-none" value={row.helpee_name || ''}
                      onChange={e => setAttRow(idx, 'helpee_name', e.target.value)} placeholder="Helpee"
                      readOnly={isHelpee} />
                    <input type="text" className="form-cell text-xs outline-none" value={row.helper_remark || ''}
                      onChange={e => setAttRow(idx, 'helper_remark', e.target.value)} placeholder="Remark"
                      readOnly={isHelpee} />
                    <div className="form-cell text-xs">{row.attendance_date}</div>
                    <input type="time" className="form-cell text-xs outline-none" value={row.in_time || ''}
                      onChange={e => setAttRow(idx, 'in_time', e.target.value)}
                      readOnly={isHelpee} />
                    <input type="time" className="form-cell text-xs outline-none" value={row.out_time || ''}
                      onChange={e => setAttRow(idx, 'out_time', e.target.value)}
                      readOnly={isHelpee} />
                  </div>
                ))}
              </div>
            </div>
            {!isHelpee && (
              <button onClick={handleSubmitAttendance} className="btn-filter w-full mt-3 text-sm">
                Submit Attendance
              </button>
            )}
          </section>
        )}

        {/* ── FREQUENT BOTTOM ACTIONS ──────────────── */}
        {isFrequent && isEdit && canManage && (
          <div className="flex gap-3 justify-end">
            <button onClick={() => setStatusConfirm({ label: 'Payment Confirmed', newStatus: 'payment_confirmed' })} className="btn-action">
              Payment Confirmed
            </button>
            <button onClick={() => setStatusConfirm({ label: 'Job Close', newStatus: 'job_closed' })} className="btn-action">
              Job Close
            </button>
          </div>
        )}

        {/* ── SAVE / UPDATE buttons ───────────────── */}
        {canManage && (
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-action px-10">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Job'}
            </button>
            <button onClick={() => navigate('/admin/manage-jobs')} className="btn-filter">
              {isEdit ? 'Back' : 'Cancel'}
            </button>
          </div>
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────── */}
      {userPickerRole && (
        <UserPickerModal
          roleFilter={userPickerRole}
          onSelect={handleUserSelected}
          onClose={() => setUserPickerRole(null)}
        />
      )}

      {showInvoiceModal && dbJobId && (
        <InvoiceModal
          jobId={dbJobId}
          existing={invoice}
          onSave={(inv) => { setInvoice(inv); setShowInvoiceModal(false) }}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {showInvoiceView && invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Invoice</h3>
              <button onClick={() => setShowInvoiceView(false)} className="btn-icon w-8 h-8">✕</button>
            </div>
            <p><span className="font-medium">Amount:</span> {invoice.invoice_currency} {invoice.invoice_amount}</p>
            <p><span className="font-medium">Date:</span> {invoice.invoice_date || '—'}</p>
            <p><span className="font-medium">Status:</span> <span className="capitalize">{invoice.invoice_status}</span></p>
            {invoice.invoice_notes && <p><span className="font-medium">Notes:</span> {invoice.invoice_notes}</p>}
          </div>
        </div>
      )}

      {statusConfirm && (
        <ConfirmModal
          message={`Mark job as "${statusConfirm.label}"?`}
          onConfirm={() => handleStatusAction(statusConfirm.newStatus)}
          onCancel={() => setStatusConfirm(null)}
        />
      )}
    </MainLayout>
  )
}
