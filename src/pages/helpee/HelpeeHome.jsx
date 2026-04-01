import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getJobsForHelpee } from '../../services/jobService'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { JOB_STATUS_LABELS } from '../../constants/jobStatuses'

export default function HelpeeHome() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
  }, [authUser])

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—'

  return (
    <MainLayout title="My Jobs">
      <div className="max-w-3xl mx-auto space-y-4">
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
                onClick={() => navigate(`/admin/jobs/${job.id}`)}
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
    </MainLayout>
  )
}
