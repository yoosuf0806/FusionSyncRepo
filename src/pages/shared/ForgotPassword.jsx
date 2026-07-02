import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react'
import AuthLayout from '../../layouts/AuthLayout'
import { sendPasswordResetEmail } from '../../services/authService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import ErrorBanner from '../../components/ErrorBanner'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!identifier.trim()) { setError('Please enter your username or email'); return }
    setLoading(true)
    setError('')
    try {
      await sendPasswordResetEmail(identifier.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Reset password</h2>
        <p className="text-sm text-muted-foreground">We'll send a reset link if your account has an email.</p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-4">
          <Alert variant="success">
            <MailCheck className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">Request sent.</span> If your account has a real email address,
              you'll receive a reset link shortly. Otherwise, contact your administrator.
            </AlertDescription>
          </Alert>
          <Button variant="ghost" onClick={() => navigate('/login')} className="self-start">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identifier">Username or email</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="e.g. Admin1"
              value={identifier}
              autoFocus
              onChange={e => { setIdentifier(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && <ErrorBanner message={error} onClose={() => setError('')} />}

          <Button onClick={handleSubmit} disabled={loading} size="lg" className="w-full">
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : 'Send reset link'}
          </Button>

          <Button variant="ghost" onClick={() => navigate('/login')} className="self-start">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
