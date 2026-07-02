import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import AuthLayout from '../../layouts/AuthLayout'
import { supabase } from '../../../supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import ErrorBanner from '../../components/ErrorBanner'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ newPw: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
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

  return (
    <AuthLayout>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Set a new password</h2>
        <p className="text-sm text-muted-foreground">Choose a strong password you'll remember.</p>
      </div>

      {success ? (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <span className="font-semibold">Password updated.</span> Redirecting to login…
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          {apiError && <ErrorBanner message={apiError} onClose={() => setApiError('')} />}

          {ready && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPw">New password</Label>
                <Input
                  id="newPw" type="password" placeholder="Minimum 6 characters"
                  value={form.newPw}
                  onChange={e => { setForm(p => ({ ...p, newPw: e.target.value })); setErrors(p => ({ ...p, newPw: '' })) }}
                  className={errors.newPw ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                />
                {errors.newPw && <p className="text-xs text-destructive">{errors.newPw}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm" type="password" placeholder="Repeat new password"
                  value={form.confirm}
                  onChange={e => { setForm(p => ({ ...p, confirm: e.target.value })); setErrors(p => ({ ...p, confirm: '' })) }}
                  className={errors.confirm ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                />
                {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
              </div>

              <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
                {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>) : 'Set new password'}
              </Button>
            </>
          )}

          <Button variant="ghost" onClick={() => navigate('/')} className="self-start">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
