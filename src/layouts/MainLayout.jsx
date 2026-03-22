import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getUnreadCount } from '../services/notificationService'

const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

const PersonIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
      d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const LogoutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)

export default function MainLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { role, isAdmin, isSupervisor, signOut, user: authUser } = useAuth()

  const navItems = [
    { label: 'Manage Users',             path: '/admin/manage-users', show: isAdmin || isSupervisor },
    { label: 'Manage Jobs',              path: '/admin/manage-jobs',  show: true },
    { label: 'Manage Job Specifications',path: '/admin/job-specs',    show: isAdmin || isSupervisor },
    { label: 'Manage Setup',             path: '/admin/setup',        show: isAdmin },
  ].filter(item => item.show)

  const isActive = (path) => location.pathname.startsWith(path)

  // Load unread notification count — authUser from context is already the DB user record
  useEffect(() => {
    if (!authUser?.id) return
    getUnreadCount(authUser.id).then(setUnreadCount).catch(() => {})
  }, [authUser, location.pathname])

  const handleSignOut = async () => {
    setShowUserMenu(false)
    await signOut()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen bg-hh-mint">

      {/* ── SIDEBAR ───────────────────────────────── */}
      <div
        className={`
          flex-shrink-0 relative flex flex-col transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-56' : 'w-16'}
          bg-hh-sidebar
        `}
        style={{ borderRadius: sidebarOpen ? '0 16px 16px 0' : '0', zIndex: 20 }}
      >
        {/* Blue accent line */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-hh-accent rounded-l" />

        {/* Hamburger button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center w-11 h-11 m-2.5 rounded-hh bg-hh-sidebar hover:bg-green-900 transition-colors text-white flex-shrink-0"
        >
          <MenuIcon />
        </button>

        {/* Nav items — only visible when expanded */}
        {sidebarOpen && (
          <nav className="flex flex-col gap-3 px-3 mt-2 flex-1">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setSidebarOpen(false) }}
                className={`
                  w-full px-3 py-2.5 rounded-pill text-sm font-medium text-center transition-colors
                  ${isActive(item.path)
                    ? 'bg-hh-sidebar text-white border border-white/30'
                    : 'bg-white text-hh-text hover:bg-gray-100'}
                `}
              >
                {item.label}
              </button>
            ))}

            {/* Sign out at bottom of sidebar */}
            <div className="mt-auto pt-4 pb-3">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 justify-center px-3 py-2.5 rounded-pill text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <LogoutIcon />
                Sign Out
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* Overlay — closes sidebar on mobile when clicking outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── MAIN AREA ─────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top Header */}
        <header className="flex items-center gap-3 px-4 py-3 bg-hh-mint sticky top-0 z-10">
          <div className="flex-1 flex justify-center">
            <div className="page-title-bar min-w-[200px] px-10">
              <span className="text-base font-medium">{title}</span>
            </div>
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Notification bell */}
            <button
              onClick={() => navigate('/notifications')}
              className="btn-icon relative"
              title="Notifications"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-hh-error rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile / User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="btn-icon"
                title="Profile"
              >
                <PersonIcon />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-12 bg-white rounded-hh-lg shadow-hh-lg py-1 w-40 z-20">
                  <button
                    onClick={() => { navigate('/profile'); setShowUserMenu(false) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                  >
                    My Profile
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-hh-error hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <LogoutIcon />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
