import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { getUsers } from '../../services/userService'
import SearchInput from '../../components/SearchInput'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'

// Used for both job assignment (Page 18) and department assignment (Page 22)
// Query params:
//   returnTo     - URL to navigate to after selection
//   role         - filter to show only this user type (optional)
//   addUser      - populated with selected user id on return

const ROLE_FILTERS = ['helpee', 'helper', 'supervisor']

export default function SearchUsers() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/admin/home'
  const preRole = searchParams.get('role') || ''

  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(preRole)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [gridView, setGridView] = useState(false)

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

  const handleSelect = (user) => {
    const sep = returnTo.includes('?') ? '&' : '?'
    navigate(`${returnTo}${sep}addUser=${user.id}`)
  }

  const toggleRole = (r) => setRoleFilter(prev => prev === r ? '' : r)

  const GridViewIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
  const ListViewIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )

  return (
    <MainLayout title="Search Users">
      <div className="max-w-4xl mx-auto space-y-4">

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="w-72" />
          {ROLE_FILTERS.map(r => (
            <button key={r} onClick={() => toggleRole(r)} className={roleFilter === r ? 'btn-filter-active' : 'btn-filter'}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            <button onClick={() => setGridView(false)} className={`btn-icon w-9 h-9 ${!gridView ? 'bg-hh-green-med text-white' : ''}`}><ListViewIcon /></button>
            <button onClick={() => setGridView(true)} className={`btn-icon w-9 h-9 ${gridView ? 'bg-hh-green-med text-white' : ''}`}><GridViewIcon /></button>
          </div>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {loading ? (
          <LoadingSpinner />
        ) : users.length === 0 ? (
          <EmptyState message="No users found" />
        ) : gridView ? (
          // Grid view
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {users.map(u => (
              <div key={u.id} className="hh-card p-4 space-y-1">
                <p className="text-sm font-semibold">{u.user_name}</p>
                <p className="text-xs text-hh-placeholder">{u.user_id}</p>
                <p className="text-xs capitalize text-hh-placeholder">{u.user_type}</p>
                <button onClick={() => handleSelect(u)} className="btn-select w-full mt-2 text-sm">Select</button>
              </div>
            ))}
          </div>
        ) : (
          // List view
          <div className="space-y-2">
            <div className="grid grid-cols-[110px_1fr_1fr_120px_120px] gap-2">
              {['ID', 'Name', 'Email', 'Type', 'Action'].map(h => (
                <div key={h} className="table-header rounded-hh-lg px-2 text-xs">{h}</div>
              ))}
            </div>
            {users.map(u => (
              <div key={u.id} className="grid grid-cols-[110px_1fr_1fr_120px_120px] gap-2">
                <div className="table-row rounded-hh-lg px-2 text-xs">{u.user_id}</div>
                <div className="table-row rounded-hh-lg px-2 text-xs">{u.user_name}</div>
                <div className="table-row rounded-hh-lg px-2 text-xs truncate">{u.user_email}</div>
                <div className="table-row rounded-hh-lg px-2 text-xs capitalize">{u.user_type}</div>
                <div className="table-row rounded-hh-lg px-2">
                  <button onClick={() => handleSelect(u)} className="btn-select text-xs px-3">Select</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
