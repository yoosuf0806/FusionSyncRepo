// Pages 2–5 — Login pages for Admin, Supervisor, Helper, Helpee
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { loginUser } from '../services/authService'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTES } from '../constants/roles'

const ROLE_TITLES = {
  admin:      'Admin Login',
  supervisor: 'Supervisor Login',
  helper:     'Helper Login',
  helpee:     'Helpee Login',
}

export default function LoginPage({ role }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const navigate = useNavigate()
  const { session: existingSession, role: existingRole, loading: authLoading } = useAuth()

  // Already logged in — redirect
  useEffect(() => {
    if (!authLoading && existingSession && existingRole) {
      navigate(ROLE_HOME_ROUTES[existingRole], { replace: true })
    }
  }, [existingSession, existingRole, authLoading, navigate])

  async function handleLogin() {
    setError('')
    setFieldErrors({})

    // Validate required fields
    const errs = {}
    if (!email.trim())    errs.email    = 'Required'
    if (!password.trim()) errs.password = 'Required'
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      await loginUser(email.trim(), password)
      // AuthContext will detect the session change and set the role.
      // After sign-in, check that the signed-in user has the correct role.
      // The redirect happens via useEffect above once role is set.
    } catch (err) {
      setPassword('')
      setError('Username or password is incorrect')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <AuthLayout>
      {/* Title */}
      <h2 className="text-white text-lg font-medium">
        {ROLE_TITLES[role]}
      </h2>

      {/* Form fields */}
      <div className="flex flex-col gap-4 w-full max-w-[280px]">
        {/* Email / Username */}
        <input
          type="text"
          placeholder="Username or Email"
          value={email}
          onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({...p, email: ''})) }}
          onKeyDown={handleKeyDown}
          className={`
            w-full bg-white rounded-pill px-5 h-12 text-sm text-center outline-none
            placeholder-hh-placeholder text-hh-text
            ${fieldErrors.email ? 'border-2 border-hh-error' : 'border-2 border-transparent'}
            focus:border-hh-green transition-colors
          `}
        />

        {/* Password */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({...p, password: ''})) }}
          onKeyDown={handleKeyDown}
          className={`
            w-full bg-white rounded-pill px-5 h-12 text-sm text-center outline-none
            placeholder-hh-placeholder text-hh-text
            ${fieldErrors.password ? 'border-2 border-hh-error' : 'border-2 border-transparent'}
            focus:border-hh-green transition-colors
          `}
        />

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="btn-login disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-hh-text border-t-transparent rounded-full animate-spin" />
              Logging in...
            </span>
          ) : 'Login'}
        </button>

        {/* Error message */}
        {error && (
          <p className="text-hh-error text-xs text-center bg-red-50 rounded-hh px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Forgot password */}
      <button
        onClick={() => navigate('/forgot-password')}
        className="text-white/70 text-xs hover:text-white transition-colors"
      >
        Forgot password?
      </button>

      {/* Back link — not shown on helpee page */}
      {role !== 'helpee' && (
        <button
          onClick={() => navigate('/')}
          className="text-white/70 text-xs hover:text-white transition-colors mt-1"
        >
          ← Back to role selection
        </button>
      )}
    </AuthLayout>
  )
}
