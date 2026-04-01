import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getUserById } from '../../services/userService'
import FormRow from '../../components/FormRow'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'

export default function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  // user from context IS the DB user record (includes departments + job_specifications joins)
  const { user: authUser, isAdmin, isSupervisor } = useAuth()
  const isOwnProfile = !id
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        if (id && (isAdmin || isSupervisor)) {
          // Admin/Supervisor viewing a specific user by DB id param
          const data = await getUserById(id)
          setProfile(data)
        } else if (authUser) {
          // Any user viewing their own profile — already in context
          setProfile(authUser)
          setLoading(false)
          return
        }
      } catch (e) {
        setError('Unable to load profile')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, authUser, isAdmin, isSupervisor])

  const title = profile
    ? profile.user_type.charAt(0).toUpperCase() + profile.user_type.slice(1)
    : 'Profile'

  if (loading) return <MainLayout title="Profile"><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title={title}>
      <div className="max-w-2xl mx-auto space-y-3">
        {error && <ErrorBanner message={error} />}
        {!profile ? null : (
          <>
            <FormRow label="User ID">
              <div className="form-cell flex-1 text-sm">{profile.user_id || '—'}</div>
            </FormRow>
            <FormRow label="User Type">
              <div className="form-cell flex-1 text-sm capitalize">{profile.user_type}</div>
            </FormRow>
            <FormRow label="User Name">
              <div className="form-cell flex-1 text-sm">{profile.user_name || '—'}</div>
            </FormRow>
            <FormRow label="User Email">
              <div className="form-cell flex-1 text-sm">{profile.user_email || '—'}</div>
            </FormRow>
            <FormRow label="User Phone">
              <div className="form-cell flex-1 text-sm">{profile.user_phone || '—'}</div>
            </FormRow>
            <FormRow label="Department">
              <div className="form-cell flex-1 text-sm">
                {profile.departments?.department_name || '—'}
              </div>
            </FormRow>
            <FormRow label="Location">
              <div className="form-cell flex-1 text-sm">{profile.user_location || '—'}</div>
            </FormRow>
            <FormRow label="Preferred Job Type">
              <div className="form-cell flex-1 text-sm">
                {profile.job_specifications?.job_type_name || '—'}
              </div>
            </FormRow>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {(isAdmin || isSupervisor) && profile.id && (
                <button
                  onClick={() => navigate(`/admin/users/${profile.id}/edit`)}
                  className="btn-action px-6"
                >
                  Edit Profile
                </button>
              )}
              {isOwnProfile && (
                <button
                  onClick={() => navigate('/change-password')}
                  className="btn-filter"
                >
                  Change Password
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  )
}
