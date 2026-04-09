import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  getNotifications, markAsRead, markAllRead, subscribeToNotifications,
} from '../../services/notificationService'
import { jobDetailPath } from '../../constants/jobPaths'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
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

  // authUser from context is already the DB user record
  useEffect(() => {
    if (authUser?.id) setDbUserId(authUser.id)
  }, [authUser])

  const loadNotifications = useCallback(async (reset = false) => {
    if (!dbUserId) return
    setLoading(true)
    try {
      const newOffset = reset ? 0 : offset
      const data = await getNotifications(dbUserId, { limit: PAGE_SIZE, offset: newOffset })
      if (reset) {
        setNotifications(data)
        setOffset(PAGE_SIZE)
      } else {
        setNotifications(prev => [...prev, ...data])
        setOffset(prev => prev + PAGE_SIZE)
      }
      setHasMore(data.length === PAGE_SIZE)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dbUserId, offset])

  useEffect(() => {
    if (dbUserId) loadNotifications(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUserId])

  // Real-time subscription
  useEffect(() => {
    if (!dbUserId) return
    const sub = subscribeToNotifications(dbUserId, (newNotif) => {
      setNotifications(prev => [newNotif, ...prev])
    })
    return () => { sub.unsubscribe() }
  }, [dbUserId])

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await markAsRead(notif.id).catch(() => {})
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    }
    if (notif.related_job_id && role) {
      navigate(jobDetailPath(role, notif.related_job_id))
    }
  }

  const handleMarkAll = async () => {
    if (!dbUserId) return
    await markAllRead(dbUserId).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <MainLayout title="Notifications">
      <div className="max-w-3xl mx-auto space-y-4">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {notifications.some(n => !n.is_read) && (
          <div className="flex justify-end">
            <button onClick={handleMarkAll} className="btn-filter text-sm">
              Mark all as read
            </button>
          </div>
        )}

        {loading && notifications.length === 0 ? (
          <LoadingSpinner />
        ) : notifications.length === 0 ? (
          <EmptyState message="No notifications yet" />
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`
                  w-full table-row rounded-hh-lg px-4 gap-4 text-left
                  ${!n.is_read ? 'font-semibold' : 'font-normal text-gray-600'}
                  ${n.related_job_id ? 'hover:bg-hh-mint/40 cursor-pointer' : 'cursor-default'}
                `}
              >
                <span className="text-sm text-hh-placeholder flex-shrink-0 w-24">
                  {formatDate(n.created_at)}
                </span>
                <span className={`text-sm flex-1 ${n.related_job_id ? 'text-hh-green underline underline-offset-2' : ''}`}>
                  {n.message}
                </span>
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-hh-error flex-shrink-0" />
                )}
              </button>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => loadNotifications(false)}
                  disabled={loading}
                  className="btn-filter"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
