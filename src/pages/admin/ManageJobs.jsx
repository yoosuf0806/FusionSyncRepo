import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getJobs, getJobsForUser, getJobsForHelpee, deleteJob, isJobExpired } from '../../services/jobService'
import { getOpenReplacementFlags } from '../../services/leaveService'
import SearchInput from '../../components/SearchInput'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { JOB_STATUS_LABELS } from '../../constants/jobStatuses'
import { jobDetailPath, jobNewPath } from '../../constants/jobPaths'


const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

export default function ManageJobs() {
  const navigate = useNavigate()
  const { user: authUser, role, isAdmin, isSupervisor, isHelper, isHelpee } = useAuth()
  const [jobs, setJobs] = useState([])
  const [flaggedJobIds, setFlaggedJobIds] = useState(new Set())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState([])     // job_category values
  const [statusFilter2, setStatusFilter2] = useState([]) // raw status values
  const [openFilterCol, setOpenFilterCol] = useState(null) // 'type' | 'status' | null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showTypeModal, setShowTypeModal] = useState(false)

  // authUser from context IS the DB user record
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
        data = await getJobs({ search })
      }
      setJobs(data)
      // Load open replacement flags to badge affected jobs (internal roles only)
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
  }, [dbUser, isHelper, isHelpee, search])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  // Client-side column filtering (works for all roles)
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
      <div className="max-w-5xl mx-auto space-y-4">

        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID or name"
              className="w-56"
            />
          </div>
        )}

        {(canManage || isHelpee) && (
          <button onClick={() => setShowTypeModal(true)} className="btn-add" title="Add Job">
            ⊕
          </button>
        )}

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <div className="space-y-2">
          <div className="grid grid-cols-[110px_1fr_130px_140px_110px_110px] gap-2">
            <div className="table-header rounded-hh-lg px-2 text-xs">ID</div>
            <div className="table-header rounded-hh-lg px-2 text-xs">Name</div>
            <ColumnFilterHeader
              label="Type"
              open={openFilterCol === 'type'}
              onToggle={() => setOpenFilterCol(openFilterCol === 'type' ? null : 'type')}
              options={[
                { value: 'one-time', label: 'One-time' },
                { value: 'frequent', label: 'Recurring' },
              ]}
              selected={typeFilter}
              onChange={(v) => toggleSet(setTypeFilter, v)}
              onClear={() => setTypeFilter([])}
            />
            <ColumnFilterHeader
              label="Status"
              open={openFilterCol === 'status'}
              onToggle={() => setOpenFilterCol(openFilterCol === 'status' ? null : 'status')}
              options={Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              selected={statusFilter2}
              onChange={(v) => toggleSet(setStatusFilter2, v)}
              onClear={() => setStatusFilter2([])}
            />
            <div className="table-header rounded-hh-lg px-2 text-xs">Date</div>
            <div className="table-header rounded-hh-lg px-2 text-xs">Action</div>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : filteredJobs.length === 0 ? (
            <EmptyState message="No jobs found" />
          ) : (
            filteredJobs.map(job => (
              <div key={job.id} className="grid grid-cols-[110px_1fr_130px_140px_110px_110px] gap-2">
                <div
                  className="table-row rounded-hh-lg px-2 text-xs text-hh-green underline cursor-pointer hover:opacity-80"
                  onClick={() => navigate(jobDetailPath(role, job.id))}
                >
                  {job.job_id}
                </div>
                <div className="table-row rounded-hh-lg px-2 text-xs flex items-center gap-1.5">
                  <span className="truncate">{job.job_name}</span>
                  {flaggedJobIds.has(job.id) && !['job_closed','payment_confirmed','cancelled'].includes(job.status) && (
                    <span className="shrink-0 text-[9px] font-bold bg-red-100 text-hh-error px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      title="A worker is on leave — replacement needed">
                      ⚠ REPLACE
                    </span>
                  )}
                  {isJobExpired(job) && (
                    <span className="shrink-0 text-[9px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      title="This job's scheduled end date has passed but it was never closed">
                      JOB NOT CLOSED, EXPIRED
                    </span>
                  )}
                </div>
                <div className="table-row rounded-hh-lg px-2 text-xs">
                  {job.job_category === 'frequent' ? 'Recurring'
                    : job.job_category === 'one-time' ? 'One-time'
                    : (job.job_specifications?.job_type_name || '—')}
                </div>
                <div className="table-row rounded-hh-lg px-2 text-xs capitalize">
                  {JOB_STATUS_LABELS[job.status] || job.status}
                </div>
                <div className="table-row rounded-hh-lg px-2 text-xs">
                  {formatDate(job.job_from_date)}
                </div>
                <div className="table-row rounded-hh-lg px-2 gap-1">
                  <button
                    onClick={() => navigate(jobDetailPath(role, job.id))}
                    className="btn-icon w-8 h-8"
                    title="View/Edit"
                  >
                    <PencilIcon />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setDeleteTarget(job)}
                      className="btn-icon w-8 h-8 hover:text-hh-error"
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {deleteTarget && (
          <ConfirmModal
            message={`Are you sure? Jobs can only be deleted at Request Raised stage.`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>

      {/* ── Job Type Selection Modal ───────────────── */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-hh-mint rounded-hh-xl shadow-hh-lg w-full max-w-sm p-8 space-y-6">
            <h2 className="text-lg font-semibold text-center text-hh-text">Select Job Type</h2>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => { setShowTypeModal(false); navigate(jobNewPath(role), { state: { category: 'one-time' } }) }}
                className="flex-1 py-4 bg-white text-hh-text font-medium rounded-hh border-2 border-hh-green hover:bg-hh-green hover:text-white transition-colors"
              >
                One-Time Job
              </button>
              <button
                onClick={() => { setShowTypeModal(false); navigate(jobNewPath(role), { state: { category: 'frequent' } }) }}
                className="flex-1 py-4 bg-white text-hh-text font-medium rounded-hh border-2 border-hh-green hover:bg-hh-green hover:text-white transition-colors"
              >
                Frequent Job
              </button>
            </div>
            <button onClick={() => setShowTypeModal(false)} className="w-full btn-filter text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

/* ── Column header with a multi-select filter dropdown ── */
function ColumnFilterHeader({ label, open, onToggle, options, selected, onChange, onClear }) {
  const active = selected.length > 0
  return (
    <div className="table-header rounded-hh-lg px-2 text-xs relative flex items-center justify-between">
      <span>{label}</span>
      <button onClick={onToggle}
        className={`ml-1 flex items-center justify-center w-5 h-5 rounded ${active ? 'text-hh-green' : 'text-hh-placeholder'}`}
        title="Filter">
        <span className="text-[10px]">▼</span>
        {active && <span className="absolute -top-1 -right-1 w-2 h-2 bg-hh-green rounded-full" />}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-2 min-w-[180px] max-h-64 overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-gray-100">
              <span className="text-[11px] font-semibold text-hh-text">Filter {label}</span>
              {active && (
                <button onClick={onClear} className="text-[11px] text-hh-green underline">Clear</button>
              )}
            </div>
            {options.map(opt => (
              <label key={opt.value}
                className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(opt.value)}
                  onChange={() => onChange(opt.value)}
                  className="accent-hh-green" />
                <span className="text-xs text-hh-text normal-case">{opt.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
