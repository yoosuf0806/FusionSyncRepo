import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import { supabase } from '../../../supabase/client'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ newPw: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase sends access_token in the URL hash — exchange it for a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setApiError('Invalid or expired reset link. Please request a new one.')
    })
  }, [])

  const validate = () => {
    const e = {}
    if (!form.newPw) e.newPw = 'New password is required'
    else if (form.newPw.length < 6) e.newPw = 'Password must be at least 6 characters'
    if (!form.confirm) e.confirm = 'Please confirm your password'
    else if (form.newPw !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    setApiError('')
    try {
      const { error } = await supabase.auth.updateUser({ password: form.newPw })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setApiError(err.message || 'Failed to reset password.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = (field) =>
    `w-full bg-white rounded-pill px-5 h-12 text-sm text-center outline-none placeholder-hh-placeholder text-hh-text border-2 transition-colors ${errors[field] ? 'border-hh-error' : 'border-transparent focus:border-hh-green'}`

  return (
    <AuthLayout>
      <h2 className="text-white text-lg font-medium">Set New Password</h2>

      {success ? (
        <div className="bg-white/20 rounded-hh px-4 py-4 text-white text-sm text-center">
          <p className="font-medium">Password updated successfully!</p>
          <p className="text-white/80 text-xs mt-1">Redirecting to login...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full max-w-[280px]">
          {apiError && (
            <p className="text-hh-error text-xs text-center bg-red-50 rounded-hh px-3 py-2">{apiError}</p>
          )}

          {ready && (
            <>
              <input
                type="password"
                placeholder="New Password (min 6 chars)"
                value={form.newPw}
                onChange={e => { setForm(p => ({ ...p, newPw: e.target.value })); setErrors(p => ({ ...p, newPw: '' })) }}
                className={inputClass('newPw')}
              />
              {errors.newPw && <p className="text-white/90 text-xs text-center">{errors.newPw}</p>}

              <input
                type="password"
                placeholder="Confirm New Password"
                value={form.confirm}
                onChange={e => { setForm(p => ({ ...p, confirm: e.target.value })); setErrors(p => ({ ...p, confirm: '' })) }}
                className={inputClass('confirm')}
              />
              {errors.confirm && <p className="text-white/90 text-xs text-center">{errors.confirm}</p>}

              <button onClick={handleSave} disabled={saving} className="btn-login disabled:opacity-60">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-hh-text border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : 'Set New Password'}
              </button>
            </>
          )}

          <button onClick={() => navigate('/')} className="text-white/70 text-xs hover:text-white transition-colors">
            ← Back to login
          </button>
        </div>
      )}
    </AuthLayout>
  )
}
