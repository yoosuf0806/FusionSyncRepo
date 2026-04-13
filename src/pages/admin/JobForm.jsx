import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  getJobById, createJob, updateJob, updateJobStatus,
  saveInvoice, uploadInvoiceAttachment, upsertAssociatedUser, removeAssociatedUser,
  getAttendanceForJob, upsertAttendanceRow, updateAttendanceStatus,
  getJobMessages, postJobMessage, notifyHelpersAssignedToJob,
} from '../../services/jobService'
import { getJobSpecs, getQuestionsForSpec } from '../../services/jobSpecService'
import { getUsers } from '../../services/userService'
import FormRow from '../../components/FormRow'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import ConfirmModal from '../../components/ConfirmModal'
import { WORKFLOW_STAGES, JOB_STATUS_LABELS, getCompletedStages, canTransitionTo } from '../../constants/jobStatuses'
import { jobsHubPath, jobDetailPath } from '../../constants/jobPaths'

const ATT_PAGE_SIZE = 10

// ── User Picker Modal ──────────────────────────────────────────────────────
function UserPickerModal({ roleFilter, onSelect, onClose }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    getUsers({ search, userType: roleFilter }).then(data => { setUsers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [search, roleFilter])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold capitalize">Select {roleFilter}</h3>
          <button onClick={onClose} className="btn-icon w-8 h-8 text-xl">✕</button>
        </div>
        <div className="px-5 py-3">
          <input className="form-cell w-full outline-none text-sm" placeholder="Search users..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {loading ? <p className="text-sm text-hh-placeholder py-4 text-center">Loading...</p>
            : users.length === 0 ? <p className="text-sm text-hh-placeholder py-4 text-center">No users found</p>
            : users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-hh bg-gray-50 hover:bg-hh-mint/20">
                <div>
                  <p className="text-sm font-medium">{u.user_name}</p>
                  <p className="text-xs text-hh-placeholder">{u.user_id} · {u.user_type}</p>
                </div>
                <button onClick={() => onSelect(u)} className="btn-select px-4 text-sm">Select</button>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ── Invoice Modal ──────────────────────────────────────────────────────────
function InvoiceModal({ jobId, existing, onSave, onClose }) {
  const [form, setForm] = useState({
    invoice_amount: existing?.invoice_amount || '',
    invoice_currency: existing?.invoice_currency || 'AUD',
    invoice_date: existing?.invoice_date || '',
    invoice_status: existing?.invoice_status || 'draft',
    invoice_notes: existing?.invoice_notes || '',
    attachment_url: existing?.attachment_url || '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  const ACCEPTED = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx'

  const handleSave = async () => {
    setSaving(true)
    try {
      let attachmentUrl = form.attachment_url
      if (file) {
        setUploadProgress('Uploading file...')
        attachmentUrl = await uploadInvoiceAttachment(jobId, file)
        setUploadProgress('')
      }
      const payload = { ...form, attachment_url: attachmentUrl }
      await saveInvoice(jobId, payload)
      onSave(payload)
    } catch (e) {
      alert(e.message)
      setUploadProgress('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Invoice Details</h3>
          <button onClick={onClose} className="btn-icon w-8 h-8">✕</button>
        </div>
        {[
          { label: 'Amount', key: 'invoice_amount', type: 'number' },
          { label: 'Currency', key: 'invoice_currency', type: 'text' },
          { label: 'Date', key: 'invoice_date', type: 'date' },
          { label: 'Notes', key: 'invoice_notes', type: 'text' },
        ].map(({ label, key, type }) => (
          <FormRow key={key} label={label} labelWidth="w-24">
            <input type={type} className="form-cell flex-1 w-full outline-none text-sm"
              value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
          </FormRow>
        ))}
        <FormRow label="Status" labelWidth="w-24">
          <select className="form-cell flex-1 outline-none text-sm" value={form.invoice_status}
            onChange={e => setForm(p => ({ ...p, invoice_status: e.target.value }))}>
            {['draft','sent','paid','void'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </FormRow>

        {/* Attachment upload */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-hh-text">Attachment</p>
          <label className="flex items-center gap-2 form-cell cursor-pointer hover:bg-hh-mint/30 transition-colors">
            <svg className="w-4 h-4 text-hh-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="text-xs text-hh-placeholder truncate">
              {file ? file.name : (form.attachment_url ? 'Replace file' : 'Click to attach (PDF, Word, Excel, Image)')}
            </span>
            <input type="file" accept={ACCEPTED} className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
          {form.attachment_url && !file && (
            <a href={form.attachment_url} target="_blank" rel="noreferrer"
              className="text-xs text-hh-green underline block">
              View existing attachment ↗
            </a>
          )}
          {uploadProgress && <p className="text-xs text-hh-placeholder">{uploadProgress}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-action px-6">{saving ? 'Saving...' : 'Save Invoice'}</button>
          <button onClick={onClose} className="btn-filter">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Reject Reason Modal ────────────────────────────────────────────────────
function RejectModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-sm p-6 space-y-3">
        <h3 className="font-semibold">Rejection Reason</h3>
        <textarea className="form-cell w-full outline-none text-sm h-24 resize-none py-2"
          value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter reason..." />
        <div className="flex gap-2">
          <button onClick={() => onConfirm(reason)} className="btn-action px-6 bg-hh-error hover:bg-red-600">Reject</button>
          <button onClick={onClose} className="btn-filter">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function JobMessageModal({ jobId, open, onClose, authUser, authorRole }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open || !jobId) return
    setLoading(true)
    setErr('')
    getJobMessages(jobId)
      .then(setMessages)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [open, jobId])

  const handlePost = async () => {
    if (!text.trim() || !authUser?.id) return
    setPosting(true)
    setErr('')
    try {
      await postJobMessage(jobId, text, {
        authorUserId: authUser.id,
        authorRole,
        authorName: authUser.user_name,
      })
      setText('')
      setMessages(await getJobMessages(jobId))
    } catch (e) {
      setErr(e.message)
    } finally {
      setPosting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold">Job message</h3>
          <button type="button" onClick={onClose} className="btn-icon w-8 h-8">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-[200px]">
          {err && <p className="text-sm text-hh-error">{err}</p>}
          {loading ? (
            <p className="text-sm text-hh-placeholder text-center py-6">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-hh-placeholder text-center py-6">No messages yet.</p>
          ) : (
            messages.map(m => {
              const who = m.author_name || 'User'
              const when = m.created_at ? new Date(m.created_at).toLocaleString() : ''
              return (
                <div key={m.id} className="rounded-hh bg-gray-50 px-3 py-2 text-sm">
                  <p className="text-xs text-hh-placeholder mb-1">{who} · {when}</p>
                  <p className="whitespace-pre-wrap text-hh-text">{m.body}</p>
                </div>
              )
            })
          )}
        </div>
        <div className="px-5 py-4 border-t space-y-2">
          <textarea
            className="form-cell w-full outline-none text-sm h-24 resize-none py-2"
            placeholder="Write an update for the supervisor or helper…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-filter">Close</button>
            <button
              type="button"
              onClick={handlePost}
              disabled={posting || !text.trim()}
              className="btn-action px-6 bg-hh-green hover:opacity-90 disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Workflow Display ───────────────────────────────────────────────────────
function WorkflowDisplay({ status, associatedUsers }) {
  const completed = getCompletedStages(status, associatedUsers)
  return (
    <div className="w-full overflow-x-auto py-2">
      <div className="flex items-center gap-1 min-w-max">
        {WORKFLOW_STAGES.map((stage, i) => {
          const done = completed[stage.key]
          return (
            <div key={stage.key} className="flex items-center gap-1">
              <div className={`flex flex-col items-center justify-center rounded-hh text-xs font-medium text-center w-20 h-11 px-1
                ${done ? 'bg-hh-green text-white' : 'bg-gray-400 text-white'}`}>
                {stage.label.map((l, j) => <span key={j}>{l}</span>)}
              </div>
              {i < WORKFLOW_STAGES.length - 1 && (
                <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
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

// ── Attendance Status Badge ────────────────────────────────────────────────
const ATT_STATUS_STYLES = {
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved:         'bg-green-100 text-green-800',
  rejected:         'bg-red-100 text-red-800',
  resubmitted:      'bg-blue-100 text-blue-800',
}
const ATT_STATUS_LABELS = {
  pending_approval: 'Pending',
  approved:         'Approved',
  rejected:         'Rejected',
  resubmitted:      'Resubmitted',
}

// ── Main Component ──────────────────────────────────────────────────────────
const JOB_CATEGORIES = { ONETIME: 'one-time', FREQUENT: 'frequent' }

export default function JobForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const { user: authUser, role, isAdmin, isSupervisor, isHelper, isHelpee } = useAuth()

  const isEdit = Boolean(id)
  const [category, setCategory] = useState(() => {
    if (location.state?.category) return location.state.category
    if (location.pathname.includes('frequent')) return JOB_CATEGORIES.FREQUENT
    return JOB_CATEGORIES.ONETIME
  })

  const [form, setForm] = useState({
    job_name: '', job_description: '',
    // Pre-fill job_type_id from the picker modal state if coming from a new job flow
    job_type_id: location.state?.job_type_id || '',
    job_notes: '',
    // one-time fields
    job_date: '', job_start_time: '',
    // frequent fields
    job_from_date: '', job_to_date: '', job_end_time: '',
    // shared
    job_location: '', job_requester_id: null, department_id: null,
    pricing_structure: 'daily',
  })
  // Pre-fill job type name from picker so it shows immediately before specs load
  const [loadedJobTypeName, setLoadedJobTypeName] = useState(location.state?.job_type_name || '')
  const [jobId, setJobId] = useState('Auto-generated')
  const [status, setStatus] = useState('request_raised')
  const [dbJobId, setDbJobId] = useState(null)

  const [specs, setSpecs] = useState([])
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [selectedSpec, setSelectedSpec] = useState(null)

  const [helpee, setHelpee] = useState(null)
  const [helpers, setHelpers] = useState([])
  const [supervisor, setSupervisor] = useState(null)
  const [associatedUsers, setAssociatedUsers] = useState([])

  const [invoice, setInvoice] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [attPage, setAttPage] = useState(0)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [savingAttRow, setSavingAttRow] = useState(null)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [userPickerRole, setUserPickerRole] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showInvoiceView, setShowInvoiceView] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState(null)
  const [dbUser, setDbUser] = useState(null)
  const [showJobMessageModal, setShowJobMessageModal] = useState(false)

  const prevHelperIdsRef = useRef([])

  const canManage = isAdmin || isSupervisor
  const canUseJobMessages = isAdmin || isSupervisor || isHelper
  const jobMessageAuthorRole = isAdmin ? 'admin' : isSupervisor ? 'supervisor' : 'helper'

  // Redirect any wrong-prefix job URL to the role-canonical one (edit only)
  useEffect(() => {
    if (!role || !id || !isEdit) return
    const canonical = jobDetailPath(role, id)
    if (location.pathname !== canonical) {
      navigate(canonical, { replace: true })
    }
  }, [role, id, isEdit, location.pathname, navigate])

  // Helpee opening /admin/jobs/new → /helpee/jobs/new (keep frequent category in state)
  useEffect(() => {
    if (!role || isEdit) return
    if (location.pathname !== '/admin/jobs/new' && location.pathname !== '/admin/jobs/new/frequent') return
    if (role !== 'helpee') return
    const isFreq = location.pathname.includes('frequent')
    navigate('/helpee/jobs/new', {
      replace: true,
      state: { ...location.state, ...(isFreq ? { category: 'frequent' } : {}) },
    })
  }, [role, isEdit, location.pathname, navigate])

  useEffect(() => {
    if (!authUser) return
    setDbUser(authUser)
    if (!isEdit) setForm(prev => ({ ...prev, job_requester_id: authUser.id }))
  }, [authUser, isEdit])

  // Helpee creating a job: they are always the helpee on the request
  useEffect(() => {
    if (!authUser || isEdit || !isHelpee) return
    setHelpee(authUser)
    setAssociatedUsers(prev => [
      ...prev.filter(a => a.role !== 'helpee'),
      { role: 'helpee', users: authUser },
    ])
  }, [authUser, isEdit, isHelpee])

  // Supervisor creating a job: auto-assign themselves as supervisor
  useEffect(() => {
    if (!authUser || isEdit || !isSupervisor) return
    setSupervisor(authUser)
    setAssociatedUsers(prev => {
      if (prev.some(a => a.role === 'supervisor')) return prev
      return [...prev, { role: 'supervisor', users: authUser }]
    })
  }, [authUser, isEdit, isSupervisor])

  useEffect(() => {
    getJobSpecs().then(setSpecs).catch(() => {})
  }, [])

  const loadQuestions = useCallback(async (specId) => {
    if (!specId) { setQuestions([]); setAnswers([]); setSelectedSpec(null); return }
    try {
      const qs = await getQuestionsForSpec(specId)
      setQuestions(qs)
      // Preserve answers already loaded from the job (edit / helpee / helper view)
      setAnswers(prev => qs.map(q => {
        const hit = prev.find(a => a.question_id === q.id)
        return { question_id: q.id, answer_text: hit?.answer_text ?? '' }
      }))
      const spec = specs.find(s => s.id === specId)
      setSelectedSpec(spec || null)
    } catch { setQuestions([]) }
  }, [specs])

  useEffect(() => { loadQuestions(form.job_type_id) }, [form.job_type_id, loadQuestions])

  useEffect(() => {
    if (!isEdit) return
    getJobById(id).then(job => {
      const catRaw = job.job_category ? String(job.job_category).toLowerCase() : ''
      const jc = catRaw === 'frequent' ? JOB_CATEGORIES.FREQUENT : JOB_CATEGORIES.ONETIME
      setCategory(jc)
      const spec = job.job_specifications
      const typeName = spec && typeof spec === 'object' && !Array.isArray(spec)
        ? spec.job_type_name
        : (Array.isArray(spec) ? spec[0]?.job_type_name : '')
      setLoadedJobTypeName(typeName || '')
      setForm({
        job_name: job.job_name || '',
        job_description: job.job_description || '',
        job_type_id: job.job_type_id || '',
        job_notes: job.job_notes || '',
        job_date: job.job_date || '',
        job_start_time: job.job_start_time || '',
        job_from_date: job.job_from_date || '',
        job_to_date: job.job_to_date || '',
        job_end_time: job.job_end_time || '',
        job_location: job.job_location || '',
        job_requester_id: job.job_requester_id,
        department_id: job.department_id,
        pricing_structure: job.pricing_structure || 'daily',
      })
      setJobId(job.job_id || 'Auto-generated')
      setStatus(job.status || 'request_raised')
      setDbJobId(job.id)

      if (job.answers?.length) {
        setAnswers(job.answers.map(a => ({ question_id: a.question_id, answer_text: a.answer_text })))
        setQuestions(job.answers.map(a => ({ id: a.question_id, question_text: a.job_spec_questions?.question_text || '' })))
      }

      const assoc = job.associated_users || []
      setAssociatedUsers(assoc)
      setHelpee(assoc.find(a => a.role === 'helpee')?.users || null)
      setHelpers(assoc.filter(a => a.role === 'helper').map(a => a.users).filter(Boolean))
      setSupervisor(assoc.find(a => a.role === 'supervisor')?.users || null)

      prevHelperIdsRef.current = assoc
        .filter(a => a.role === 'helper')
        .map(a => a.users?.id)
        .filter(Boolean)

      if (job.invoice) setInvoice(job.invoice)

      // Load attendance for frequent jobs
      if (jc === JOB_CATEGORIES.FREQUENT) {
        getAttendanceForJob(job.id).then(rows => setAttendance(rows)).catch(() => {})
      }

      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [id, isEdit])

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const setAnswer = (qId, val) => setAnswers(prev => prev.map(a => a.question_id === qId ? { ...a, answer_text: val } : a))
  const setAttRow = (rowId, key, val) => setAttendance(prev => prev.map(r => r.id === rowId ? { ...r, [key]: val } : r))

  const handleUserSelected = (user) => {
    const assocEntry = { role: userPickerRole, users: user }
    if (userPickerRole === 'helpee') {
      setHelpee(user)
      setAssociatedUsers(prev => [...prev.filter(a => a.role !== 'helpee'), assocEntry])
    } else if (userPickerRole === 'helper') {
      // Only add if not already in the list
      if (!helpers.find(h => h.id === user.id)) {
        setHelpers(prev => [...prev, user])
        setAssociatedUsers(prev => [...prev, assocEntry])
      }
    } else if (userPickerRole === 'supervisor') {
      setSupervisor(user)
      setAssociatedUsers(prev => [...prev.filter(a => a.role !== 'supervisor'), assocEntry])
    }
    setUserPickerRole(null)
  }

  const removeHelper = async (userId) => {
    try {
      if (isEdit && dbJobId) await removeAssociatedUser(dbJobId, userId)
      setHelpers(prev => prev.filter(h => h.id !== userId))
      setAssociatedUsers(prev => prev.filter(a => !(a.role === 'helper' && a.users?.id === userId)))
    } catch (e) { setError(e.message) }
  }

  const handleSave = async () => {
    if (!form.job_name.trim()) { setError('Job Name is required'); return }
    if (category === JOB_CATEGORIES.ONETIME && !form.job_date) { setError('Job Date is required'); return }
    if (category === JOB_CATEGORIES.FREQUENT && (!form.job_from_date || !form.job_to_date)) { setError('Start and End Date are required'); return }

    // ── Associated-user validation (new jobs only) ─────────────────
    if (!isEdit) {
      if (isSupervisor || isAdmin) {
        if (!helpee) { setError('Please select a Helpee for this job.'); return }
        if (helpers.length === 0) { setError('Please assign at least one Helper to this job.'); return }
      }
      if (isAdmin && !supervisor) { setError('Please assign a Supervisor to this job.'); return }
    }

    setSaving(true)
    setError('')
    try {
      const assocUsers = {
        helpee_id: helpee?.id,
        helper_ids: helpers.map(h => h.id),
        supervisor_id: supervisor?.id,
      }
      if (isEdit) {
        const prevHelpers = prevHelperIdsRef.current
        await updateJob(dbJobId, { ...form, job_category: category }, answers)
        if (helpee) await upsertAssociatedUser(dbJobId, helpee.id, 'helpee')
        for (const h of helpers) await upsertAssociatedUser(dbJobId, h.id, 'helper')
        if (supervisor) await upsertAssociatedUser(dbJobId, supervisor.id, 'supervisor')
        const newHelperIds = helpers.map(h => h.id).filter(id => !prevHelpers.includes(id))
        if (canManage && newHelperIds.length > 0) {
          await notifyHelpersAssignedToJob(dbJobId, newHelperIds, form.job_name)
        }
        // Auto-advance job status when supervisor or helpers are first assigned
        if (canManage) {
          let nextStatus = null
          const hasSupervisor = !!supervisor
          const hasHelpers = helpers.length > 0
          if (hasHelpers && ['request_raised', 'manager_assigned'].includes(status)) {
            nextStatus = 'helper_assigned'
          } else if (hasSupervisor && status === 'request_raised') {
            nextStatus = 'manager_assigned'
          }
          if (nextStatus) {
            await updateJobStatus(dbJobId, nextStatus)
            setStatus(nextStatus)
          }
        }
        prevHelperIdsRef.current = helpers.map(h => h.id)
      } else {
        await createJob({ ...form, job_category: category }, answers, assocUsers, role)
      }
      navigate(jobsHubPath(role))
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
    } catch (e) { setError(e.message) }
    setStatusConfirm(null)
  }

  // Attendance: submit a row (set check-in/out → pending_approval)
  const handleSubmitRow = async (row) => {
    if (!row.check_in_time || !row.check_out_time) { setError('Check In and Check Out times are required'); return }
    setSavingAttRow(row.id)
    try {
      const updated = await upsertAttendanceRow(dbJobId, {
        id: row.id,
        attendance_date: row.attendance_date,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        remark: row.remark || null,
        att_status: 'pending_approval',
        submitted_at: new Date().toISOString(),
        resubmitted_at: row.att_status === 'rejected' ? new Date().toISOString() : null,
      })
      setAttendance(prev => prev.map(r => r.id === row.id ? { ...r, ...updated } : r))
    } catch (e) { setError(e.message) } finally { setSavingAttRow(null) }
  }

  const handleApproveRow = async (row) => {
    setSavingAttRow(row.id)
    try {
      const updated = await updateAttendanceStatus(row.id, 'approved', null)
      setAttendance(prev => prev.map(r => r.id === row.id ? { ...r, ...updated } : r))
    } catch (e) { setError(e.message) } finally { setSavingAttRow(null) }
  }

  const handleRejectRow = async (row, reason) => {
    setSavingAttRow(row.id)
    try {
      const updated = await updateAttendanceStatus(row.id, 'rejected', reason)
      setAttendance(prev => prev.map(r => r.id === row.id ? { ...r, ...updated } : r))
    } catch (e) { setError(e.message) } finally { setSavingAttRow(null); setRejectTarget(null) }
  }

  const isFrequent = category === JOB_CATEGORIES.FREQUENT
  const isJobFieldsReadOnly = (isHelpee || isHelper) && isEdit
  const jobTitle = isFrequent ? 'Job (Frequent Job)' : 'Job (One-Time Job)'
  const inputClass = 'form-cell flex-1 w-full outline-none text-sm'
  const isHourly = form.pricing_structure === 'hourly'

  // Attendance pagination
  const attPages = Math.ceil(attendance.length / ATT_PAGE_SIZE)
  const attSlice = attendance.slice(attPage * ATT_PAGE_SIZE, (attPage + 1) * ATT_PAGE_SIZE)

  // Monthly total (current month, exclude rejected)
  const now = new Date()
  const monthlyTotal = attendance.reduce((sum, row) => {
    const d = new Date(row.attendance_date)
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum
    if (row.att_status === 'rejected') return sum
    return sum + (parseFloat(row.rate_for_day) || 0)
  }, 0)

  if (loading) return <MainLayout title={jobTitle}><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title={jobTitle}>
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
  {/* If job type was pre-selected in the picker, show as a locked display field.
                     Admin/Supervisor can still change it via the dropdown if needed. */}
                {isJobFieldsReadOnly ? (
                  <div className="form-cell flex-1 text-sm">
                    {loadedJobTypeName || selectedSpec?.job_type_name || specs.find(s => s.id === form.job_type_id)?.job_type_name || '—'}
                  </div>
                ) : (location.state?.job_type_id && !isEdit && form.job_type_id) ? (
                  <div className="flex items-center gap-2 flex-1">
                    <div className="form-cell flex-1 text-sm font-medium text-hh-text">
                      {loadedJobTypeName || selectedSpec?.job_type_name || specs.find(s => s.id === form.job_type_id)?.job_type_name || '—'}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setField('job_type_id', ''); setLoadedJobTypeName('') }}
                      className="text-xs text-hh-green underline flex-shrink-0 hover:opacity-70"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <select className={inputClass} value={form.job_type_id}
                    onChange={e => setField('job_type_id', e.target.value)}>
                    <option value="">-- Select Job Type --</option>
                    {specs.map(s => <option key={s.id} value={s.id}>{s.job_type_name}</option>)}
                  </select>
                )}
              </FormRow>
              <FormRow label="Job Name" labelWidth="w-40">
                <input className={inputClass} value={form.job_name}
                  onChange={e => setField('job_name', e.target.value)} placeholder="Job Name" readOnly={isJobFieldsReadOnly} />
              </FormRow>
              <FormRow label="Job Description" labelWidth="w-40">
                <textarea className="form-cell flex-1 w-full outline-none text-sm h-16 resize-none py-2"
                  value={form.job_description} onChange={e => setField('job_description', e.target.value)}
                  placeholder="Description" readOnly={isJobFieldsReadOnly} />
              </FormRow>

              {/* Frequent: show date range in first column so dates are always visible */}
              {isFrequent && (
                <>
                  <FormRow label="Start Date" labelWidth="w-40">
                    <input type="date" className={inputClass} value={form.job_from_date}
                      onChange={e => setField('job_from_date', e.target.value)} readOnly={isJobFieldsReadOnly} />
                  </FormRow>
                  <FormRow label="End Date" labelWidth="w-40">
                    <input type="date" className={inputClass} value={form.job_to_date}
                      onChange={e => setField('job_to_date', e.target.value)} readOnly={isJobFieldsReadOnly} />
                  </FormRow>
                </>
              )}

              {/* ── ONE-TIME: single date + time ── */}
              {!isFrequent && (
                <>
                  <FormRow label="Job Date" labelWidth="w-40">
                    <input type="date" className={inputClass} value={form.job_date}
                      onChange={e => setField('job_date', e.target.value)} readOnly={isJobFieldsReadOnly} />
                  </FormRow>
                  <FormRow label="Job Time" labelWidth="w-40">
                    <input type="time" className={inputClass} value={form.job_start_time}
                      onChange={e => setField('job_start_time', e.target.value)} readOnly={isJobFieldsReadOnly} />
                  </FormRow>
                  <FormRow label="Job Location" labelWidth="w-40">
                    <input className={inputClass} value={form.job_location}
                      onChange={e => setField('job_location', e.target.value)} placeholder="Location" readOnly={isJobFieldsReadOnly} />
                  </FormRow>
                  <FormRow label="Job Requester" labelWidth="w-40">
                    <div className="form-cell flex-1 text-sm text-hh-placeholder">{dbUser?.user_name || 'Current User'}</div>
                  </FormRow>
                </>
              )}
            </div>

            {/* ── FREQUENT: date range + times + pricing ── */}
            {isFrequent && (
              <div className="space-y-2">
                <FormRow label="Job Start Time" labelWidth="w-40">
                  <input type="time" className={inputClass} value={form.job_start_time}
                    onChange={e => setField('job_start_time', e.target.value)} readOnly={isJobFieldsReadOnly} />
                </FormRow>
                <FormRow label="Job End Time" labelWidth="w-40">
                  <input type="time" className={inputClass} value={form.job_end_time}
                    onChange={e => setField('job_end_time', e.target.value)} readOnly={isJobFieldsReadOnly} />
                </FormRow>
                <FormRow label="Job Location" labelWidth="w-40">
                  <input className={inputClass} value={form.job_location}
                    onChange={e => setField('job_location', e.target.value)} placeholder="Location" readOnly={isJobFieldsReadOnly} />
                </FormRow>
                <FormRow label="Job Requester" labelWidth="w-40">
                  <div className="form-cell flex-1 text-sm text-hh-placeholder">{dbUser?.user_name || 'Current User'}</div>
                </FormRow>

                {/* Pricing Structure — Admin/Supervisor only */}
                {canManage && (
                  <FormRow label="Pricing Structure" labelWidth="w-40">
                    <div className="flex gap-3 items-center flex-1">
                      {[{ val: 'daily', label: 'Daily Rate' }, { val: 'hourly', label: 'Hourly Rate' }].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => !isJobFieldsReadOnly && setField('pricing_structure', opt.val)}
                          className={`px-4 py-1.5 rounded-hh text-sm font-medium border-2 transition-colors
                            ${form.pricing_structure === opt.val
                              ? 'bg-hh-green text-white border-hh-green'
                              : 'bg-white text-hh-text border-gray-300 hover:border-hh-green'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </FormRow>
                )}
              </div>
            )}
          </div>

          <div className="mt-4"></div>
          <FormRow label="Remark / notes" labelWidth="w-40">
            <textarea className="form-cell flex-1 w-full outline-none text-sm h-20 resize-none py-2 mt-1"
              value={form.job_notes}
              onChange={e => setField('job_notes', e.target.value)}
              placeholder="Optional notes visible to everyone on this job (e.g. access instructions)"
              readOnly={!canManage} />
          </FormRow>
        </section>

        {/* ── JOB SPECIFIC QUESTIONS ────────────────── */}
        {questions.length > 0 && (
          <section>
            <h2 className="font-semibold text-base mb-3">Job Specific Questions</h2>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <FormRow key={q.id} label={q.question_text} labelWidth="w-48">
                  <input className={inputClass} value={answers[i]?.answer_text || ''}
                    onChange={e => setAnswer(q.id, e.target.value)} placeholder="Enter Answer" readOnly={isJobFieldsReadOnly} />
                </FormRow>
              ))}
            </div>
          </section>
        )}

        {/* ── ASSOCIATED USERS + INVOICE ─────────────── */}
        <div className={`grid gap-6 ${(canManage || (isEdit && invoice && (isHelpee || isHelper))) ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <section>
            <h2 className="font-semibold text-base mb-3">Job Associated Users</h2>
            <div className="space-y-2">
              {/* Helpee */}
              <div className="flex gap-2 items-center">
                <div className="form-label w-28 capitalize flex-shrink-0">Helpee</div>
                <div className="form-cell flex-1 text-sm">
                  {helpee ? helpee.user_name : <span className="text-hh-placeholder">Helpee Name</span>}
                </div>
                {canManage && (
                  <button onClick={() => setUserPickerRole('helpee')} className="btn-add w-9 h-9 flex-shrink-0" title="Add Helpee">⊕</button>
                )}
              </div>

              {/* Helpers — multiple allowed */}
              <div className="space-y-1">
                {/* First row: label + first helper (or placeholder) + add button — mirrors Helpee/Supervisor layout */}
                <div className="flex gap-2 items-center">
                  <div className="form-label w-28 flex-shrink-0">Helper(s)</div>
                  <div className="form-cell flex-1 text-sm">
                    {helpers.length > 0
                      ? helpers[0].user_name
                      : <span className="text-hh-placeholder">{canManage ? 'No helpers assigned' : ''}</span>
                    }
                  </div>
                  {helpers.length > 0 && canManage && (
                    <button onClick={() => removeHelper(helpers[0].id)}
                      className="btn-icon w-9 h-9 flex-shrink-0 hover:text-hh-error" title="Remove Helper">✕</button>
                  )}
                  {canManage && (
                    <button onClick={() => setUserPickerRole('helper')} className="btn-add w-9 h-9 flex-shrink-0" title="Add Helper">⊕</button>
                  )}
                </div>
                {/* Additional helpers (2nd onwards) — indented to align with value column */}
                {helpers.slice(1).map(h => (
                  <div key={h.id} className="flex gap-2 items-center">
                    <div className="w-28 flex-shrink-0" />
                    <div className="form-cell flex-1 text-sm">{h.user_name}</div>
                    {canManage && (
                      <button onClick={() => removeHelper(h.id)}
                        className="btn-icon w-9 h-9 flex-shrink-0 hover:text-hh-error" title="Remove Helper">✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Supervisor */}
              <div className="flex gap-2 items-center">
                <div className="form-label w-28 capitalize flex-shrink-0">Supervisor</div>
                <div className="form-cell flex-1 text-sm">
                  {supervisor ? supervisor.user_name : <span className="text-hh-placeholder">Supervisor Name</span>}
                </div>
                {/* Supervisor can assign themselves if no supervisor yet (helpee-created job) */}
                {isSupervisor && isEdit && !supervisor && (
                  <button
                    onClick={() => {
                      setSupervisor(authUser)
                      setAssociatedUsers(prev => [
                        ...prev.filter(a => a.role !== 'supervisor'),
                        { role: 'supervisor', users: authUser },
                      ])
                    }}
                    className="btn-select px-3 text-xs flex-shrink-0"
                    title="Assign yourself as supervisor"
                  >
                    Assign myself
                  </button>
                )}
                {canManage && (
                  <button onClick={() => setUserPickerRole('supervisor')} className="btn-add w-9 h-9 flex-shrink-0" title="Add Supervisor">⊕</button>
                )}
              </div>
            </div>
          </section>

          {(canManage || ((isHelper || isHelpee) && invoice)) && (
            <section>
              <h2 className="font-semibold text-base mb-3">Invoice Details</h2>
              <div className="flex gap-2 items-center">
                {invoice && (
                  <button onClick={() => setShowInvoiceView(true)} className="btn-select px-4 text-sm">View Invoice</button>
                )}
                {/* Only admin/supervisor can add or edit invoices */}
                {canManage && isEdit && dbJobId && (
                  <button onClick={() => setShowInvoiceModal(true)} className="btn-add w-9 h-9" title="Add/Edit Invoice">⊕</button>
                )}
              </div>
              {invoice && (
                <div className="mt-3 space-y-1 text-sm">
                  <p><span className="font-medium">Amount:</span> {invoice.invoice_currency} {invoice.invoice_amount}</p>
                  <p><span className="font-medium">Status:</span> <span className="capitalize">{invoice.invoice_status}</span></p>
                  {invoice.invoice_notes && <p><span className="font-medium">Notes:</span> {invoice.invoice_notes}</p>}
                  {invoice.attachment_url && (
                    <p>
                      <span className="font-medium">Attachment:</span>{' '}
                      <a href={invoice.attachment_url} target="_blank" rel="noreferrer"
                        className="text-hh-green underline">View file ↗</a>
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── JOB MESSAGE + VIEW REMARK ─────────────── */}
        {(canUseJobMessages || isEdit) && (
          <div className="flex flex-col items-end gap-2">
            {canUseJobMessages && (
              <button
                type="button"
                disabled={!dbJobId}
                title={!dbJobId ? 'Save the job first to send messages' : ''}
                onClick={() => dbJobId && setShowJobMessageModal(true)}
                className="btn-select px-5 text-sm bg-hh-green text-white border-hh-green hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Job message
              </button>
            )}
            {isEdit && (
              <button
                type="button"
                onClick={() => navigate(`/jobs/${dbJobId}/remark`)}
                className="btn-select px-5 text-sm"
              >
                View Remark
              </button>
            )}
          </div>
        )}

        {/* ── ACTION BUTTONS ────────────────────────── */}
        {isEdit && (canManage || isHelper) && (
          <section>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Job Started',       newStatus: 'job_started' },
                { label: 'Job Finished',      newStatus: 'job_finished' },
                ...(canManage ? [
                  { label: 'Payment Confirmed', newStatus: 'payment_confirmed' },
                  { label: 'Job Close',         newStatus: 'job_closed' },
                ] : []),
              ].map(({ label, newStatus }) => {
                const allowed = canTransitionTo(status, newStatus)
                return (
                  <button
                    key={newStatus}
                    onClick={() => allowed && setStatusConfirm({ label, newStatus })}
                    disabled={!allowed}
                    title={!allowed ? 'Cannot go back to a previous status' : undefined}
                    className={`btn-action ${!allowed ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── WORKFLOW DISPLAY ─────────────────────── */}
        {isEdit && (
          <section>
            <h2 className="font-semibold text-base mb-3">Job Stage</h2>
            <WorkflowDisplay status={status} associatedUsers={associatedUsers} />
            <p className="text-xs text-hh-placeholder mt-2">
              Current: <span className="font-medium capitalize">{JOB_STATUS_LABELS[status] || status}</span>
            </p>
          </section>
        )}

        {/* ── ATTENDANCE (Frequent jobs only) ──────── */}
        {isFrequent && isEdit && (
          <section>
            <h2 className="font-semibold text-base mb-3">Job Attendance</h2>

            {attendance.length === 0 ? (
              <p className="text-sm text-hh-placeholder">
                {isHelper
                  ? 'No attendance records yet. Check in/out times will appear here once the date range is set by the supervisor.'
                  : isHelpee
                    ? 'No attendance records yet.'
                    : 'No attendance records yet. Save the job with date range first.'}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-xs border-collapse">
                    <thead>
                      <tr>
                        {['Date', 'Sched. Start', 'Sched. End', 'Check In', 'Check Out', 'Remark', 'Hrs',
                          isHourly ? 'Rate/Hr' : 'Rate/Day',
                          isHourly ? 'Amount' : '',
                          'Status',
                          canManage ? 'Action' : null
                        ].filter(Boolean).map(h => (
                          <th
                            key={h}
                            className="border-b-2 border-hh-green/40 bg-hh-mint/60 px-2 py-2.5 text-left text-xs font-semibold text-hh-text whitespace-nowrap align-middle"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attSlice.map(row => {
                        const isRejected = row.att_status === 'rejected'
                        const isPending  = row.att_status === 'pending_approval' || row.att_status === 'resubmitted'
                        const isApproved = row.att_status === 'approved'
                        const canEdit    = canManage || isHelper
                        const canSubmit  = canEdit && (!row.att_status || isRejected)
                        const canApprove = canManage && isPending
                        const canReject  = canManage && isPending
                        const isSaving   = savingAttRow === row.id
                        return (
                          <tr key={row.id} className="border-b border-gray-100">
                            <td className="px-2 py-1.5 font-medium">{row.attendance_date}</td>
                            <td className="px-2 py-1.5 text-hh-placeholder">{row.job_start_time || '—'}</td>
                            <td className="px-2 py-1.5 text-hh-placeholder">{row.job_end_time || '—'}</td>
                            <td className="px-2 py-1.5">
                              {canEdit && !isApproved
                                ? <input type="time" className="form-cell outline-none text-xs w-24"
                                    value={row.check_in_time || ''}
                                    onChange={e => setAttRow(row.id, 'check_in_time', e.target.value)} />
                                : <span>{row.check_in_time || '—'}</span>}
                            </td>
                            <td className="px-2 py-1.5">
                              {canEdit && !isApproved
                                ? <input type="time" className="form-cell outline-none text-xs w-24"
                                    value={row.check_out_time || ''}
                                    onChange={e => setAttRow(row.id, 'check_out_time', e.target.value)} />
                                : <span>{row.check_out_time || '—'}</span>}
                            </td>
                            <td className="px-2 py-1.5 max-w-[140px]">
                              {canEdit && !isApproved
                                ? <input type="text" className="form-cell outline-none text-xs w-full min-w-0"
                                    value={row.remark || ''}
                                    placeholder="Note"
                                    onChange={e => setAttRow(row.id, 'remark', e.target.value)} />
                                : <span className="break-words">{row.remark || '—'}</span>}
                            </td>
                            <td className="px-2 py-1.5">{row.total_hours != null ? Number(row.total_hours).toFixed(2) : '—'}</td>
                            <td className="px-2 py-1.5">
                              {isHourly
                                ? (selectedSpec?.hourly_rate ?? '—')
                                : (row.rate_for_day != null ? Number(row.rate_for_day).toFixed(2) : '—')}
                            </td>
                            {isHourly && (
                              <td className="px-2 py-1.5">
                                {row.total_hours != null && selectedSpec?.hourly_rate
                                  ? (Number(row.total_hours) * Number(selectedSpec.hourly_rate)).toFixed(2)
                                  : '—'}
                              </td>
                            )}
                            <td className="px-2 py-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ATT_STATUS_STYLES[row.att_status] || 'bg-gray-100 text-gray-600'}`}>
                                {ATT_STATUS_LABELS[row.att_status] || 'No Data'}
                              </span>
                              {isRejected && row.rejection_reason && (
                                <p className="text-hh-error text-xs mt-0.5 max-w-[120px] truncate" title={row.rejection_reason}>
                                  {row.rejection_reason}
                                </p>
                              )}
                            </td>
                            {canManage && (
                              <td className="px-2 py-1.5">
                                <div className="flex gap-1 flex-wrap">
                                  {canApprove && (
                                    <button onClick={() => handleApproveRow(row)} disabled={isSaving}
                                      className="btn-action text-xs px-2 py-1">
                                      {isSaving ? '...' : 'Approve'}
                                    </button>
                                  )}
                                  {canReject && (
                                    <button onClick={() => setRejectTarget(row)} disabled={isSaving}
                                      className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-hh hover:bg-red-200">
                                      Reject
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {attPages > 1 && (
                  <div className="flex items-center gap-2 mt-3 justify-center">
                    <button onClick={() => setAttPage(p => Math.max(0, p - 1))} disabled={attPage === 0}
                      className="btn-filter px-3 py-1 text-xs disabled:opacity-40">← Prev</button>
                    <span className="text-xs text-hh-placeholder">Page {attPage + 1} of {attPages}</span>
                    <button onClick={() => setAttPage(p => Math.min(attPages - 1, p + 1))} disabled={attPage === attPages - 1}
                      className="btn-filter px-3 py-1 text-xs disabled:opacity-40">Next →</button>
                  </div>
                )}

                {/* Monthly Total */}
                <div className="mt-4 flex justify-end">
                  <div className="bg-hh-mint border border-hh-green rounded-hh px-6 py-3 text-sm font-medium">
                    Monthly Total: {monthlyTotal.toFixed(2)}
                  </div>
                </div>

                {/* Submit Attendance — helper bulk-submits all filled rows at once */}
                {isHelper && (() => {
                  const submittableRows = attendance.filter(r =>
                    r.check_in_time && r.check_out_time &&
                    (!r.att_status || r.att_status === 'rejected')
                  )
                  if (submittableRows.length === 0) return null
                  return (
                    <div className="mt-4 flex justify-start">
                      <button
                        type="button"
                        disabled={saving || !!savingAttRow}
                        onClick={async () => {
                          setSaving(true)
                          setError('')
                          let failed = 0
                          for (const row of submittableRows) {
                            try { await handleSubmitRow(row) }
                            catch { failed++ }
                          }
                          setSaving(false)
                          if (failed > 0) setError(`${failed} row(s) could not be submitted. Ensure check-in and check-out times are filled.`)
                        }}
                        className="btn-action px-8"
                      >
                        {saving || savingAttRow
                          ? 'Submitting...'
                          : `Submit Attendance (${submittableRows.length} row${submittableRows.length > 1 ? 's' : ''})`}
                      </button>
                    </div>
                  )
                })()}
              </>
            )}
          </section>
        )}

        {/* ── SAVE / UPDATE buttons ───────────────── */}
        {(canManage || (!isEdit && isHelpee)) ? (
          <div className="flex gap-3">
            <button type="button" onClick={handleSave} disabled={saving} className="btn-action px-10">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Job'}
            </button>
            <button type="button" onClick={() => navigate(jobsHubPath(role))} className="btn-filter">
              {isEdit ? 'Back' : 'Cancel'}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(jobsHubPath(role))} className="btn-filter px-8">
              ← Back to Jobs
            </button>
          </div>
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────── */}
      {userPickerRole && (
        <UserPickerModal roleFilter={userPickerRole} onSelect={handleUserSelected} onClose={() => setUserPickerRole(null)} />
      )}
      {showInvoiceModal && dbJobId && (
        <InvoiceModal jobId={dbJobId} existing={invoice}
          onSave={(inv) => { setInvoice(inv); setShowInvoiceModal(false) }}
          onClose={() => setShowInvoiceModal(false)} />
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
            {invoice.attachment_url && (
              <p>
                <span className="font-medium">Attachment:</span>{' '}
                <a href={invoice.attachment_url} target="_blank" rel="noreferrer"
                  className="text-hh-green underline">View file ↗</a>
              </p>
            )}
          </div>
        </div>
      )}
      {statusConfirm && (
        <ConfirmModal message={`Mark job as "${statusConfirm.label}"?`}
          onConfirm={() => handleStatusAction(statusConfirm.newStatus)}
          onCancel={() => setStatusConfirm(null)} />
      )}
      {rejectTarget && (
        <RejectModal
          onConfirm={(reason) => handleRejectRow(rejectTarget, reason)}
          onClose={() => setRejectTarget(null)} />
      )}
      {showJobMessageModal && dbJobId && canUseJobMessages && (
        <JobMessageModal
          jobId={dbJobId}
          open={showJobMessageModal}
          onClose={() => setShowJobMessageModal(false)}
          authUser={authUser}
          authorRole={jobMessageAuthorRole}
        />
      )}
    </MainLayout>
  )
}
