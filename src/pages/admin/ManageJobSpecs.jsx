import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { getJobSpecs, deleteJobSpec } from '../../services/jobSpecService'
import SearchInput from '../../components/SearchInput'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'

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

export default function ManageJobSpecs() {
  const navigate = useNavigate()
  const [specs, setSpecs] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchSpecs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getJobSpecs({ search })
      setSpecs(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchSpecs() }, [fetchSpecs])

  const handleDelete = async () => {
    try {
      await deleteJobSpec(deleteTarget.id)
      setDeleteTarget(null)
      fetchSpecs()
    } catch (e) {
      setError(e.message)
      setDeleteTarget(null)
    }
  }

  return (
    <MainLayout title="Manage Job Specifications">
      <div className="max-w-3xl mx-auto space-y-4">

        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search"
          className="w-56"
        />

        <button
          onClick={() => navigate('/admin/job-specs/new')}
          className="btn-add"
          title="Add Job Specification"
        >
          ⊕
        </button>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <div className="space-y-2">
          <div className="grid grid-cols-[130px_1fr_120px] gap-2">
            <div className="table-header rounded-hh-lg px-3">ID</div>
            <div className="table-header rounded-hh-lg px-3">Name</div>
            <div className="table-header rounded-hh-lg px-3">Action</div>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : specs.length === 0 ? (
            <EmptyState message="No job specifications found" />
          ) : (
            specs.map(s => (
              <div key={s.id} className="grid grid-cols-[130px_1fr_120px] gap-2">
                <div className="table-row rounded-hh-lg px-3 text-sm">{s.job_type_id}</div>
                <div className="table-row rounded-hh-lg px-3 text-sm">{s.job_type_name}</div>
                <div className="table-row rounded-hh-lg px-3 gap-2">
                  <button
                    onClick={() => navigate(`/admin/job-specs/${s.id}/edit`)}
                    className="btn-icon w-8 h-8"
                    title="Edit"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="btn-icon w-8 h-8 hover:text-hh-error"
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {deleteTarget && (
          <ConfirmModal
            message={`Are you sure? Job types in use will be soft-deleted (hidden) instead.`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    </MainLayout>
  )
}
