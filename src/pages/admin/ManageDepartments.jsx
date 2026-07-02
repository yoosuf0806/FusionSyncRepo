import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Plus } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { getDepartments, deleteDepartment } from '../../services/departmentService'
import SearchInput from '../../components/SearchInput'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function ManageDepartments() {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchDepts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getDepartments({ search })
      setDepartments(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchDepts() }, [fetchDepts])

  const handleDelete = async () => {
    try {
      await deleteDepartment(deleteTarget.id)
      setDeleteTarget(null)
      fetchDepts()
    } catch (e) {
      setError(e.message)
      setDeleteTarget(null)
    }
  }

  return (
    <MainLayout title="Departments">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search departments" className="w-full max-w-xs" />
          <Button className="ml-auto" onClick={() => navigate('/admin/departments/new')}>
            <Plus className="h-4 w-4" /> New Department
          </Button>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <Card className="overflow-hidden">
          {loading ? (
            <LoadingSpinner />
          ) : departments.length === 0 ? (
            <EmptyState message="No departments found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[140px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="w-[110px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map(d => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/admin/departments/${d.id}/edit`)}>
                    <TableCell className="font-medium text-muted-foreground">{d.department_id}</TableCell>
                    <TableCell className="font-medium text-foreground">{d.department_name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.department_location || '—'}</TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => navigate(`/admin/departments/${d.id}/edit`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete" onClick={() => setDeleteTarget(d)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
            title="Delete department?"
            confirmLabel="Delete"
            message="All users will be unlinked from this department. This cannot be undone."
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    </MainLayout>
  )
}
