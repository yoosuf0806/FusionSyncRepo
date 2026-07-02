import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import {
  getDepartmentById, createDepartment, updateDepartment,
  addUserToDepartment, removeUserFromDepartment,
} from '../../services/departmentService'
import { getUsers } from '../../services/userService'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import SearchInput from '../../components/SearchInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function UserPickerModal({ open, onSelect, onClose, excludeIds = [] }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    getUsers({ search, userType: roleFilter }).then(data => { setUsers(data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [search, roleFilter, open])

  const roles = ['helper', 'helpee', 'supervisor']

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Select user</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID" className="min-w-[200px] flex-1" />
          {roles.map(r => (
            <button key={r} onClick={() => setRoleFilter(prev => prev === r ? '' : r)}
              className={cn('rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors border',
                roleFilter === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted')}>
              {r}
            </button>
          ))}
        </div>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No users found</p>
          ) : users.map(u => {
            const excluded = excludeIds.includes(u.id)
            return (
              <div key={u.id} className={cn('flex items-center justify-between gap-3 rounded-lg border border-border p-3', excluded ? 'opacity-50' : 'hover:bg-muted')}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{u.user_name}</p>
                  <p className="text-xs text-muted-foreground">{u.user_id} · <span className="capitalize">{u.user_type}</span></p>
                </div>
                <Button variant={excluded ? 'ghost' : 'outline'} size="sm" disabled={excluded} onClick={() => !excluded && onSelect(u)}>
                  {excluded ? 'Added' : 'Select'}
                </Button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function DepartmentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({ department_name: '', department_location: '', department_address: '', currency: '' })
  const [deptId, setDeptId] = useState('Auto-generated')
  const [deptUsers, setDeptUsers] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  const [showUserPicker, setShowUserPicker] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    getDepartmentById(id).then(dept => {
      setForm({
        department_name: dept.department_name || '',
        department_location: dept.department_location || '',
        department_address: dept.department_address || '',
        currency: dept.currency || '',
      })
      setDeptId(dept.department_id || 'Auto-generated')
      setDeptUsers(dept.department_users || [])
      setLoading(false)
    }).catch(e => { setApiError(e.message); setLoading(false) })
  }, [id, isEdit])

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.department_name.trim()) e.department_name = 'Department name is required'
    if (!form.department_location.trim()) e.department_location = 'Location is required'
    if (!form.department_address.trim()) e.department_address = 'Address is required'
    return e
  }

  const allUserIds = [...deptUsers.map(du => du.user_id), ...pendingUsers.map(u => u.id)]

  const handleSelectUser = async (user) => {
    setShowUserPicker(false)
    setApiError('')
    if (isEdit) {
      try {
        await addUserToDepartment(id, user.id)
        const dept = await getDepartmentById(id)
        setDeptUsers(dept.department_users || [])
      } catch (e) { setApiError(e.message) }
    } else {
      setPendingUsers(prev => [...prev, user])
    }
  }

  const handleRemovePending = (userId) => setPendingUsers(prev => prev.filter(u => u.id !== userId))

  const handleRemoveSaved = async () => {
    try {
      await removeUserFromDepartment(removeTarget.id)
      setDeptUsers(prev => prev.filter(u => u.id !== removeTarget.id))
      setRemoveTarget(null)
    } catch (e) { setApiError(e.message); setRemoveTarget(null) }
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    setApiError('')
    try {
      if (isEdit) {
        await updateDepartment(id, form)
      } else {
        const newDept = await createDepartment(form)
        for (const user of pendingUsers) await addUserToDepartment(newDept.id, user.id).catch(() => {})
        setPendingUsers([])
      }
      navigate('/admin/departments')
    } catch (err) { setApiError(err.message) } finally { setSaving(false) }
  }

  const errClass = (field) => errors[field] ? 'border-destructive focus-visible:ring-destructive/30' : ''

  if (loading) return <MainLayout title="Department"><LoadingSpinner /></MainLayout>

  const rows = isEdit
    ? deptUsers.map(du => ({ key: du.id, uid: du.users?.user_id, name: du.users?.user_name, type: du.users?.user_type, onRemove: () => setRemoveTarget(du) }))
    : pendingUsers.map(u => ({ key: u.id, uid: u.user_id, name: u.user_name, type: u.user_type, onRemove: () => handleRemovePending(u.id) }))

  return (
    <MainLayout title={isEdit ? 'Edit Department' : 'New Department'}>
      <div className="mx-auto max-w-2xl space-y-6">
        {apiError && <ErrorBanner message={apiError} onClose={() => setApiError('')} />}

        <Card>
          <CardHeader><CardTitle>Department details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Department ID</Label>
              <Input value={deptId} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dname">Department name</Label>
              <Input id="dname" value={form.department_name} onChange={e => set('department_name', e.target.value)} placeholder="Department name" className={errClass('department_name')} />
              {errors.department_name && <p className="text-xs text-destructive">{errors.department_name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dloc">Location</Label>
              <Input id="dloc" value={form.department_location} onChange={e => set('department_location', e.target.value)} placeholder="City / location" className={errClass('department_location')} />
              {errors.department_location && <p className="text-xs text-destructive">{errors.department_location}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="daddr">Address</Label>
              <Input id="daddr" value={form.department_address} onChange={e => set('department_address', e.target.value)} placeholder="Full address" className={errClass('department_address')} />
              {errors.department_address && <p className="text-xs text-destructive">{errors.department_address}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dcur">Currency</Label>
              <Input id="dcur" value={form.currency} onChange={e => set('currency', e.target.value)} placeholder="e.g. LKR" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Department users</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowUserPicker(true)}><Plus className="h-4 w-4" /> Add user</Button>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No users added yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[110px]">ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-[70px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.key}>
                        <TableCell className="text-muted-foreground">{r.uid || '—'}</TableCell>
                        <TableCell className="font-medium text-foreground">{r.name || '—'}</TableCell>
                        <TableCell><Badge variant="muted" className="capitalize">{r.type || '—'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Remove" onClick={r.onRemove}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="px-8">{saving ? 'Saving…' : 'Save'}</Button>
          <Button variant="outline" onClick={() => navigate('/admin/departments')}>Cancel</Button>
        </div>

        {removeTarget && (
          <ConfirmModal
            title="Remove user?"
            confirmLabel="Remove"
            message={`Remove ${removeTarget.users?.user_name} from this department?`}
            onConfirm={handleRemoveSaved}
            onCancel={() => setRemoveTarget(null)}
          />
        )}

        <UserPickerModal open={showUserPicker} onSelect={handleSelectUser} onClose={() => setShowUserPicker(false)} excludeIds={allUserIds} />
      </div>
    </MainLayout>
  )
}
