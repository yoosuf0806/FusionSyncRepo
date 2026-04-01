import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import { sendPasswordResetEmail } from '../../services/authService'

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
      <h2 className="text-white text-lg font-medium">Reset Password</h2>

      {sent ? (
        <div className="flex flex-col items-center gap-4 w-full max-w-[280px]">
          <div className="bg-white/20 rounded-hh px-4 py-4 text-white text-sm text-center">
            <p className="font-medium mb-1">Request sent!</p>
            <p className="text-white/80 text-xs">
              If your account has a real email address configured, you will receive a reset link shortly.
              Otherwise, please contact your system administrator to reset your password.
            </p>
          </div>
          <button onClick={() => navigate('/')} className="text-white/70 text-xs hover:text-white transition-colors">
            ← Back to login
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full max-w-[280px]">
          <p className="text-white/80 text-xs text-center">
            Enter your username or email address. If your account is linked to a real email, a reset link will be sent.
            Otherwise, contact your administrator.
          </p>

          <input
            type="text"
            placeholder="Username or Email"
            value={identifier}
            onChange={e => { setIdentifier(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="w-full bg-white rounded-pill px-5 h-12 text-sm text-center outline-none placeholder-hh-placeholder text-hh-text border-2 border-transparent focus:border-hh-green transition-colors"
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-login disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-hh-text border-t-transparent rounded-full animate-spin" />
                Sending...
              </span>
            ) : 'Send Reset Link'}
          </button>

          {error && (
            <p className="text-hh-error text-xs text-center bg-red-50 rounded-hh px-3 py-2">{error}</p>
          )}

          <button onClick={() => navigate(-1)} className="text-white/70 text-xs hover:text-white transition-colors">
            ← Back to login
          </button>
        </div>
      )}
    </AuthLayout>
  )
}
