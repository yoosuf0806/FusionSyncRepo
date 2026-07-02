import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { getUsers } from '../../services/userService'
import SearchInput from '../../components/SearchInput'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const ROLE_FILTERS = ['helpee', 'helper', 'supervisor']
const ROLE_VARIANT = { admin: 'default', supervisor: 'secondary', helper: 'muted', helpee: 'outline' }

function initials(name) {
  if (!name) return 'U'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

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

  return (
    <MainLayout title="Search Users">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users" className="w-full max-w-xs" />
          <div className="flex flex-wrap gap-2">
            {ROLE_FILTERS.map(r => (
              <button key={r} onClick={() => toggleRole(r)}
                className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors border',
                  roleFilter === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted')}>
                {r}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1 rounded-lg border border-border bg-card p-1">
            <Button variant={!gridView ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setGridView(false)}><List className="h-4 w-4" /></Button>
            <Button variant={gridView ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setGridView(true)}><LayoutGrid className="h-4 w-4" /></Button>
          </div>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {loading ? (
          <LoadingSpinner />
        ) : users.length === 0 ? (
          <EmptyState message="No users found" />
        ) : gridView ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {users.map(u => (
              <Card key={u.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback>{initials(u.user_name)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{u.user_name}</p>
                    <p className="text-xs text-muted-foreground">{u.user_id}</p>
                  </div>
                  <Badge variant={ROLE_VARIANT[u.user_type] || 'muted'} className="capitalize">{u.user_type}</Badge>
                </div>
                <Button variant="outline" className="w-full" onClick={() => handleSelect(u)}>Select</Button>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[110px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-muted-foreground">{u.user_id}</TableCell>
                    <TableCell className="font-medium text-foreground">{u.user_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.user_email}</TableCell>
                    <TableCell><Badge variant={ROLE_VARIANT[u.user_type] || 'muted'} className="capitalize">{u.user_type}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleSelect(u)}>Select</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
