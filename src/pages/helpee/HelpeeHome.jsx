import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getJobsForHelpee } from '../../services/jobService'
import { getHelpeeDashboard } from '../../services/dashboardService'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { JOB_STATUS_LABELS } from '../../constants/jobStatuses'
import { jobDetailPath, jobNewPath } from '../../constants/jobPaths'

export default function HelpeeHome() {
  const navigate = useNavigate()
  const { user: authUser, role } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [stats, setStats] = useState(null)

  // authUser from context IS the DB user record
  useEffect(() => {
    if (!authUser?.id) return
    getJobsForHelpee(authUser.id).then(data => {
      setJobs(data)
      setLoading(false)
    }).catch(e => {
      setError(e.message)
      setLoading(false)
    })
    getHelpeeDashboard(authUser.id).then(setStats).catch(() => setStats({}))
  }, [authUser])

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—'

  return (
    <MainLayout title="My Jobs">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setShowTypeModal(true)} className="btn-add" title="Request a new job">
            ⊕
          </button>
          <span className="text-sm text-hh-text">Create a new job request</span>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {loading ? (
          <LoadingSpinner />
        ) : jobs.length === 0 ? (
          <EmptyState message="No jobs assigned to you yet" />
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[110px_1fr_130px_130px_120px] gap-2">
              {['ID', 'Name', 'Type', 'Status', 'Date'].map(h => (
                <div key={h} className="table-header rounded-hh-lg px-2 text-xs">{h}</div>
              ))}
            </div>
            {jobs.map(job => (
              <button
                key={job.id}
                onClick={() => navigate(jobDetailPath(role, job.id))}
                className="w-full grid grid-cols-[110px_1fr_130px_130px_120px] gap-2 text-left hover:opacity-90 transition-opacity"
              >
                <div className="table-row rounded-hh-lg px-2 text-xs">{job.job_id}</div>
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
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Overview — below quick actions with clear separation ── */}
      <section className="mt-10 pt-8 border-t border-gray-200">
        <h2 className="text-xs font-semibold text-hh-placeholder uppercase tracking-widest mb-4">Overview</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Ongoing Jobs',      value: stats?.ongoing           },
            { label: 'Completed Jobs',    value: stats?.completed,  accent: true },
            { label: 'Payment Confirmed', value: stats?.payment_confirmed },
          ].map(card => (
            <div
              key={card.label}
              className="bg-gray-800 rounded-xl px-5 py-4 flex flex-col gap-1 min-w-[140px] flex-1
                border border-gray-700"
            >
              <span className="text-xs font-medium text-gray-400 leading-tight tracking-wide">{card.label}</span>
              <span className={`text-2xl font-bold leading-tight ${card.accent ? 'text-hh-green' : 'text-white'}`}>
                {stats === null
                  ? <span className="w-5 h-5 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin inline-block align-middle" />
                  : (card.value ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-hh-mint rounded-hh-xl shadow-hh-lg w-full max-w-sm p-8 space-y-6">
            <h2 className="text-lg font-semibold text-center text-hh-text">Select Job Type</h2>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => { setShowTypeModal(false); navigate(jobNewPath(role), { state: { category: 'one-time' } }) }}
                className="flex-1 py-4 bg-white text-hh-text font-medium rounded-hh border-2 border-hh-green hover:bg-hh-green hover:text-white transition-colors"
              >
                One-Time Job
              </button>
              <button
                type="button"
                onClick={() => { setShowTypeModal(false); navigate(jobNewPath(role), { state: { category: 'frequent' } }) }}
                className="flex-1 py-4 bg-white text-hh-text font-medium rounded-hh border-2 border-hh-green hover:bg-hh-green hover:text-white transition-colors"
              >
                Frequent Job
              </button>
            </div>
            <button type="button" onClick={() => setShowTypeModal(false)} className="w-full btn-filter text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
