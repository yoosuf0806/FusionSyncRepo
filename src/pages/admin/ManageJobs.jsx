import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getJobs, getJobsForUser, getJobsForHelpee, deleteJob } from '../../services/jobService'
import SearchInput from '../../components/SearchInput'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { JOB_STATUS_LABELS } from '../../constants/jobStatuses'

const STATUS_FILTERS = ['pending', 'ongoing', 'completed']

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
  const { user: authUser, isAdmin, isSupervisor, isHelper, isHelpee } = useAuth()
  const [jobs, setJobs] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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
        data = await getJobs({ search, statusFilter })
      }
      setJobs(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dbUser, isHelper, isHelpee, search, statusFilter])

  useEffect(() => { fetchJobs() }, [fetchJobs])

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

  const toggleFilter = (f) => setStatusFilter(prev => prev === f ? '' : f)

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—'

  return (
    <MainLayout title="Manage Jobs">
      <div className="max-w-5xl mx-auto space-y-4">

        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="w-56"
            />
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => toggleFilter(f)}
                className={statusFilter === f ? 'btn-filter-active' : 'btn-filter'}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {canManage && (
          <button onClick={() => setShowTypeModal(true)} className="btn-add" title="Add Job">
            ⊕
          </button>
        )}

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <div className="space-y-2">
          <div className="grid grid-cols-[110px_1fr_130px_140px_110px_110px] gap-2">
            {['ID', 'Name', 'Type', 'Status', 'Date', 'Action'].map(h => (
              <div key={h} className="table-header rounded-hh-lg px-2 text-xs">{h}</div>
            ))}
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : jobs.length === 0 ? (
            <EmptyState message="No jobs found" />
          ) : (
            jobs.map(job => (
              <div key={job.id} className="grid grid-cols-[110px_1fr_130px_140px_110px_110px] gap-2">
                <div
                  className="table-row rounded-hh-lg px-2 text-xs text-hh-green underline cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/admin/jobs/${job.id}`)}
                >
                  {job.job_id}
                </div>
                <div className="table-row rounded-hh-lg px-2 text-xs">{job.job_name}</div>
                <div className="table-row rounded-hh-lg px-2 text-xs">
                  {job.job_specifications?.job_type_name || '—'}
                </div>
                <div className="table-row rounded-hh-lg px-2 text-xs capitalize">
                  {JOB_STATUS_LABELS[job.status] || job.status}
                </div>
                <div className="table-row rounded-hh-lg px-2 text-xs">
                  {formatDate(job.job_from_date)}
                </div>
                <div className="table-row rounded-hh-lg px-2 gap-1">
                  <button
                    onClick={() => navigate(`/admin/jobs/${job.id}`)}
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
                onClick={() => { setShowTypeModal(false); navigate('/admin/jobs/new', { state: { category: 'one-time' } }) }}
                className="flex-1 py-4 bg-white text-hh-text font-medium rounded-hh border-2 border-hh-green hover:bg-hh-green hover:text-white transition-colors"
              >
                One-Time Job
              </button>
              <button
                onClick={() => { setShowTypeModal(false); navigate('/admin/jobs/new', { state: { category: 'frequent' } }) }}
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
