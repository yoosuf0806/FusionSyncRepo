import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Plus, X, MessageSquare, Star, Paperclip, AlertTriangle, Check, ChevronRight,
} from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  getJobById, createJob, updateJob, updateJobStatus,
  saveInvoice, uploadInvoiceAttachment, upsertAssociatedUser, removeAssociatedUser,
  getJobMessages, postJobMessage, notifyHelpersAssignedToJob,
  autoCreateOrUpdateInvoice, checkWorkerAvailability,
  getAvailableReplacementWorkers, createWorkerReplacement, getJobWorkerStatuses,
} from '../../services/jobService'
import { getJobSpecs, getQuestionsForSpec } from '../../services/jobSpecService'
import { getDepartments } from '../../services/departmentService'
import { getUsers } from '../../services/userService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import ConfirmModal from '../../components/ConfirmModal'
import JobChecklist from '../../components/JobChecklist'
import { WORKFLOW_STAGES, JOB_STATUS_LABELS, getCompletedStages, canTransitionTo } from '../../constants/jobStatuses'
import { jobsHubPath, jobDetailPath } from '../../constants/jobPaths'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const JOB_CATEGORIES = { ONETIME: 'one-time', FREQUENT: 'frequent' }

// ── User Picker Modal ──────────────────────────────────────────────────────
function UserPickerModal({ roleFilter, departmentId, onSelect, onClose }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const deptFilter = (roleFilter === 'helper' || roleFilter === 'supervisor') ? departmentId : ''
    getUsers({ search, userType: roleFilter, departmentId: deptFilter }).then(data => { setUsers(data); setLoading(false) }).catch(() => setLoading(false))
  }, [search, roleFilter, departmentId])
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="capitalize">Select {roleFilter}</DialogTitle></DialogHeader>
        <Input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {loading ? <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
            : users.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No users found</p>
            : users.map(u => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.user_name}</p>
                  <p className="text-xs text-muted-foreground">{u.user_id} · {u.user_type}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onSelect(u)}>Select</Button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Invoice Modal ──────────────────────────────────────────────────────────
