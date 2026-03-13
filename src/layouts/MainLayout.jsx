import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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

export default function MainLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { role, isAdmin, isSupervisor } = useAuth()

  const navItems = [
    { label: 'Manage Users',           path: `/${role}/manage-users`,  show: isAdmin || isSupervisor },
    { label: 'Manage Jobs',            path: `/${role}/manage-jobs`,   show: true },
    { label: 'Manage Job Specifications', path: `/${role}/job-specs`,  show: isAdmin || isSupervisor },
    { label: 'Manage Setup',           path: '/admin/setup',           show: isAdmin },
  ].filter(item => item.show)

  const isActive = (path) => location.pathname.startsWith(path)

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
          <nav className="flex flex-col gap-3 px-3 mt-2">
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
          {/* Spacer for sidebar width */}
          <div className="flex-1 flex justify-center">
            <div className="page-title-bar min-w-[200px] px-10">
              <span className="text-base font-medium">{title}</span>
            </div>
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/notifications')}
              className="btn-icon relative"
              title="Notifications"
            >
              <BellIcon />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="btn-icon"
              title="Profile"
            >
              <PersonIcon />
            </button>
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
