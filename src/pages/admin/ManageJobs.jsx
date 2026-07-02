import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Plus, ListFilter, AlertTriangle, CalendarClock } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getJobs, getJobsForUser, getJobsForHelpee, deleteJob, isJobExpired } from '../../services/jobService'
import { getOpenReplacementFlags } from '../../services/leaveService'
import SearchInput from '../../components/SearchInput'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { JOB_STATUS_LABELS, JOB_STATUS_FILTERS } from '../../constants/jobStatuses'
import { jobDetailPath, jobNewPath } from '../../constants/jobPaths'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function statusVariant(status) {
  if (JOB_STATUS_FILTERS.COMPLETED.includes(status)) return 'success'
  if (JOB_STATUS_FILTERS.ONGOING.includes(status)) return 'warning'
  return 'muted'
}

export default function ManageJobs() {
  const navigate = useNavigate()
  const { user: authUser, role, isAdmin, isSupervisor, isHelper, isHelpee } = useAuth()
  const [jobs, setJobs] = useState([])
  const [flaggedJobIds, setFlaggedJobIds] = useState(new Set())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState([])
  const [statusFilter2, setStatusFilter2] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showTypeModal, setShowTypeModal] = useState(false)

  const dbUser = authUser
  const canManage = isAdmin || isSupervisor

  const fetchJobs = useCallback(async () => {
    if (!authUser && (isHelper || isHelpee)) return
    setLoading(true)
    setError('')
    try {
      let data
      if (isHelper && dbUser) {
        data = await getJobsForUser(dbUser.id)
      } else if (isHelpee && dbUser) {
        data = await getJobsForHelpee(dbUser.id)
      } else {
        const departmentId = isSupervisor ? (dbUser?.department_id || null) : null
        data = await getJobs({ search, departmentId })
      }
      setJobs(data)
      if (!isHelper && !isHelpee) {
        try {
          const openFlags = await getOpenReplacementFlags()
          setFlaggedJobIds(new Set((openFlags || []).map(f => f.job_id)))
        } catch { /* non-fatal */ }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dbUser, isHelper, isHelpee, isSupervisor, search])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const toggleSet = (setter, value) =>
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  const filteredJobs = jobs.filter(job => {
    if (typeFilter.length && !typeFilter.includes(job.job_category)) return false
    if (statusFilter2.length && !statusFilter2.includes(job.status)) return false
    return true
  })

  const handleDelete = async () => {
    if (deleteTarget.status !== 'request_raised') {
      setError('Jobs can only be deleted at Request Raised stage')
      setDeleteTarget(null)
      return
    }
    try {
      await deleteJob(deleteTarget.id)
      setDeleteTarget(null)
      fetchJobs()
    } catch (e) {
      setError(e.message)
      setDeleteTarget(null)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—'

  return (
    <MainLayout title="Manage Jobs">
      <div className="space-y-4">

        <div className="flex flex-wrap items-center justify-between gap-3">
          {canManage && (
            <SearchInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID or name"
              className="w-full max-w-xs"
            />
          )}
          {(canManage || isHelpee) && (
            <Button onClick={() => setShowTypeModal(true)} className="ml-auto">
              <Plus className="h-4 w-4" /> New Job
            </Button>
          )}
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <Card className="overflow-hidden">
          {loading ? (
            <LoadingSpinner />
          ) : filteredJobs.length === 0 ? (
            <EmptyState message="No jobs found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[110px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <FilterHead
                    label="Type"
                    options={[{ value: 'one-time', label: 'One-time' }, { value: 'frequent', label: 'Recurring' }]}
                    selected={typeFilter} onChange={(v) => toggleSet(setTypeFilter, v)} onClear={() => setTypeFilter([])}
                  />
                  <FilterHead
                    label="Status"
                    options={Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                    selected={statusFilter2} onChange={(v) => toggleSet(setStatusFilter2, v)} onClear={() => setStatusFilter2([])}
                  />
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map(job => (
                  <TableRow key={job.id} className="cursor-pointer" onClick={() => navigate(jobDetailPath(role, job.id))}>
                    <TableCell className="font-medium text-primary">{job.job_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{job.job_name}</span>
                        {flaggedJobIds.has(job.id) && !['job_closed', 'payment_confirmed', 'cancelled'].includes(job.status) && (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Replace</Badge>
                        )}
                        {isJobExpired(job) && (
                          <Badge variant="warning" className="gap-1"><CalendarClock className="h-3 w-3" /> Expired</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.job_category === 'frequent' ? 'Recurring'
                        : job.job_category === 'one-time' ? 'One-time'
                        : (job.job_specifications?.job_type_name || '—')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(job.status)}>{JOB_STATUS_LABELS[job.status] || job.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(job.job_from_date)}</TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View / Edit"
                          onClick={() => navigate(jobDetailPath(role, job.id))}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete" onClick={() => setDeleteTarget(job)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {deleteTarget && (
          <ConfirmModal
            title="Delete job?"
            message="Jobs can only be deleted at the Request Raised stage. This cannot be undone."
            confirmLabel="Delete"
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>

      {/* Job type selection */}
      <Dialog open={showTypeModal} onOpenChange={setShowTypeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new job</DialogTitle>
            <DialogDescription>Choose the type of job to create.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => { setShowTypeModal(false); navigate(jobNewPath(role), { state: { category: 'one-time' } }) }}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-6 text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <CalendarClock className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold">One-Time Job</span>
            </button>
            <button
              onClick={() => { setShowTypeModal(false); navigate(jobNewPath(role), { state: { category: 'frequent' } }) }}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-6 text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <ListFilter className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold">Recurring Job</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}

/* Column header with multi-select filter dropdown */
function FilterHead({ label, options, selected, onChange, onClear }) {
  const active = selected.length > 0
  return (
    <TableHead>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn('inline-flex items-center gap-1 uppercase tracking-wide', active ? 'text-primary' : 'text-muted-foreground')}>
            {label} <ListFilter className="h-3 w-3" />
            {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto p-2">
          <div className="mb-1 flex items-center justify-between border-b border-border px-1 pb-1.5">
            <span className="text-xs font-semibold">Filter {label}</span>
            {active && <button onClick={onClear} className="text-xs text-primary hover:underline">Clear</button>}
          </div>
          {options.map(opt => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted">
              <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => onChange(opt.value)} className="accent-primary" />
              <span className="text-sm normal-case text-foreground">{opt.label}</span>
            </label>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  )
}
