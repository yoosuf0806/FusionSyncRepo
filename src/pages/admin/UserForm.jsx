import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getUserById, createUser, updateUser, adminResetUserPassword } from '../../services/userService'
import { getDepartments } from '../../services/departmentService'
import { getJobSpecs } from '../../services/jobSpecService'
import FormRow from '../../components/FormRow'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'

const USER_TYPES = ['admin', 'supervisor', 'helper', 'helpee']
const ADMIN_ONLY_TYPES = ['admin', 'supervisor']

export default function UserForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    user_name: '', user_type: 'helper', user_email: '',
    user_phone: '', user_location: '', department_id: '', preferred_job_type_id: '',
    password: '',
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

  useEffect(() => {
    const loadDropdowns = async () => {
      const [depts, specs] = await Promise.all([
        getDepartments().catch(() => []),
        getJobSpecs().catch(() => []),
      ])
      setDepartments(depts)
      setJobSpecs(specs)
    }
    loadDropdowns()

    if (isEdit) {
      getUserById(id).then(user => {
        setForm({
          user_name: user.user_name || '',
          user_type: user.user_type || 'helper',
          user_email: user.user_email || '',
          user_phone: user.user_phone || '',
          user_location: user.user_location || '',
          department_id: user.department_id || '',
          preferred_job_type_id: user.preferred_job_type_id || '',
          password: '',
        })
        setUserId(user.user_id || 'Auto-generated')
        setLoading(false)
      }).catch(e => {
        setApiError(e.message)
        setLoading(false)
      })
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
    if (!form.department_id) e.department_id = 'Department is required'
    return e
  }

  const handleResetPassword = async () => {
    if (!resetPw || resetPw.length < 6) { setResetError('Password must be at least 6 characters'); return }
    setResetSaving(true)
    setResetError('')
    setResetSuccess(false)
    try {
      await adminResetUserPassword(id, resetPw)
      setResetSuccess(true)
      setResetPw('')
    } catch (err) {
      setResetError(err.message)
    } finally {
      setResetSaving(false)
    }
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSaving(true)
    setApiError('')
    try {
      if (isEdit) {
        await updateUser(id, form)
      } else {
        await createUser(form, form.password)
      }
      navigate('/admin/manage-users')
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = (field) =>
    `form-cell flex-1 w-full outline-none text-sm ${errors[field] ? 'border border-hh-error' : ''}`

  const showJobType = !ADMIN_ONLY_TYPES.includes(form.user_type)

  const allowedTypes = isAdmin ? USER_TYPES : ['helper', 'helpee']

  if (loading) return <MainLayout title={isEdit ? 'Edit User' : 'Add User'}><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title={form.user_type ? form.user_type.charAt(0).toUpperCase() + form.user_type.slice(1) : 'User'}>
      <div className="max-w-2xl mx-auto space-y-3">
        {apiError && <ErrorBanner message={apiError} onClose={() => setApiError('')} />}

        {/* User ID */}
        <FormRow label="User ID">
          <div className="form-cell flex-1 text-sm text-hh-placeholder">{userId}</div>
        </FormRow>

        {/* User Type */}
        <FormRow label="User Type">
          <select
            className={inputClass('user_type')}
            value={form.user_type}
            onChange={e => set('user_type', e.target.value)}
          >
            {allowedTypes.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </FormRow>

        {/* User Name */}
        <FormRow label="User Name">
          <input
            className={inputClass('user_name')}
            value={form.user_name}
            onChange={e => set('user_name', e.target.value)}
            placeholder="Full name"
          />
        </FormRow>
        {errors.user_name && <p className="text-hh-error text-xs ml-52">{errors.user_name}</p>}

        {/* Email */}
        <FormRow label="Contact Email">
          <input
            type="email"
            className={inputClass('user_email')}
            value={form.user_email}
            onChange={e => set('user_email', e.target.value)}
            placeholder="user@example.com (optional, for contact only)"
          />
        </FormRow>
        {errors.user_email && <p className="text-hh-error text-xs ml-52">{errors.user_email}</p>}
        <p className="text-hh-placeholder text-xs ml-52">
          Login uses username — this email is for contact records only.
        </p>

        {/* Password (create only) */}
        {!isEdit && (
          <>
            <FormRow label="Password">
              <input
                type="password"
                className={inputClass('password')}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Initial password (min 6 chars)"
              />
            </FormRow>
            {errors.password && <p className="text-hh-error text-xs ml-52">{errors.password}</p>}
          </>
        )}

        {/* User Phone */}
        <FormRow label="User Phone">
          <input
            className={inputClass('user_phone')}
            value={form.user_phone}
            onChange={e => set('user_phone', e.target.value)}
            placeholder="Phone number"
          />
        </FormRow>

        {/* Department */}
        <FormRow label="Department">
          <select
            className={inputClass('department_id')}
            value={form.department_id}
            onChange={e => set('department_id', e.target.value)}
          >
            <option value="">-- Select Department --</option>
            {departments.length === 0 ? (
              <option disabled>No departments</option>
            ) : (
              departments.map(d => (
                <option key={d.id} value={d.id}>{d.department_name}</option>
              ))
            )}
          </select>
        </FormRow>
        {errors.department_id && <p className="text-hh-error text-xs ml-52">{errors.department_id}</p>}

        {/* Location */}
        <FormRow label="User Location">
          <input
            className={inputClass('user_location')}
            value={form.user_location}
            onChange={e => set('user_location', e.target.value)}
            placeholder="City / Address"
          />
        </FormRow>

        {/* Preferred Job Type */}
        {showJobType && (
          <FormRow label="Preferred Job Type">
            <select
              className={inputClass('preferred_job_type_id')}
              value={form.preferred_job_type_id}
              onChange={e => set('preferred_job_type_id', e.target.value)}
            >
              <option value="">-- Select Job Type --</option>
              {jobSpecs.map(s => (
                <option key={s.id} value={s.id}>{s.job_type_name}</option>
              ))}
            </select>
          </FormRow>
        )}

        {/* Admin: Reset Password (edit mode only) */}
        {isEdit && isAdmin && (
          <div className="hh-card p-4 space-y-2 border border-orange-200 bg-orange-50">
            <p className="text-sm font-medium text-orange-800">Reset User Password</p>
            <div className="flex gap-2 items-center">
              <input
                type="password"
                className="form-cell flex-1 outline-none text-sm"
                placeholder="Enter new password (min 6 chars)"
                value={resetPw}
                onChange={e => { setResetPw(e.target.value); setResetError(''); setResetSuccess(false) }}
              />
              <button
                onClick={handleResetPassword}
                disabled={resetSaving}
                className="btn-action px-4 text-sm"
              >
                {resetSaving ? 'Resetting...' : 'Reset'}
              </button>
            </div>
            {resetError && <p className="text-hh-error text-xs">{resetError}</p>}
            {resetSuccess && <p className="text-green-700 text-xs font-medium">Password reset successfully!</p>}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-action px-8">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => navigate('/admin/manage-users')}
            className="btn-filter"
          >
            Cancel
          </button>
        </div>
      </div>
    </MainLayout>
  )
}
