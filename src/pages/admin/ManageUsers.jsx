import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Plus } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { userNewPath, userEditPath } from '../../constants/jobPaths'
import { getUsers, deleteUser, checkUserActiveJobs } from '../../services/userService'
import SearchInput from '../../components/SearchInput'
import { exportTableCSV, exportTableExcel } from '../../utils/tableExport'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const ROLE_FILTERS = ['helpee', 'helper', 'supervisor', 'admin']
const ROLE_VARIANT = { admin: 'default', supervisor: 'secondary', helper: 'muted', helpee: 'outline' }

export default function ManageUsers() {
  const navigate = useNavigate()
  const { isAdmin, role } = useAuth()
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBlocked, setDeleteBlocked] = useState(null)
  const [deleteChecking, setDeleteChecking] = useState(false)

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

  const handleDeleteClick = async (user) => {
    setDeleteChecking(true)
    setError('')
    try {
      const activeJobs = await checkUserActiveJobs(user.id)
      if (activeJobs.length > 0) setDeleteBlocked({ user, activeJobs })
      else setDeleteTarget(user)
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleteChecking(false)
    }
  }

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

  const exportUsers = (fmt) => {
    const cols = [
      { key: 'user_id', label: 'ID' },
      { key: 'user_name', label: 'Name' },
      { key: 'user_type', label: 'Type' },
      { key: 'user_email', label: 'Email' },
      { key: 'user_phone', label: 'Phone' },
      { key: 'department', label: 'Department' },
    ]
    const data = users.map(u => ({
      user_id: u.user_id,
      user_name: u.user_name,
      user_type: u.user_type,
      user_email: u.user_email || '',
      user_phone: u.user_phone || '',
      department: u.departments?.department_name || '',
    }))
    if (fmt === 'csv') exportTableCSV(cols, data, 'users')
    else exportTableExcel(cols, data, 'users', 'Users')
  }

  return (
    <MainLayout title="Manage Users">
      <div className="space-y-4">

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users" className="w-full max-w-xs" />
          <div className="flex flex-wrap gap-2">
            {ROLE_FILTERS.map(r => (
              <button
                key={r}
                onClick={() => toggleRoleFilter(r)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors border',
                  roleFilter === r
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="ml-auto flex items-center gap-2">
              {users.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => exportUsers('csv')}>CSV</Button>
                  <Button variant="outline" size="sm" onClick={() => exportUsers('excel')}>Excel</Button>
                </>
              )}
              <Button onClick={() => navigate(userNewPath(role))}>
                <Plus className="h-4 w-4" /> New User
              </Button>
            </div>
          )}
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <Card className="overflow-hidden">
          {loading ? (
            <LoadingSpinner />
          ) : users.length === 0 ? (
            <EmptyState message="No users found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[130px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[140px]">Type</TableHead>
                  <TableHead className="w-[110px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id} className="cursor-pointer" onClick={() => navigate(userEditPath(role, u.id))}>
                    <TableCell className="font-medium text-muted-foreground">{u.user_id}</TableCell>
                    <TableCell className="font-medium text-foreground">{u.user_name}</TableCell>
                    <TableCell><Badge variant={ROLE_VARIANT[u.user_type] || 'muted'} className="capitalize">{u.user_type}</Badge></TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => navigate(userEditPath(role, u.id))}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete" disabled={deleteChecking} onClick={() => handleDeleteClick(u)}>
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

        {/* Blocked — user still has active jobs */}
        <Dialog open={!!deleteBlocked} onOpenChange={(o) => { if (!o) setDeleteBlocked(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cannot delete user</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{deleteBlocked?.user.user_name}</span> is assigned to{' '}
                {deleteBlocked?.activeJobs.length} active job{deleteBlocked?.activeJobs.length > 1 ? 's' : ''}. Remove them from these jobs first:
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {deleteBlocked?.activeJobs.map(j => (
                <li key={j.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="font-medium text-primary">{j.job_id}</span>
                  <span className="flex-1 truncate text-foreground">{j.job_name}</span>
                  <Badge variant="muted" className="capitalize">{j.status.replace(/_/g, ' ')}</Badge>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={() => setDeleteBlocked(null)}>OK, I understand</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {deleteTarget && (
          <ConfirmModal
            title="Delete user?"
            confirmLabel="Delete"
            message={`Permanently delete ${deleteTarget.user_name}? Their completed job history is preserved, but their account and login will be removed. This cannot be undone.`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    </MainLayout>
  )
}
