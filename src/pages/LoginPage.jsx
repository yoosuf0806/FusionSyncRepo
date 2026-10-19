// Single unified login page — no role selection needed.
// The system detects the user's role from their username/password automatically.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTES } from '../constants/roles'
import { supabase } from '../../supabase/client'
import { normalizeLoginEmail } from '../services/authService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ErrorBanner from '../components/ErrorBanner'

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

      // Step 1: Resolve the account via a SECURITY DEFINER RPC. This runs the
      // privileged lookup server-side, so the login page needs no service-role
      // key in the browser (which was both a reliability trap — a missing key
      // broke every login with "no account found" — and a security hole).
      const { data: rows, error: lookupErr } = await supabase
        .rpc('resolve_login_identity', { p_identifier: username.trim() })
      const identity = Array.isArray(rows) ? rows[0] : rows

      if (lookupErr || !identity || !identity.found) {
        setPassword('')
        setError('Wrong username — no account found. Please check your username and try again.')
        return
      }

      if (!identity.is_active) {
        setPassword('')
        setError('This account has been deactivated. Please contact your administrator.')
        return
      }

      // Step 2: Prefer the real current auth email returned by the resolver.
      // Supabase "Secure email change" can leave a pending new_email that isn't
      // confirmed yet, so the stored auth email may differ from the one
      // normalizeLoginEmail() derives from the username. Fall back to the
      // derived email if the resolver couldn't read one.
      const authEmail = identity.login_email || loginEmail

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
