import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { KeyRound, CheckCircle2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { usersHubPath } from '../../constants/jobPaths'
import { getUserById, createUser, updateUser, adminResetUserPassword, getUserJobTypes, saveUserJobTypes } from '../../services/userService'
import { getDepartments } from '../../services/departmentService'
import { getJobSpecs } from '../../services/jobSpecService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const USER_TYPES = ['admin', 'supervisor', 'helper', 'helpee']
const ADMIN_ONLY_TYPES = ['admin', 'supervisor']
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

export default function UserForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { isAdmin, role } = useAuth()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    user_name: '', user_type: 'helper', user_email: '',
    user_phone: '', user_location: '', department_id: '', preferred_job_type_id: '', password: '',
  })
  const [userId, setUserId] = useState('Auto-generated')
  const [departments, setDepartments] = useState([])
  const [jobSpecs, setJobSpecs] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [resetPw, setResetPw] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState('')
  const [selectedJobTypeIds, setSelectedJobTypeIds] = useState([])

  useEffect(() => {
    const loadDropdowns = async () => {
      const [depts, specs] = await Promise.all([getDepartments().catch(() => []), getJobSpecs().catch(() => [])])
      setDepartments(depts); setJobSpecs(specs)
    }
    loadDropdowns()
    if (isEdit) {
      getUserById(id).then(user => {
        setForm({
          user_name: user.user_name || '', user_type: user.user_type || 'helper',
          user_email: user.user_email || '', user_phone: user.user_phone || '',
          user_location: user.user_location || '', department_id: user.department_id || '',
          preferred_job_type_id: user.preferred_job_type_id || '', password: '',
        })
        setUserId(user.user_id || 'Auto-generated')
        getUserJobTypes(id).then(ids => setSelectedJobTypeIds(ids)).catch(() => {})
        setLoading(false)
      }).catch(e => { setApiError(e.message); setLoading(false) })
    }
  }, [id, isEdit])

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
    if (apiError) setApiError('')
  }

  const validate = () => {
    const e = {}
    if (!form.user_name.trim()) e.user_name = 'Name is required'
    if (form.user_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.user_email)) e.user_email = 'Enter a valid email address'
    if (!isEdit && !form.password) e.password = 'Password is required for new users'
    if (!isEdit && form.password && form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (['helper', 'supervisor'].includes(form.user_type) && !form.department_id) e.department_id = 'Department is required'
    return e
  }

  const handleResetPassword = async () => {
    if (!resetPw || resetPw.length < 6) { setResetError('Password must be at least 6 characters'); return }
    setResetSaving(true); setResetError(''); setResetSuccess(false)
    try {
      await adminResetUserPassword(id, resetPw)
      setResetSuccess(true); setResetPw('')
    } catch (err) { setResetError(err.message) } finally { setResetSaving(false) }
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true); setApiError('')
    try {
      const payload = { ...form, department_id: showDepartment ? (form.department_id || null) : null }
      let savedUserId = id
      if (isEdit) await updateUser(id, payload)
      else { const newUser = await createUser(payload, form.password); savedUserId = newUser.id }
      if (showJobType && selectedJobTypeIds.length >= 0) {
        await saveUserJobTypes(savedUserId, selectedJobTypeIds).catch(e => console.warn('saveUserJobTypes:', e.message))
      }
      navigate(usersHubPath(role))
    } catch (err) { setApiError(err.message) } finally { setSaving(false) }
  }

  const errClass = (field) => errors[field] ? 'border-destructive focus-visible:ring-destructive/30' : ''
  const showJobType = !ADMIN_ONLY_TYPES.includes(form.user_type)
  const showDepartment = ['helper', 'supervisor'].includes(form.user_type)
  const allowedTypes = isAdmin ? USER_TYPES : ['helper', 'helpee']

  if (loading) return <MainLayout title={isEdit ? 'Edit User' : 'Add User'}><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title={isEdit ? `Edit ${cap(form.user_type)}` : 'New User'}>
      <div className="mx-auto max-w-2xl space-y-6">
        {apiError && <ErrorBanner message={apiError} onClose={() => setApiError('')} />}

        <Card>
          <CardHeader><CardTitle>User details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>User ID</Label>
                <Input value={userId} disabled />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>User type</Label>
                <Select value={form.user_type} onValueChange={v => set('user_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedTypes.map(t => <SelectItem key={t} value={t}>{cap(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="uname">User name</Label>
              <Input id="uname" value={form.user_name} onChange={e => set('user_name', e.target.value)} placeholder="Full name" className={errClass('user_name')} />
              {errors.user_name && <p className="text-xs text-destructive">{errors.user_name}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="uemail">Contact email</Label>
              <Input id="uemail" type="email" value={form.user_email} onChange={e => set('user_email', e.target.value)} placeholder="user@example.com (optional)" className={errClass('user_email')} />
              {errors.user_email && <p className="text-xs text-destructive">{errors.user_email}</p>}
              <p className="text-xs text-muted-foreground">For contact records only — not used for login.</p>
            </div>

            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="upw">Password</Label>
                <Input id="upw" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Initial password (min 6 chars)" className={errClass('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="uphone">Phone</Label>
                <Input id="uphone" value={form.user_phone} onChange={e => set('user_phone', e.target.value)} placeholder="Phone number" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="uloc">Location</Label>
                <Input id="uloc" value={form.user_location} onChange={e => set('user_location', e.target.value)} placeholder="City / address" />
              </div>
            </div>

            {showDepartment && (
              <div className="flex flex-col gap-1.5">
                <Label>Department</Label>
                <Select value={form.department_id || undefined} onValueChange={v => set('department_id', v)}>
                  <SelectTrigger className={errClass('department_id')}><SelectValue placeholder="-- Select department --" /></SelectTrigger>
                  <SelectContent>
                    {departments.length === 0
                      ? <SelectItem value="none" disabled>No departments</SelectItem>
                      : departments.map(d => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.department_id && <p className="text-xs text-destructive">{errors.department_id}</p>}
              </div>
            )}

            {showJobType && jobSpecs.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Job type(s)</Label>
                <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
                  {jobSpecs.map(s => {
                    const checked = selectedJobTypeIds.includes(s.id)
                    return (
                      <label key={s.id} className="flex cursor-pointer select-none items-center gap-2">
                        <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked}
                          onChange={() => setSelectedJobTypeIds(prev => checked ? prev.filter(x => x !== s.id) : [...prev, s.id])} />
                        <span className="text-sm text-foreground">{s.job_type_name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isEdit && isAdmin && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-warning" /> Reset user password</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input type="password" placeholder="New password (min 6 chars)" value={resetPw}
                  onChange={e => { setResetPw(e.target.value); setResetError(''); setResetSuccess(false) }} />
                <Button onClick={handleResetPassword} disabled={resetSaving}>{resetSaving ? 'Resetting…' : 'Reset'}</Button>
              </div>
              {resetError && <p className="text-xs text-destructive">{resetError}</p>}
              {resetSuccess && (
                <Alert variant="success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>Password reset successfully.</AlertDescription></Alert>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="px-8">{saving ? 'Saving…' : 'Save'}</Button>
          <Button variant="outline" onClick={() => navigate(usersHubPath(role))}>Cancel</Button>
        </div>
      </div>
    </MainLayout>
  )
}
