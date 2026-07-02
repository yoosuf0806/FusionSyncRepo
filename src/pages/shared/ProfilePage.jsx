import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, KeyRound } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getUserById } from '../../services/userService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function initials(name) {
  if (!name) return 'U'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function Detail({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-44 shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || '—'}</span>
    </div>
  )
}

export default function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: authUser, isAdmin, isSupervisor } = useAuth()
  const isOwnProfile = !id
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        if (id && (isAdmin || isSupervisor)) {
          const data = await getUserById(id)
          setProfile(data)
        } else if (authUser) {
          setProfile(authUser); setLoading(false); return
        }
      } catch { setError('Unable to load profile') } finally { setLoading(false) }
    }
    load()
  }, [id, authUser, isAdmin, isSupervisor])

  if (loading) return <MainLayout title="Profile"><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title="Profile">
      <div className="mx-auto max-w-2xl space-y-4">
        {error && <ErrorBanner message={error} />}
        {profile && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 pb-5">
                <Avatar className="h-16 w-16 text-lg"><AvatarFallback>{initials(profile.user_name)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold tracking-tight text-foreground">{profile.user_name || '—'}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="default" className="capitalize">{profile.user_type}</Badge>
                    <span className="text-sm text-muted-foreground">{profile.user_id}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border">
                <Detail label="Email" value={profile.user_email} />
                <Detail label="Phone" value={profile.user_phone} />
                <Detail label="Department" value={profile.departments?.department_name} />
                <Detail label="Location" value={profile.user_location} />
                <Detail label="Preferred Job Type" value={profile.job_specifications?.job_type_name} />
              </div>

              <div className="flex flex-wrap gap-3 pt-5">
                {(isAdmin || isSupervisor) && profile.id && !isOwnProfile && (
                  <Button onClick={() => navigate(`/admin/users/${profile.id}/edit`)}><Pencil className="h-4 w-4" /> Edit Profile</Button>
                )}
                {isOwnProfile && (
                  <Button variant="outline" onClick={() => navigate('/change-password')}><KeyRound className="h-4 w-4" /> Change Password</Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
