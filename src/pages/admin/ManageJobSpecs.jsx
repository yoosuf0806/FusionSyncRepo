import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Plus } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { jobSpecNewPath, jobSpecEditPath } from '../../constants/jobPaths'
import { getJobSpecs, deleteJobSpec } from '../../services/jobSpecService'
import SearchInput from '../../components/SearchInput'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function ManageJobSpecs() {
  const navigate = useNavigate()
  const { isAdmin, role } = useAuth()
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
    <MainLayout title="Job Specifications">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job types" className="w-full max-w-xs" />
          {isAdmin && (
            <Button className="ml-auto" onClick={() => navigate(jobSpecNewPath(role))}>
              <Plus className="h-4 w-4" /> New Job Type
            </Button>
          )}
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <Card className="overflow-hidden">
          {loading ? (
            <LoadingSpinner />
          ) : specs.length === 0 ? (
            <EmptyState message="No job specifications found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[150px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[110px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specs.map(s => (
                  <TableRow key={s.id} className={isAdmin ? 'cursor-pointer' : ''} onClick={isAdmin ? () => navigate(jobSpecEditPath(role, s.id)) : undefined}>
                    <TableCell className="font-medium text-muted-foreground">{s.job_type_id}</TableCell>
                    <TableCell className="font-medium text-foreground">{s.job_type_name}</TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => navigate(jobSpecEditPath(role, s.id))}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete" onClick={() => setDeleteTarget(s)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {deleteTarget && (
          <ConfirmModal
            title="Delete job type?"
            confirmLabel="Delete"
            message="Job types in use will be soft-deleted (hidden) instead of removed."
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    </MainLayout>
  )
}