function InvoiceModal({ jobId, existing, onSave, onClose }) {
  const [form, setForm] = useState({
    invoice_amount: existing?.invoice_amount || '',
    invoice_currency: existing?.invoice_currency || 'LKR',
    invoice_date: existing?.invoice_date || '',
    invoice_status: existing?.invoice_status || 'draft',
    invoice_notes: existing?.invoice_notes || '',
    attachment_url: existing?.attachment_url || '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const ACCEPTED = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx'
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      let attachmentUrl = form.attachment_url
      if (file) { setUploadProgress('Uploading file…'); attachmentUrl = await uploadInvoiceAttachment(jobId, file); setUploadProgress('') }
      const payload = { ...form, attachment_url: attachmentUrl }
      await saveInvoice(jobId, payload)
      onSave(payload)
    } catch (e) { alert(e.message); setUploadProgress('') } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Invoice details</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label>Amount</Label><Input type="number" value={form.invoice_amount} onChange={e => setF('invoice_amount', e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label>Currency</Label><Input value={form.invoice_currency} onChange={e => setF('invoice_currency', e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label>Date</Label><Input type="date" value={form.invoice_date} onChange={e => setF('invoice_date', e.target.value)} /></div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={form.invoice_status} onValueChange={v => setF('invoice_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['draft', 'sent', 'paid', 'void'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Notes</Label><Input value={form.invoice_notes} onChange={e => setF('invoice_notes', e.target.value)} /></div>
          <div className="flex flex-col gap-1.5">
            <Label>Attachment</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2.5 text-sm hover:bg-muted">
              <Paperclip className="h-4 w-4 text-primary" />
              <span className="truncate text-muted-foreground">{file ? file.name : (form.attachment_url ? 'Replace file' : 'Attach PDF, Word, Excel or image')}</span>
              <input type="file" accept={ACCEPTED} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            {form.attachment_url && !file && <a href={form.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View existing attachment ↗</a>}
            {uploadProgress && <p className="text-xs text-muted-foreground">{uploadProgress}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save invoice'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Job Message Modal ──────────────────────────────────────────────────────
function JobMessageModal({ jobId, open, onClose, authUser, authorRole }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open || !jobId) return
    setLoading(true); setErr('')
    getJobMessages(jobId).then(setMessages).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [open, jobId])

  const handlePost = async () => {
    if (!text.trim() || !authUser?.id) return
    setPosting(true); setErr('')
    try {
      await postJobMessage(jobId, text, { authorUserId: authUser.id, authorRole, authorName: authUser.user_name })
      setText(''); setMessages(await getJobMessages(jobId))
    } catch (e) { setErr(e.message) } finally { setPosting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Job message</DialogTitle></DialogHeader>
        <div className="max-h-[45vh] min-h-[160px] space-y-3 overflow-y-auto pr-1">
          {err && <p className="text-sm text-destructive">{err}</p>}
          {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            : messages.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>
            : messages.map(m => (
              <div key={m.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">{m.author_name || 'User'} · {m.created_at ? new Date(m.created_at).toLocaleString() : ''}</p>
                <p className="whitespace-pre-wrap text-foreground">{m.body}</p>
              </div>
            ))}
        </div>
        <Textarea placeholder="Write an update for the supervisor or helper…" value={text} onChange={e => setText(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePost} disabled={posting || !text.trim()}>{posting ? 'Posting…' : 'Post'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Workflow stepper ───────────────────────────────────────────────────────
function WorkflowDisplay({ status, associatedUsers }) {
  const completed = getCompletedStages(status, associatedUsers)
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {WORKFLOW_STAGES.map((stage, i) => {
        const done = completed[stage.key]
        return (
          <div key={stage.key} className="flex items-center gap-1">
            <div className={cn('flex h-11 w-24 flex-col items-center justify-center rounded-lg px-1 text-center text-xs font-medium',
              done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {stage.label.map((l, j) => <span key={j}>{l}</span>)}
            </div>
            {i < WORKFLOW_STAGES.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </div>
        )
      })}
    </div>
  )
}

function WorkerStatusTags({ status }) {
  if (!status) return null
  return (
    <>
      {status.onLeave && <Badge variant="warning">On Leave</Badge>}
      {status.replaced && !status.onLeave && <Badge variant="destructive">Replaced</Badge>}
      {status.isReplacement && <Badge variant="warning">Replacement{status.coveringFor ? ` for ${status.coveringFor}` : ''}</Badge>}
    </>
  )
}

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
    job_name: '', job_description: '', job_type_id: '', job_notes: '',
    job_date: '', job_start_time: '',
    job_from_date: '', job_to_date: '', job_end_time: '',
    job_days: 'weekdays_and_weekends',
    job_location: '', job_requester_id: null, department_id: null,
    pricing_structure: 'daily',
  })
  const [loadedJobTypeName, setLoadedJobTypeName] = useState('')
  const [jobId, setJobId] = useState('Auto-generated')
  const [status, setStatus] = useState('request_raised')
  const [dbJobId, setDbJobId] = useState(null)

  const [specs, setSpecs] = useState([])
  const [departments, setDepartments] = useState([])
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [selectedSpec, setSelectedSpec] = useState(null)

  const [helpee, setHelpee] = useState(null)
  const [helpers, setHelpers] = useState([])
  const [workerStatuses, setWorkerStatuses] = useState({})
  const [pendingConflict, setPendingConflict] = useState(null)
  const [showAddChooser, setShowAddChooser] = useState(false)
  const [replacementFlow, setReplacementFlow] = useState(null)
  const ONGOING_STATUSES_JF = ['job_started', 'job_finished']
  const [supervisor, setSupervisor] = useState(null)
  const [associatedUsers, setAssociatedUsers] = useState([])

  const [invoice, setInvoice] = useState(null)

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

  useEffect(() => {
    if (!role || !id || !isEdit) return
    const canonical = jobDetailPath(role, id)
    if (location.pathname !== canonical) navigate(canonical, { replace: true, state: location.state })
  }, [role, id, isEdit, location.pathname, navigate])

  useEffect(() => {
    if (!role || isEdit) return
    if (location.pathname !== '/admin/jobs/new' && location.pathname !== '/admin/jobs/new/frequent') return
    if (role !== 'helpee') return
    const isFreq = location.pathname.includes('frequent')
    navigate('/helpee/jobs/new', { replace: true, state: { ...location.state, ...(isFreq ? { category: 'frequent' } : {}) } })
  }, [role, isEdit, location.pathname, navigate])

  useEffect(() => {
    if (!authUser) return
    setDbUser(authUser)
    if (!isEdit) setForm(prev => ({ ...prev, job_requester_id: authUser.id }))
  }, [authUser, isEdit])

  useEffect(() => {
    if (!authUser || isEdit || !isHelpee) return
    setHelpee(authUser)
    setAssociatedUsers(prev => [...prev.filter(a => a.role !== 'helpee'), { role: 'helpee', users: authUser }])
  }, [authUser, isEdit, isHelpee])

  useEffect(() => {
    if (!authUser || isEdit || !isSupervisor) return
    setSupervisor(authUser)
    setAssociatedUsers(prev => prev.some(a => a.role === 'supervisor') ? prev : [...prev, { role: 'supervisor', users: authUser }])
  }, [authUser, isEdit, isSupervisor])

  useEffect(() => {
    getJobSpecs().then(setSpecs).catch(() => {})
    getDepartments().then(list => {
      setDepartments(list || [])
      if (!isEdit && isSupervisor && authUser?.department_id) {
        setForm(prev => prev.department_id ? prev : { ...prev, department_id: authUser.department_id })
      }
    }).catch(() => {})
  }, []) // eslint-disable-line

  const loadQuestions = useCallback(async (specId) => {
    if (!specId) { setQuestions([]); setAnswers([]); setSelectedSpec(null); return }
    try {
      const qs = await getQuestionsForSpec(specId)
      setQuestions(qs)
      setAnswers(prev => qs.map(q => { const hit = prev.find(a => a.question_id === q.id); return { question_id: q.id, answer_text: hit?.answer_text ?? '' } }))
      setSelectedSpec(specs.find(s => s.id === specId) || null)
    } catch { setQuestions([]) }
  }, [specs])

  useEffect(() => { loadQuestions(form.job_type_id) }, [form.job_type_id, loadQuestions])

  useEffect(() => {
    if (!isEdit) return
    getJobById(id).then(async job => {
      const catRaw = job.job_category ? String(job.job_category).toLowerCase() : ''
      const jc = catRaw === 'frequent' ? JOB_CATEGORIES.FREQUENT : JOB_CATEGORIES.ONETIME
      setCategory(jc)
      const spec = job.job_specifications
      const typeName = spec && typeof spec === 'object' && !Array.isArray(spec) ? spec.job_type_name : (Array.isArray(spec) ? spec[0]?.job_type_name : '')
      setLoadedJobTypeName(typeName || '')
      setForm({
        job_name: job.job_name || '', job_description: job.job_description || '',
        job_type_id: job.job_type_id || '', job_notes: job.job_notes || '',
        job_date: job.job_date || '', job_start_time: job.job_start_time || '',
        job_from_date: job.job_from_date || '', job_to_date: job.job_to_date || '',
        job_end_time: job.job_end_time || '', job_days: job.job_days || 'weekdays_and_weekends',
        job_location: job.job_location || '', job_requester_id: job.job_requester_id,
        department_id: job.department_id, pricing_structure: job.pricing_structure || 'daily',
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

      try { setWorkerStatuses(await getJobWorkerStatuses(job.id) || {}) } catch { /* non-critical */ }

      prevHelperIdsRef.current = assoc.filter(a => a.role === 'helper').map(a => a.users?.id).filter(Boolean)
      if (job.invoice) setInvoice(job.invoice)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [id, isEdit])

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const setAnswer = (qId, val) => setAnswers(prev => prev.map(a => a.question_id === qId ? { ...a, answer_text: val } : a))

  const openHelperPicker = () => {
    if (!form.department_id) { setError('Select a Department before assigning workers.'); return }
    if (ONGOING_STATUSES_JF.includes(status)) setShowAddChooser(true)
    else setUserPickerRole('helper')
  }
  const openSupervisorPicker = () => {
    if (!form.department_id) { setError('Select a Department before assigning a supervisor.'); return }
    setUserPickerRole('supervisor')
  }

  const handleUserSelected = async (user) => {
    const assocEntry = { role: userPickerRole, users: user }
    if (userPickerRole === 'helpee') {
      setHelpee(user)
      setAssociatedUsers(prev => [...prev.filter(a => a.role !== 'helpee'), assocEntry])
    } else if (userPickerRole === 'helper') {
      if (!helpers.find(h => h.id === user.id)) {
        try {
          const { conflicts } = await checkWorkerAvailability(user.id, {
            job_category: category, job_date: form.job_date, job_from_date: form.job_from_date,
            job_to_date: form.job_to_date, job_days: form.job_days, job_start_time: form.job_start_time,
            job_end_time: form.job_end_time, excludeJobId: dbJobId || null,
          })
          if (conflicts && conflicts.length > 0) { setPendingConflict({ user, conflicts, assocEntry }); setUserPickerRole(null); return }
        } catch (e) { console.warn('Availability check failed:', e?.message || e) }
        addHelperConfirmed(user, assocEntry)
      }
    } else if (userPickerRole === 'supervisor') {
      setSupervisor(user)
      setAssociatedUsers(prev => [...prev.filter(a => a.role !== 'supervisor'), assocEntry])
    }
    setUserPickerRole(null)
  }

  const addHelperConfirmed = (user, assocEntry) => {
    setHelpers(prev => prev.find(h => h.id === user.id) ? prev : [...prev, user])
    setAssociatedUsers(prev => [...prev, assocEntry])
  }
  const confirmConflictAssign = () => { if (pendingConflict) { addHelperConfirmed(pendingConflict.user, pendingConflict.assocEntry); setPendingConflict(null) } }
  const cancelConflictAssign = () => setPendingConflict(null)

  const removeHelper = async (userId) => {
    try {
      if (isEdit && dbJobId) await removeAssociatedUser(dbJobId, userId)
      setHelpers(prev => prev.filter(h => h.id !== userId))
      setAssociatedUsers(prev => prev.filter(a => !(a.role === 'helper' && a.users?.id === userId)))
    } catch (e) { setError(e.message) }
  }

  const handleSave = async () => {
    if (!form.job_name.trim()) { setError('Job Name is required'); return }
    if (!form.department_id) { setError('Department is required'); return }
    if (category === JOB_CATEGORIES.ONETIME && !form.job_date) { setError('Job Date is required'); return }
    if (category === JOB_CATEGORIES.FREQUENT && (!form.job_from_date || !form.job_to_date)) { setError('Start and End Date are required'); return }
    if (form.job_start_time && form.job_end_time && form.job_end_time <= form.job_start_time) { setError('Job End Time must be after Job Start Time'); return }

    if (!isEdit) {
      if (isSupervisor || isAdmin) {
        if (!helpee) { setError('Please select a Helpee for this job.'); return }
        if (helpers.length === 0) { setError('Please assign at least one Helper to this job.'); return }
      }
      if (isAdmin && !supervisor) { setError('Please assign a Supervisor to this job.'); return }
    }

    setSaving(true); setError('')
    try {
      const assocUsers = { helpee_id: helpee?.id, helper_ids: helpers.map(h => h.id), supervisor_id: supervisor?.id }
      if (isEdit) {
        const prevHelpers = prevHelperIdsRef.current
        await updateJob(dbJobId, { ...form, job_category: category }, answers)
        if (helpee) await upsertAssociatedUser(dbJobId, helpee.id, 'helpee')
        for (const h of helpers) await upsertAssociatedUser(dbJobId, h.id, 'helper')
        if (supervisor) await upsertAssociatedUser(dbJobId, supervisor.id, 'supervisor')
        const newHelperIds = helpers.map(h => h.id).filter(hid => !prevHelpers.includes(hid))
        if (canManage && newHelperIds.length > 0) await notifyHelpersAssignedToJob(dbJobId, newHelperIds, form.job_name)
        await autoCreateOrUpdateInvoice(dbJobId)
        if (canManage) {
          let nextStatus = null
          const hasSupervisor = !!supervisor
          const hasHelpers = helpers.length > 0
          if (hasHelpers && ['request_raised', 'manager_assigned'].includes(status)) nextStatus = 'helper_assigned'
          else if (hasSupervisor && status === 'request_raised') nextStatus = 'manager_assigned'
          if (nextStatus) { await updateJobStatus(dbJobId, nextStatus); setStatus(nextStatus) }
        }
        prevHelperIdsRef.current = helpers.map(h => h.id)
      } else {
        const result = await createJob({ ...form, job_category: category }, answers, assocUsers, role)
        if (result && result.id) await autoCreateOrUpdateInvoice(result.id)
      }
      // If a supervisor opened this job from their My Day "Unassigned" tab,
      // return there so they can keep working through the queue rather than
      // being bounced to the Manage Jobs hub.
      if (isSupervisor && location.state?.from === 'myday') {
        navigate('/supervisor/my-day')
      } else {
        navigate(jobsHubPath(role))
      }
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const handleStatusAction = async (newStatus) => {
    try { await updateJobStatus(dbJobId, newStatus); setStatus(newStatus) }
    catch (e) { setError(e.message) }
    setStatusConfirm(null)
  }

  const isFrequent = category === JOB_CATEGORIES.FREQUENT
  const readOnly = (isHelpee || isHelper) && isEdit
  const jobTitle = isEdit ? (isFrequent ? 'Job — Recurring' : 'Job — One-time') : (isFrequent ? 'New Recurring Job' : 'New One-time Job')

  const statusActions = [
    { label: 'Job Started', newStatus: 'job_started' },
    { label: 'Job Finished', newStatus: 'job_finished' },
    ...(canManage ? [{ label: 'Payment Confirmed', newStatus: 'payment_confirmed' }, { label: 'Job Close', newStatus: 'job_closed' }] : []),
  ]
  const nextAllowed = statusActions.find(a => canTransitionTo(status, a.newStatus))?.newStatus

  if (loading) return <MainLayout title={jobTitle}><LoadingSpinner /></MainLayout>

  const requesterName = dbUser?.user_name || 'Current User'

  return (
    <MainLayout title={jobTitle}>
      <div className="mx-auto max-w-4xl space-y-6">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {/* Job details */}
        <Card>
          <CardHeader><CardTitle>Job details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Job ID"><Input value={jobId} disabled /></Field>
            <Field label="Schedule"><Input value={isFrequent ? 'Recurring' : 'One-time'} disabled /></Field>

            <Field label="Service">
              {readOnly
                ? <Input value={loadedJobTypeName || selectedSpec?.job_type_name || specs.find(s => s.id === form.job_type_id)?.job_type_name || '—'} disabled />
                : <Select value={form.job_type_id || undefined} onValueChange={v => setField('job_type_id', v)}>
                    <SelectTrigger><SelectValue placeholder="-- Select service --" /></SelectTrigger>
                    <SelectContent>{specs.map(s => <SelectItem key={s.id} value={s.id}>{s.job_type_name}</SelectItem>)}</SelectContent>
                  </Select>}
            </Field>

            <Field label="Department">
              {readOnly || isSupervisor
                ? <Input value={departments.find(d => d.id === form.department_id)?.department_name || '—'} disabled />
                : <Select value={form.department_id || undefined} onValueChange={v => setField('department_id', v)}>
                    <SelectTrigger><SelectValue placeholder="-- Select department --" /></SelectTrigger>
                    <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}</SelectContent>
                  </Select>}
            </Field>

            <Field label="Job name" className="md:col-span-2">
              <Input value={form.job_name} onChange={e => setField('job_name', e.target.value)} placeholder="Job name" readOnly={readOnly} />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea value={form.job_description} onChange={e => setField('job_description', e.target.value)} placeholder="Description" readOnly={readOnly} className="min-h-[64px]" />
            </Field>

            {isFrequent ? (
              <>
                <Field label="Start date"><Input type="date" value={form.job_from_date} onChange={e => setField('job_from_date', e.target.value)} readOnly={readOnly} /></Field>
                <Field label="End date"><Input type="date" value={form.job_to_date} onChange={e => setField('job_to_date', e.target.value)} readOnly={readOnly} /></Field>
                <Field label="Start time"><Input type="time" value={form.job_start_time} onChange={e => setField('job_start_time', e.target.value)} readOnly={readOnly} /></Field>
                <Field label="End time"><Input type="time" value={form.job_end_time} onChange={e => setField('job_end_time', e.target.value)} readOnly={readOnly} /></Field>
                <Field label="Job days">
                  <Select value={form.job_days} onValueChange={v => setField('job_days', v)} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekdays_only">Weekdays Only (Mon–Fri)</SelectItem>
                      <SelectItem value="weekends_only">Weekends Only (Sat–Sun)</SelectItem>
                      <SelectItem value="weekdays_and_weekends">Weekdays and Weekends</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Location"><Input value={form.job_location} onChange={e => setField('job_location', e.target.value)} placeholder="Location" readOnly={readOnly} /></Field>
                {canManage && (
                  <Field label="Pricing" className="md:col-span-2">
                    <div className="flex gap-2">
                      {[{ val: 'daily', label: 'Daily Rate' }, { val: 'hourly', label: 'Hourly Rate' }].map(opt => (
                        <Button key={opt.val} type="button" variant={form.pricing_structure === opt.val ? 'default' : 'outline'}
                          onClick={() => !readOnly && setField('pricing_structure', opt.val)}>{opt.label}</Button>
                      ))}
                    </div>
                  </Field>
                )}
              </>
            ) : (
              <>
                <Field label="Job date"><Input type="date" value={form.job_date} onChange={e => setField('job_date', e.target.value)} readOnly={readOnly} /></Field>
                <Field label="Start time"><Input type="time" value={form.job_start_time} onChange={e => setField('job_start_time', e.target.value)} readOnly={readOnly} /></Field>
                <Field label="End time"><Input type="time" value={form.job_end_time} onChange={e => setField('job_end_time', e.target.value)} readOnly={readOnly} /></Field>
                <Field label="Location"><Input value={form.job_location} onChange={e => setField('job_location', e.target.value)} placeholder="Location" readOnly={readOnly} /></Field>
              </>
            )}

            <Field label="Requester"><Input value={requesterName} disabled /></Field>
            <Field label="Remark / notes" className="md:col-span-2">
              <Textarea value={form.job_notes} onChange={e => setField('job_notes', e.target.value)}
                placeholder="Optional notes visible to everyone on this job (e.g. access instructions)" readOnly={!canManage} className="min-h-[64px]" />
            </Field>
          </CardContent>
        </Card>

        {/* Questions */}
        {questions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Job-specific questions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {questions.map((q, i) => (
                <Field key={q.id} label={q.question_text}>
                  <Input value={answers[i]?.answer_text || ''} onChange={e => setAnswer(q.id, e.target.value)} placeholder="Enter answer" readOnly={readOnly} />
                </Field>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Associated users + invoice */}
        <div className={cn('grid gap-6', (canManage || (isEdit && invoice && (isHelpee || isHelper))) ? 'md:grid-cols-2' : 'grid-cols-1')}>
          <Card>
            <CardHeader><CardTitle>Associated users</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Helpee */}
              <UserSlot label="Helpee" name={helpee?.user_name} placeholder="Helpee name"
                onAdd={canManage ? () => setUserPickerRole('helpee') : undefined} />

              {/* Helpers */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm font-medium text-muted-foreground">Helper(s)</span>
                  <div className="flex flex-1 flex-wrap items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
                    {helpers.length > 0
                      ? <><span className="text-foreground">{helpers[0].user_name}</span><WorkerStatusTags status={workerStatuses[helpers[0].id]} /></>
                      : <span className="text-muted-foreground">{canManage ? 'No helpers assigned' : '—'}</span>}
                  </div>
                  {helpers.length > 0 && canManage && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeHelper(helpers[0].id)}><X className="h-4 w-4" /></Button>
                  )}
                  {canManage && <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={openHelperPicker} title="Add helper"><Plus className="h-4 w-4" /></Button>}
                </div>
                {helpers.slice(1).map(h => (
                  <div key={h.id} className="flex items-center gap-2">
                    <span className="w-24 shrink-0" />
                    <div className="flex flex-1 flex-wrap items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
                      <span className="text-foreground">{h.user_name}</span><WorkerStatusTags status={workerStatuses[h.id]} />
                    </div>
                    {canManage && <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeHelper(h.id)}><X className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </div>

              {/* Supervisor */}
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-sm font-medium text-muted-foreground">Supervisor</span>
                <div className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm">
                  {supervisor ? <span className="text-foreground">{supervisor.user_name}</span> : <span className="text-muted-foreground">Supervisor name</span>}
                </div>
                {isSupervisor && isEdit && !supervisor && (
                  <Button variant="secondary" size="sm" className="shrink-0" onClick={() => {
                    setSupervisor(authUser)
                    setAssociatedUsers(prev => [...prev.filter(a => a.role !== 'supervisor'), { role: 'supervisor', users: authUser }])
                  }}>Assign myself</Button>
                )}
                {canManage && <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={openSupervisorPicker} title="Add supervisor"><Plus className="h-4 w-4" /></Button>}
              </div>
            </CardContent>
          </Card>

          {(canManage || ((isHelper || isHelpee) && invoice)) && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Invoice</CardTitle>
                <div className="flex gap-2">
                  {invoice && <Button variant="outline" size="sm" onClick={() => setShowInvoiceView(true)}>View</Button>}
                  {canManage && isEdit && dbJobId && <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setShowInvoiceModal(true)} title="Add / edit invoice"><Plus className="h-4 w-4" /></Button>}
                </div>
              </CardHeader>
              <CardContent>
                {invoice ? (
                  <div className="space-y-1.5 text-sm">
                    <p><span className="font-medium text-muted-foreground">Amount:</span> {invoice.invoice_currency} {invoice.invoice_amount}</p>
                    <p className="flex items-center gap-2"><span className="font-medium text-muted-foreground">Status:</span> <Badge variant="muted" className="capitalize">{invoice.invoice_status}</Badge></p>
                    {invoice.invoice_notes && <p><span className="font-medium text-muted-foreground">Notes:</span> {invoice.invoice_notes}</p>}
                    {invoice.attachment_url && <p><span className="font-medium text-muted-foreground">Attachment:</span> <a href={invoice.attachment_url} target="_blank" rel="noreferrer" className="text-primary underline">View file ↗</a></p>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No invoice yet.</p>}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Task checklist */}
        {isEdit && dbJobId && (
          <Card>
            <CardHeader><CardTitle>Task checklist</CardTitle></CardHeader>
            <CardContent>
              <JobChecklist jobId={dbJobId} canManage={canManage} userId={authUser?.id} />
            </CardContent>
          </Card>
        )}

        {/* Message + remark */}
        {(canUseJobMessages || isEdit) && (
          <div className="flex flex-wrap justify-end gap-2">
            {canUseJobMessages && (
              <Button variant="outline" disabled={!dbJobId} title={!dbJobId ? 'Save the job first to send messages' : ''} onClick={() => dbJobId && setShowJobMessageModal(true)}>
                <MessageSquare className="h-4 w-4" /> Job message
              </Button>
            )}
            {isEdit && <Button variant="outline" onClick={() => navigate(`/jobs/${dbJobId}/remark`)}><Star className="h-4 w-4" /> View remark</Button>}
          </div>
        )}

        {/* Status actions */}
        {isEdit && (canManage || isHelper) && (
          <Card>
            <CardHeader><CardTitle>Advance status</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {statusActions.map(({ label, newStatus }) => {
                const allowed = canTransitionTo(status, newStatus)
                const isNext = newStatus === nextAllowed
                return (
                  <Button key={newStatus} variant={isNext ? 'default' : 'outline'} disabled={!allowed}
                    title={!allowed ? 'Cannot go back to a previous status' : undefined}
                    onClick={() => allowed && setStatusConfirm({ label, newStatus })}>
                    {isNext && <Check className="h-4 w-4" />} {label}
                  </Button>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Workflow */}
        {isEdit && (
          <Card>
            <CardHeader><CardTitle>Job stage</CardTitle></CardHeader>
            <CardContent>
              <WorkflowDisplay status={status} associatedUsers={associatedUsers} />
              <p className="mt-3 text-xs text-muted-foreground">Current: <span className="font-medium capitalize text-foreground">{JOB_STATUS_LABELS[status] || status}</span></p>
            </CardContent>
          </Card>
        )}

        {/* Attendance notice */}
        {isFrequent && isEdit && canManage && (
          <Card>
            <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Attendance is managed in the{' '}
                <button type="button" onClick={() => navigate(isAdmin ? '/admin/manage-attendance' : '/supervisor/manage-attendance')} className="font-semibold text-primary underline">Manage Attendance</button>{' '}
                screen. Workers check in and out from their <span className="font-semibold text-foreground">My Day</span> screen.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Save / back */}
        {(canManage || (!isEdit && isHelpee)) ? (
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="px-10">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}</Button>
            <Button variant="outline" onClick={() => navigate(jobsHubPath(role))}>{isEdit ? 'Back' : 'Cancel'}</Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => navigate(jobsHubPath(role))}>← Back to Jobs</Button>
        )}
      </div>

      {/* Modals */}
      {userPickerRole && <UserPickerModal roleFilter={userPickerRole} departmentId={form.department_id} onSelect={handleUserSelected} onClose={() => setUserPickerRole(null)} />}

      <Dialog open={!!pendingConflict} onOpenChange={(o) => { if (!o) cancelConflictAssign() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Scheduling conflict</DialogTitle>
            <DialogDescription>{pendingConflict?.user.user_name} may not be available for this job.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
            {pendingConflict?.conflicts.map((c, i) => (
              <div key={i} className="text-foreground">
                {c.type === 'leave'
                  ? <><span className="font-semibold text-warning">On approved leave</span> — {c.detail}</>
                  : <>Already assigned to <span className="font-semibold text-warning">{c.label}</span> <span className="text-muted-foreground">— {c.detail}</span></>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelConflictAssign}>Cancel</Button>
            <Button onClick={confirmConflictAssign}>Assign anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAddChooser && (
        <AddWorkerChooser
          onAdditional={() => { setShowAddChooser(false); setUserPickerRole('helper') }}
          onReplacement={() => { setShowAddChooser(false); setReplacementFlow({ replacedUserId: '', fromDate: '', toDate: '', reason: '', candidates: null, replacementUserId: '', loading: false, err: '' }) }}
          onClose={() => setShowAddChooser(false)} canReplace={helpers.length > 0} />
      )}

      {replacementFlow && (
        <ReplacementFlowModal flow={replacementFlow} setFlow={setReplacementFlow} jobId={dbJobId} currentHelpers={helpers} createdBy={authUser?.id}
          onDone={(newWorker) => { setHelpers(prev => prev.find(h => h.id === newWorker.id) ? prev : [...prev, newWorker]); setReplacementFlow(null) }}
          onClose={() => setReplacementFlow(null)} />
      )}

      {showInvoiceModal && dbJobId && <InvoiceModal jobId={dbJobId} existing={invoice} onSave={(inv) => { setInvoice(inv); setShowInvoiceModal(false) }} onClose={() => setShowInvoiceModal(false)} />}

      <Dialog open={showInvoiceView && !!invoice} onOpenChange={(o) => { if (!o) setShowInvoiceView(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invoice</DialogTitle></DialogHeader>
          {invoice && (
            <div className="space-y-1.5 text-sm">
              <p><span className="font-medium text-muted-foreground">Amount:</span> {invoice.invoice_currency} {invoice.invoice_amount}</p>
              <p><span className="font-medium text-muted-foreground">Date:</span> {invoice.invoice_date || '—'}</p>
              <p className="flex items-center gap-2"><span className="font-medium text-muted-foreground">Status:</span> <Badge variant="muted" className="capitalize">{invoice.invoice_status}</Badge></p>
              {invoice.invoice_notes && <p><span className="font-medium text-muted-foreground">Notes:</span> {invoice.invoice_notes}</p>}
              {invoice.attachment_url && <p><span className="font-medium text-muted-foreground">Attachment:</span> <a href={invoice.attachment_url} target="_blank" rel="noreferrer" className="text-primary underline">View file ↗</a></p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {statusConfirm && (
        <ConfirmModal title="Update status" confirmLabel="Confirm" message={`Mark job as "${statusConfirm.label}"?`}
          onConfirm={() => handleStatusAction(statusConfirm.newStatus)} onCancel={() => setStatusConfirm(null)} />
      )}

      {showJobMessageModal && dbJobId && canUseJobMessages && (
        <JobMessageModal jobId={dbJobId} open={showJobMessageModal} onClose={() => setShowJobMessageModal(false)} authUser={authUser} authorRole={jobMessageAuthorRole} />
      )}
    </MainLayout>
  )
}

// Small stacked label+field helper
function Field({ label, children, className }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function UserSlot({ label, name, placeholder, onAdd }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm">
        {name ? <span className="text-foreground">{name}</span> : <span className="text-muted-foreground">{placeholder}</span>}
      </div>
      {onAdd && <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onAdd} title={`Add ${label}`}><Plus className="h-4 w-4" /></Button>}
    </div>
  )
}

/* Additional vs Replacement chooser */
function AddWorkerChooser({ onAdditional, onReplacement, onClose, canReplace }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add worker</DialogTitle>
          <DialogDescription>This job is already in progress. Adding an additional worker, or replacing one?</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3">
          <button onClick={onAdditional} className="rounded-xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent">
            <div className="font-semibold text-foreground">Additional worker</div>
            <div className="text-sm text-muted-foreground">Assign another worker on top of the current team.</div>
          </button>
          <button onClick={onReplacement} disabled={!canReplace} className="rounded-xl border border-border p-4 text-left transition-colors hover:border-warning hover:bg-warning/5 disabled:opacity-50">
            <div className="font-semibold text-foreground">Replacement</div>
            <div className="text-sm text-muted-foreground">{canReplace ? 'Cover an existing worker for a date range.' : 'No existing worker to replace.'}</div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* Replacement flow */
function ReplacementFlowModal({ flow, setFlow, jobId, currentHelpers, createdBy, onDone, onClose }) {
  const upd = (patch) => setFlow(prev => ({ ...prev, ...patch }))

  const loadCandidates = async () => {
    if (!flow.replacedUserId || !flow.fromDate || !flow.toDate) { upd({ err: 'Select who is being replaced and the coverage dates first.' }); return }
    if (flow.toDate < flow.fromDate) { upd({ err: 'To date must be on or after From date.' }); return }
    upd({ loading: true, err: '', candidates: null })
    try { upd({ candidates: await getAvailableReplacementWorkers(jobId, flow.replacedUserId, flow.fromDate, flow.toDate), loading: false }) }
    catch (e) { upd({ err: e.message || 'Could not load available workers', loading: false }) }
  }

  const submit = async () => {
    if (!flow.replacementUserId) { upd({ err: 'Select a replacement worker.' }); return }
    upd({ loading: true, err: '' })
    try {
      await createWorkerReplacement({ jobId, replacedUserId: flow.replacedUserId, replacementUserId: flow.replacementUserId, fromDate: flow.fromDate, toDate: flow.toDate, reason: flow.reason, createdBy })
      const picked = (flow.candidates || []).find(c => c.id === flow.replacementUserId)
      onDone(picked || { id: flow.replacementUserId, user_name: 'Replacement' })
    } catch (e) { upd({ err: e.message || 'Could not assign replacement', loading: false }) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>Replace worker</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label>Worker being replaced</Label>
            <Select value={flow.replacedUserId || undefined} onValueChange={v => upd({ replacedUserId: v, candidates: null, replacementUserId: '' })}>
              <SelectTrigger><SelectValue placeholder="Select worker…" /></SelectTrigger>
              <SelectContent>{currentHelpers.map(h => <SelectItem key={h.id} value={h.id}>{h.user_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label>From</Label><Input type="date" value={flow.fromDate} onChange={e => upd({ fromDate: e.target.value, candidates: null, replacementUserId: '' })} /></div>
            <div className="flex flex-col gap-1.5"><Label>To</Label><Input type="date" value={flow.toDate} onChange={e => upd({ toDate: e.target.value, candidates: null, replacementUserId: '' })} /></div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Reason for replacement</Label>
            <Textarea value={flow.reason} onChange={e => upd({ reason: e.target.value })} placeholder="Why is a replacement needed?" className="min-h-[64px]" />
          </div>
          {flow.candidates === null ? (
            <Button variant="outline" className="w-full" onClick={loadCandidates} disabled={flow.loading}>{flow.loading ? 'Checking availability…' : 'Find available workers'}</Button>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Available worker {flow.candidates.length === 0 && '(none available for this window)'}</Label>
              <Select value={flow.replacementUserId || undefined} onValueChange={v => upd({ replacementUserId: v })} disabled={flow.candidates.length === 0}>
                <SelectTrigger><SelectValue placeholder="Select replacement…" /></SelectTrigger>
                <SelectContent>{flow.candidates.map(c => <SelectItem key={c.id} value={c.id}>{c.user_name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Workers on leave or already booked in this window are hidden.</p>
            </div>
          )}
          {flow.err && <ErrorBanner message={flow.err} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={flow.loading || flow.candidates === null || !flow.replacementUserId}>{flow.loading ? 'Assigning…' : 'Assign replacement'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
