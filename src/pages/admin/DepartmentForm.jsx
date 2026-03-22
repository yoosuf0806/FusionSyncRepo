import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import {
  getDepartmentById, createDepartment, updateDepartment,
  addUserToDepartment, removeUserFromDepartment,
} from '../../services/departmentService'
import FormRow from '../../components/FormRow'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'

const CUSTOMER_BASIS = ['One-time', 'Recurring', 'Corporate', 'All']
const PRICING_STRUCTURE = ['Quotation', 'Hourly', 'Daily basis']

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

export default function DepartmentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    department_name: '', department_location: '', department_address: '',
    currency: '', customer_basis: '', pricing_structure: '',
  })
  const [deptId, setDeptId] = useState('Auto-generated')
  const [deptUsers, setDeptUsers] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  const [savedDeptId, setSavedDeptId] = useState(null)

  // Load dept for edit mode
  useEffect(() => {
    if (!isEdit) return
    getDepartmentById(id).then(dept => {
      setForm({
        department_name: dept.department_name || '',
        department_location: dept.department_location || '',
        department_address: dept.department_address || '',
        currency: dept.currency || '',
        customer_basis: dept.customer_basis || '',
        pricing_structure: dept.pricing_structure || '',
      })
      setDeptId(dept.department_id || 'Auto-generated')
      setDeptUsers(dept.department_users || [])
      setSavedDeptId(dept.id)
      setLoading(false)
    }).catch(e => { setApiError(e.message); setLoading(false) })
  }, [id, isEdit])

  // After return from search page, add the selected user
  useEffect(() => {
    const userId = searchParams.get('addUser')
    const targetId = savedDeptId || id
    if (!userId || !targetId) return
    addUserToDepartment(targetId, userId).then(() => {
      getDepartmentById(targetId).then(dept => setDeptUsers(dept.department_users || []))
    }).catch(e => setApiError(e.message))
    // Remove the query param so it doesn't re-trigger
    navigate(window.location.pathname, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.department_name.trim()) e.department_name = 'Department Name is required'
    if (!form.department_location.trim()) e.department_location = 'Location is required'
    if (!form.department_address.trim()) e.department_address = 'Address is required'
    return e
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
        setSavedDeptId(newDept.id)
      }
      navigate('/admin/departments')
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveUser = async () => {
    try {
      await removeUserFromDepartment(removeTarget.id)
      setDeptUsers(prev => prev.filter(u => u.id !== removeTarget.id))
      setRemoveTarget(null)
    } catch (e) {
      setApiError(e.message)
      setRemoveTarget(null)
    }
  }

  const inputClass = (field) =>
    `form-cell flex-1 w-full outline-none text-sm ${errors[field] ? 'border border-hh-error' : ''}`

  if (loading) return <MainLayout title="Department"><LoadingSpinner /></MainLayout>

  const currentId = isEdit ? id : savedDeptId
  const searchReturnUrl = currentId
    ? `/admin/departments/${currentId}/edit`
    : '/admin/departments/new'

  return (
    <MainLayout title="Department">
      <div className="max-w-2xl mx-auto space-y-6">
        {apiError && <ErrorBanner message={apiError} onClose={() => setApiError('')} />}

        {/* Department Details */}
        <div>
          <h2 className="text-base font-semibold mb-3">Department Details</h2>
          <div className="space-y-2">
            <FormRow label="Department ID" labelWidth="w-48">
              <div className="form-cell flex-1 text-sm text-hh-placeholder">{deptId}</div>
            </FormRow>
            <FormRow label="Department Name" labelWidth="w-48">
              <input className={inputClass('department_name')} value={form.department_name}
                onChange={e => set('department_name', e.target.value)} placeholder="Department Name" />
            </FormRow>
            {errors.department_name && <p className="text-hh-error text-xs">{errors.department_name}</p>}
            <FormRow label="Location" labelWidth="w-48">
              <input className={inputClass('department_location')} value={form.department_location}
                onChange={e => set('department_location', e.target.value)} placeholder="City / Location" />
            </FormRow>
            {errors.department_location && <p className="text-hh-error text-xs">{errors.department_location}</p>}
            <FormRow label="Address" labelWidth="w-48">
              <input className={inputClass('department_address')} value={form.department_address}
                onChange={e => set('department_address', e.target.value)} placeholder="Full Address" />
            </FormRow>
            {errors.department_address && <p className="text-hh-error text-xs">{errors.department_address}</p>}
            <FormRow label="Currency" labelWidth="w-48">
              <input className={inputClass('currency')} value={form.currency}
                onChange={e => set('currency', e.target.value)} placeholder="e.g. AUD" />
            </FormRow>
            <FormRow label="Customer Basis" labelWidth="w-48">
              <select className={inputClass('customer_basis')} value={form.customer_basis}
                onChange={e => set('customer_basis', e.target.value)}>
                <option value="">-- Select --</option>
                {CUSTOMER_BASIS.map(b => <option key={b} value={b.toLowerCase().replace(' ', '_')}>{b}</option>)}
              </select>
            </FormRow>
            <FormRow label="Pricing Structure" labelWidth="w-48">
              <select className={inputClass('pricing_structure')} value={form.pricing_structure}
                onChange={e => set('pricing_structure', e.target.value)}>
                <option value="">-- Select --</option>
                {PRICING_STRUCTURE.map(p => <option key={p} value={p.toLowerCase().replace(/\s+/g, '_')}>{p}</option>)}
              </select>
            </FormRow>
          </div>
        </div>

        {/* Department Users */}
        <div>
          <h2 className="text-base font-semibold mb-3">Department Users</h2>
          <button
            onClick={() => navigate(`/admin/search-users/dept?returnTo=${encodeURIComponent(searchReturnUrl)}`)}
            className="btn-add mb-3"
            title="Add User"
          >
            ⊕
          </button>

          {deptUsers.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-[110px_1fr_140px_100px] gap-2">
                {['ID', 'Name', 'Type', 'Action'].map(h => (
                  <div key={h} className="table-header rounded-hh-lg px-2 text-xs">{h}</div>
                ))}
              </div>
              {deptUsers.map(du => (
                <div key={du.id} className="grid grid-cols-[110px_1fr_140px_100px] gap-2">
                  <div className="table-row rounded-hh-lg px-2 text-xs">{du.users?.user_id || '—'}</div>
                  <div className="table-row rounded-hh-lg px-2 text-xs">{du.users?.user_name || '—'}</div>
                  <div className="table-row rounded-hh-lg px-2 text-xs capitalize">{du.users?.user_type || '—'}</div>
                  <div className="table-row rounded-hh-lg px-2 gap-1">
                    <button onClick={() => setRemoveTarget(du)} className="btn-icon w-8 h-8 hover:text-hh-error" title="Remove"><TrashIcon /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-action px-8">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => navigate('/admin/departments')} className="btn-filter">Cancel</button>
        </div>

        {removeTarget && (
          <ConfirmModal
            message={`Remove ${removeTarget.users?.user_name} from this department?`}
            onConfirm={handleRemoveUser}
            onCancel={() => setRemoveTarget(null)}
          />
        )}
      </div>
    </MainLayout>
  )
}
