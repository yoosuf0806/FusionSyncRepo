// Page 1 — User Selection / Role Selection Portal
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_HOME_ROUTES } from '../constants/roles'

export default function UserSelection() {
  const navigate = useNavigate()
  const { session, role, loading } = useAuth()

  // If already logged in, redirect to role's home
  useEffect(() => {
    if (!loading && session && role) {
      navigate(ROLE_HOME_ROUTES[role], { replace: true })
    }
  }, [session, role, loading, navigate])

  return (
    <AuthLayout>
      {/* Prompt text */}
      <p className="text-white text-base font-medium tracking-wide">
        Select your user type
      </p>

      {/* Role buttons */}
      <div className="flex flex-col gap-4 w-full max-w-[260px]">
        <button
          onClick={() => navigate('/login/helper')}
          className="btn-login"
        >
          Login as Helper
        </button>

        <button
          onClick={() => navigate('/login/supervisor')}
          className="btn-login"
        >
          Login as Supervisor
        </button>

        <button
          onClick={() => navigate('/login/admin')}
          className="btn-login"
        >
          Login as Admin
        </button>
      </div>
    </AuthLayout>
  )
}
