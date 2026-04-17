// Single unified login page — no role selection needed.
// The system detects the user's role from their username/password automatically.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTES } from '../constants/roles'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase/client'
import { normalizeLoginEmail } from '../services/authService'

// Service-role client for username lookup (anon RLS can't query all users)
const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const _url     = import.meta.env.VITE_SUPABASE_URL
const adminClient = (_svcKey && _svcKey.startsWith('eyJ'))
  ? createClient(_url, _svcKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const navigate = useNavigate()
  const { session: existingSession, role: existingRole, loading: authLoading } = useAuth()

  // Already logged in → redirect to role home
  useEffect(() => {
    if (!authLoading && existingSession && existingRole) {
      navigate(ROLE_HOME_ROUTES[existingRole], { replace: true })
    }
  }, [existingSession, existingRole, authLoading, navigate])

  async function handleLogin() {
    setError('')
    setFieldErrors({})

    const errs = {}
    if (!username.trim()) errs.username = 'Required'
    if (!password.trim()) errs.password = 'Required'
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    setLoading(true)
    try {
      const loginEmail = normalizeLoginEmail(username.trim())

      // Step 1: Look up user by 'username' field first, fall back to 'user_name'.
      // Existing accounts may have username = NULL if the column was added after account creation.
      const lookupClient = adminClient || supabase
      const { data: matchedUsers, error: lookupErr } = await lookupClient
        .from('users')
        .select('id, user_name, username, is_active, auth_user_id')
        .or(`username.ilike.${username.trim()},user_name.ilike.${username.trim()}`)
        .limit(1)

      if (lookupErr || !matchedUsers || matchedUsers.length === 0) {
        setPassword('')
        setError('Wrong username — no account found. Please check your username and try again.')
        return
      }

      const matchedUser = matchedUsers[0]

      if (!matchedUser.is_active) {
        setPassword('')
        setError('This account has been deactivated. Please contact your administrator.')
        return
      }

      // Step 2: Get the actual current auth email via adminClient.
      // This is critical — Supabase "Secure email change" can leave a pending new_email
      // that hasn't been confirmed yet, meaning the stored auth email may differ from
      // what normalizeLoginEmail() would derive from the current username.
      let authEmail = loginEmail // fallback
      if (adminClient && matchedUser.auth_user_id) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(matchedUser.auth_user_id)
        if (authUser?.user?.email) {
          authEmail = authUser.user.email
        }
      }

      // Step 3: Attempt sign in with the real current auth email
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      })

      if (signInError) {
        setPassword('')
        // Distinguish between wrong username and wrong password
        if (signInError.message?.toLowerCase().includes('invalid login') ||
            signInError.message?.toLowerCase().includes('invalid credentials')) {
          setError('Incorrect password. Please try again.')
        } else {
          setError(signInError.message || 'Login failed. Please try again.')
        }
        return
      }

      // AuthContext picks up the session change and sets the role → redirect via useEffect
    } catch (err) {
      setPassword('')
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <AuthLayout>
      <h2 className="text-white text-lg font-medium">Login</h2>

      <div className="flex flex-col gap-4 w-full max-w-[280px]">
        {/* Username */}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => { setUsername(e.target.value); setFieldErrors(p => ({ ...p, username: '' })); setError('') }}
          onKeyDown={handleKeyDown}
          className={`
            w-full bg-white rounded-pill px-5 h-12 text-sm text-center outline-none
            placeholder-hh-placeholder text-hh-text
            ${fieldErrors.username ? 'border-2 border-hh-error' : 'border-2 border-transparent'}
            focus:border-hh-green transition-colors
          `}
        />

        {/* Password */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); setError('') }}
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
            <span className="flex items-center gap-2 justify-center">
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
    </AuthLayout>
  )
}
