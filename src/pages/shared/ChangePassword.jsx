import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { changeCurrentUserPassword } from '../../services/authService'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

  return (
    <MainLayout title="Change Password">
      <div className="max-w-lg mx-auto space-y-4">

        {apiError && <ErrorBanner message={apiError} onClose={() => setApiError('')} />}

        {success && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Password changed successfully.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPw">New password</Label>
              <Input
                id="newPw" type="password" value={form.newPw}
                onChange={e => set('newPw', e.target.value)}
                placeholder="Minimum 6 characters"
                className={errors.newPw ? 'border-destructive focus-visible:ring-destructive/30' : ''}
              />
              {errors.newPw && <p className="text-xs text-destructive">{errors.newPw}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm" type="password" value={form.confirm}
                onChange={e => set('confirm', e.target.value)}
                placeholder="Repeat new password"
                className={errors.confirm ? 'border-destructive focus-visible:ring-destructive/30' : ''}
              />
              {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
            </div>

            <div className="flex gap-3 pt-1">
              <Button onClick={handleSave} disabled={saving} className="px-8">
                {saving ? 'Saving…' : 'Change password'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/profile')}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
