import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import {
  getDepartmentById, createDepartment, updateDepartment,
  addUserToDepartment, removeUserFromDepartment,
} from '../../services/departmentService'
import { getUsers } from '../../services/userService'
import FormRow from '../../components/FormRow'
import ConfirmModal from '../../components/ConfirmModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import SearchInput from '../../components/SearchInput'

const CUSTOMER_BASIS = ['One-time', 'Recurring', 'Corporate', 'All']
const PRICING_STRUCTURE = ['Quotation', 'Hourly', 'Daily basis']

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

/* ── Inline User Picker Modal ─────────────────────────────────── */
function UserPickerModal({ onSelect, onClose, excludeIds = [] }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsers({ search, userType: roleFilter }).then(data => {
      setUsers(data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [search, roleFilter])

  const roles = ['helper', 'helpee', 'supervisor']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-hh-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-base">Select User</h3>
          <button onClick={onClose} className="text-hh-placeholder hover:text-hh-text text-xl">✕</button>
        </div>

        <div className="p-4 flex gap-2 flex-wrap">
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or ID"
            className="flex-1 min-w-[200px]"
          />
          {roles.map(r => (
            <button key={r} onClick={() => setRoleFilter(prev => prev === r ? '' : r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors
                ${roleFilter === r ? 'bg-hh-green text-white' : 'bg-white border border-gray-200 text-hh-text hover:bg-gray-50'}`}>
              {r}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1">
          {loading ? (
            <p className="text-center text-sm text-hh-placeholder py-8">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-hh-placeholder py-8">No users found</p>
          ) : users.map(u => {
            const excluded = excludeIds.includes(u.id)
            return (
              <div key={u.id}
                className={`flex items-center justify-between p-3 rounded-hh border gap-3
                  ${excluded ? 'opacity-40 bg-gray-50' : 'bg-white hover:bg-green-50 cursor-pointer'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.user_name}</p>
                  <p className="text-xs text-hh-placeholder">{u.user_id} · <span className="capitalize">{u.user_type}</span></p>
                </div>
                <button
                  disabled={excluded}
                  onClick={() => !excluded && onSelect(u)}
                  className={`btn-select text-xs px-4 py-1.5 flex-shrink-0 ${excluded ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {excluded ? 'Added' : 'Select'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Main DepartmentForm ─────────────────────────────────────── */
export default function DepartmentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    department_name: '', department_location: '', department_address: '',
    currency: '', customer_basis: '', pricing_structure: '',
  })
  const [deptId, setDeptId] = useState('Auto-generated')
  // deptUsers = records already saved in DB (for edit mode)
  const [deptUsers, setDeptUsers] = useState([])
  // pendingUsers = users selected but not yet saved (for create mode)
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
        customer_basis: dept.customer_basis || '',
        pricing_structure: dept.pricing_structure || '',
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
    if (!form.department_name.trim()) e.department_name = 'Department Name is required'
    if (!form.department_location.trim()) e.department_location = 'Location is required'
    if (!form.department_address.trim()) e.department_address = 'Address is required'
    return e
  }

  // IDs of all users already in the dept (DB + pending) — used to disable in picker
  const allUserIds = [
    ...deptUsers.map(du => du.user_id),
    ...pendingUsers.map(u => u.id),
  ]

  const handleSelectUser = async (user) => {
    setShowUserPicker(false)
    setApiError('')

    if (isEdit) {
      // Edit mode — add to DB immediately, then refresh list
      try {
        await addUserToDepartment(id, user.id)
        const dept = await getDepartmentById(id)
        setDeptUsers(dept.department_users || [])
      } catch (e) {
        setApiError(e.message)
      }
    } else {
      // Create mode — add to pending list (saved after dept is created)
      setPendingUsers(prev => [...prev, user])
    }
  }

  const handleRemovePending = (userId) => {
    setPendingUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleRemoveSaved = async () => {
    try {
      await removeUserFromDepartment(removeTarget.id)
      setDeptUsers(prev => prev.filter(u => u.id !== removeTarget.id))
      setRemoveTarget(null)
    } catch (e) {
      setApiError(e.message)
      setRemoveTarget(null)
    }
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
        // Now add all pending users to the newly created department
        for (const user of pendingUsers) {
          await addUserToDepartment(newDept.id, user.id).catch(() => {})
        }
        setPendingUsers([])
      }
      navigate('/admin/departments')
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = (field) =>
    `form-cell flex-1 w-full outline-none text-sm ${errors[field] ? 'border border-hh-error' : ''}`

  if (loading) return <MainLayout title="Department"><LoadingSpinner /></MainLayout>

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
          <button onClick={() => setShowUserPicker(true)} className="btn-add mb-3" title="Add User">⊕</button>

          {/* Users already saved to DB (edit mode) */}
          {deptUsers.length > 0 && (
            <div className="space-y-2 mb-2">
              <div className="grid grid-cols-[110px_1fr_130px_80px] gap-2">
                {['ID', 'Name', 'Type', 'Action'].map(h => (
                  <div key={h} className="table-header rounded-hh-lg px-2 text-xs">{h}</div>
                ))}
              </div>
              {deptUsers.map(du => (
                <div key={du.id} className="grid grid-cols-[110px_1fr_130px_80px] gap-2 items-center">
                  <div className="table-row rounded-hh-lg px-2 text-xs">{du.users?.user_id || '—'}</div>
                  <div className="table-row rounded-hh-lg px-2 text-xs">{du.users?.user_name || '—'}</div>
                  <div className="table-row rounded-hh-lg px-2 text-xs capitalize">{du.users?.user_type || '—'}</div>
                  <div className="table-row rounded-hh-lg px-2 gap-1">
                    <button onClick={() => setRemoveTarget(du)} className="btn-icon w-8 h-8 hover:text-hh-error" title="Remove">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending users (create mode — not yet in DB) */}
          {pendingUsers.length > 0 && (
            <div className="space-y-2">
              {deptUsers.length === 0 && (
                <div className="grid grid-cols-[110px_1fr_130px_80px] gap-2">
                  {['ID', 'Name', 'Type', 'Action'].map(h => (
                    <div key={h} className="table-header rounded-hh-lg px-2 text-xs">{h}</div>
                  ))}
                </div>
              )}
              {pendingUsers.map(u => (
                <div key={u.id} className="grid grid-cols-[110px_1fr_130px_80px] gap-2 items-center">
                  <div className="table-row rounded-hh-lg px-2 text-xs">{u.user_id || '—'}</div>
                  <div className="table-row rounded-hh-lg px-2 text-xs">{u.user_name}</div>
                  <div className="table-row rounded-hh-lg px-2 text-xs capitalize">{u.user_type}</div>
                  <div className="table-row rounded-hh-lg px-2 gap-1">
                    <button onClick={() => handleRemovePending(u.id)} className="btn-icon w-8 h-8 hover:text-hh-error" title="Remove">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {deptUsers.length === 0 && pendingUsers.length === 0 && (
            <p className="text-sm text-hh-placeholder">No users added yet. Click ⊕ to add users.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-action px-8">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => navigate('/admin/departments')} className="btn-filter">Cancel</button>
        </div>

        {/* Confirm remove saved user */}
        {removeTarget && (
          <ConfirmModal
            message={`Remove ${removeTarget.users?.user_name} from this department?`}
            onConfirm={handleRemoveSaved}
            onCancel={() => setRemoveTarget(null)}
          />
        )}

        {/* Inline User Picker Modal */}
        {showUserPicker && (
          <UserPickerModal
            onSelect={handleSelectUser}
            onClose={() => setShowUserPicker(false)}
            excludeIds={allUserIds}
          />
        )}
      </div>
    </MainLayout>
  )
}
