import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, CheckCheck } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getNotifications, markAsRead, markAllRead, subscribeToNotifications } from '../../services/notificationService'
import { jobDetailPath } from '../../constants/jobPaths'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const PAGE_SIZE = 20

export default function Notifications() {
  const navigate = useNavigate()
  const { user: authUser, role } = useAuth()
  const [dbUserId, setDbUserId] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { if (authUser?.id) setDbUserId(authUser.id) }, [authUser])

  const loadNotifications = useCallback(async (reset = false) => {
    if (!dbUserId) return
    setLoading(true)
    try {
      const newOffset = reset ? 0 : offset
      const data = await getNotifications(dbUserId, { limit: PAGE_SIZE, offset: newOffset })
      if (reset) { setNotifications(data); setOffset(PAGE_SIZE) }
      else { setNotifications(prev => [...prev, ...data]); setOffset(prev => prev + PAGE_SIZE) }
      setHasMore(data.length === PAGE_SIZE)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [dbUserId, offset])

  useEffect(() => {
    if (dbUserId) loadNotifications(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUserId])

  useEffect(() => {
    if (!dbUserId) return
    const sub = subscribeToNotifications(dbUserId, (newNotif) => setNotifications(prev => [newNotif, ...prev]))
    return () => { sub.unsubscribe() }
  }, [dbUserId])

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await markAsRead(notif.id).catch(() => {})
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    }
    if (notif.related_job_id && role) navigate(jobDetailPath(role, notif.related_job_id))
  }

  const handleMarkAll = async () => {
    if (!dbUserId) return
    await markAllRead(dbUserId).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <MainLayout title="Notifications">
      <div className="mx-auto max-w-3xl space-y-4">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {notifications.some(n => !n.is_read) && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleMarkAll}><CheckCheck className="h-4 w-4" /> Mark all as read</Button>
          </div>
        )}

        {loading && notifications.length === 0 ? (
          <LoadingSpinner />
        ) : notifications.length === 0 ? (
          <Card><EmptyState message="No notifications yet" /></Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                  n.related_job_id ? 'cursor-pointer hover:bg-muted' : 'cursor-default',
                  !n.is_read && 'bg-primary/5'
                )}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  n.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}>
                  <Bell className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', n.is_read ? 'text-muted-foreground' : 'font-medium text-foreground')}>{n.message}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                </span>
                {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                {n.related_job_id && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
            ))}
          </Card>
        )}

        {hasMore && notifications.length > 0 && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => loadNotifications(false)} disabled={loading}>
              {loading ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
