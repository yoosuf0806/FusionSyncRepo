import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { userNewPath, userEditPath } from '../../constants/jobPaths'
import { getUsers, deleteUser } from '../../services/userService'
import SearchInput from '../../components/SearchInput'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'

const ROLE_FILTERS = ['helpee', 'helper', 'supervisor', 'admin']

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

export default function ManageUsers() {
  const navigate = useNavigate()
  const { isAdmin, role } = useAuth()
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getUsers({ search, userType: roleFilter })
      setUsers(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleDelete = async () => {
    try {
      await deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      fetchUsers()
    } catch (e) {
      setError(e.message)
      setDeleteTarget(null)
    }
  }

  const toggleRoleFilter = (r) => setRoleFilter(prev => prev === r ? '' : r)

  return (
    <MainLayout title="Manage Users">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            className="w-56"
          />
          {ROLE_FILTERS.map(r => (
            <button
              key={r}
              onClick={() => toggleRoleFilter(r)}
              className={roleFilter === r ? 'btn-filter-active' : 'btn-filter'}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Add button */}
        {isAdmin && (
          <button
            onClick={() => navigate(userNewPath(role))}
            className="btn-add"
            title="Add User"
          >
            ⊕
          </button>
        )}

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {/* Table */}
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[120px_1fr_150px_120px] gap-2">
            <div className="table-header rounded-hh-lg px-3">ID</div>
            <div className="table-header rounded-hh-lg px-3">Name</div>
            <div className="table-header rounded-hh-lg px-3">Type</div>
            <div className="table-header rounded-hh-lg px-3">Action</div>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : users.length === 0 ? (
            <EmptyState message="No users found" />
          ) : (
            users.map(u => (
              <div key={u.id} className="grid grid-cols-[120px_1fr_150px_120px] gap-2">
                <div className="table-row rounded-hh-lg px-3 text-sm">{u.user_id}</div>
                <div className="table-row rounded-hh-lg px-3 text-sm">{u.user_name}</div>
                <div className="table-row rounded-hh-lg px-3 text-sm capitalize">{u.user_type}</div>
                <div className="table-row rounded-hh-lg px-3 gap-2">
                  <button
                    onClick={() => navigate(userEditPath(role, u.id))}
                    className="btn-icon w-8 h-8"
                    title="Edit"
                  >
                    <PencilIcon />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="btn-icon w-8 h-8 hover:text-hh-error hover:border-hh-error"
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
            message={`Are you sure you want to delete ${deleteTarget.user_name}? This cannot be undone.`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    </MainLayout>
  )
}
