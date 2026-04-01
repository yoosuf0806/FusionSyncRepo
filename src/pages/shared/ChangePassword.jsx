import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { changeCurrentUserPassword } from '../../services/authService'
import FormRow from '../../components/FormRow'
import ErrorBanner from '../../components/ErrorBanner'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
    setApiError('')
    setSuccess(false)
  }

  const validate = () => {
    const e = {}
    if (!form.newPw) e.newPw = 'New password is required'
    else if (form.newPw.length < 6) e.newPw = 'Password must be at least 6 characters'
    if (!form.confirm) e.confirm = 'Please confirm your new password'
    else if (form.newPw !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSaving(true)
    setApiError('')
    try {
      await changeCurrentUserPassword(form.newPw)
      setSuccess(true)
      setForm({ current: '', newPw: '', confirm: '' })
    } catch (err) {
      setApiError(err.message || 'Failed to change password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = (field) =>
    `form-cell flex-1 w-full outline-none text-sm ${errors[field] ? 'border border-hh-error' : ''}`

  return (
    <MainLayout title="Change Password">
      <div className="max-w-xl mx-auto space-y-4">

        {apiError && <ErrorBanner message={apiError} onClose={() => setApiError('')} />}

        {success && (
          <div className="bg-hh-green text-white rounded-hh px-4 py-3 text-sm font-medium">
            Password changed successfully!
          </div>
        )}

        <div className="hh-card p-6 space-y-3">
          <h2 className="text-base font-semibold mb-4">Set New Password</h2>

          <FormRow label="New Password" labelWidth="w-44">
            <input
              type="password"
              className={inputClass('newPw')}
              value={form.newPw}
              onChange={e => set('newPw', e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </FormRow>
          {errors.newPw && <p className="text-hh-error text-xs ml-48">{errors.newPw}</p>}

          <FormRow label="Confirm Password" labelWidth="w-44">
            <input
              type="password"
              className={inputClass('confirm')}
              value={form.confirm}
              onChange={e => set('confirm', e.target.value)}
              placeholder="Repeat new password"
            />
          </FormRow>
          {errors.confirm && <p className="text-hh-error text-xs ml-48">{errors.confirm}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-action px-8">
              {saving ? 'Saving...' : 'Change Password'}
            </button>
            <button onClick={() => navigate('/profile')} className="btn-filter">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
