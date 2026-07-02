// Legacy role-selection portal (unrouted — unified /login is the live entry).
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTES } from '../constants/roles'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

const ROLES = [
  { label: 'Helpee', path: '/login/helpee' },
  { label: 'Helper', path: '/login/helper' },
  { label: 'Supervisor', path: '/login/supervisor' },
  { label: 'Admin', path: '/login/admin' },
]

export default function UserSelection() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, role, loading } = useAuth()
  const sessionExpired = location.state?.sessionExpired === true

  useEffect(() => {
    if (!loading && session && role) navigate(ROLE_HOME_ROUTES[role], { replace: true })
  }, [session, role, loading, navigate])

  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        {sessionExpired && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Your session has expired. Please log in again.</AlertDescription></Alert>
        )}
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Select your role</h2>
          <p className="text-sm text-muted-foreground">Choose how you'd like to sign in.</p>
        </div>
        <div className="flex flex-col gap-3">
          {ROLES.map(r => (
            <Button key={r.path} variant="outline" size="lg" className="w-full" onClick={() => navigate(r.path)}>
              Login as {r.label}
            </Button>
          ))}
        </div>
      </div>
    </AuthLayout>
  )
}
