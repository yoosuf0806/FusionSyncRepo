import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTES } from '../constants/roles'
import LoadingSpinner from './LoadingSpinner'

export default function RoleRoute({ children, allowedRoles }) {
  const { session, role, loading } = useAuth()

  if (loading) return <LoadingSpinner fullPage />
  if (!session) return <Navigate to="/" replace />

  if (allowedRoles && !allowedRoles.includes(role)) {
    const home = ROLE_HOME_ROUTES[role] || '/'
    return <Navigate to={home} replace />
  }

  return children
}
