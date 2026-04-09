import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTES } from '../constants/roles'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner fullPage />

  if (!session) {
    // Redirect to root with session-expired flag in state
    return <Navigate to="/login" state={{ sessionExpired: true, from: location.pathname }} replace />
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const home = ROLE_HOME_ROUTES[role] || '/'
    return <Navigate to={home} replace />
  }

  return children
}
