// Single unified login page — no role selection needed.
// The system detects the user's role from their username/password automatically.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTES } from '../constants/roles'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase/client'
import { normalizeLoginEmail } from '../services/authService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ErrorBanner from '../components/ErrorBanner'

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

      // Step 1: Look up user by user_name (the login identifier).
      const lookupClient = adminClient || supabase
      const { data: matchedUsers, error: lookupErr } = await lookupClient
        .from('users')
        .select('id, user_name, is_active, auth_user_id')
        .ilike('user_name', username.trim())
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
    } catch {
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
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in to continue to your dashboard.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="e.g. Admin1"
            value={username}
            autoFocus
            onChange={e => { setUsername(e.target.value); setFieldErrors(p => ({ ...p, username: '' })); setError('') }}
            onKeyDown={handleKeyDown}
            className={fieldErrors.username ? 'border-destructive focus-visible:ring-destructive/30' : ''}
          />
          {fieldErrors.username && <p className="text-xs text-destructive">{fieldErrors.username}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); setError('') }}
            onKeyDown={handleKeyDown}
            className={fieldErrors.password ? 'border-destructive focus-visible:ring-destructive/30' : ''}
          />
          {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <Button onClick={handleLogin} disabled={loading} size="lg" className="w-full">
          {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>) : 'Sign In'}
        </Button>
      </div>
    </AuthLayout>
  )
}
