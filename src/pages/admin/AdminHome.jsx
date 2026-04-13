import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAdminDashboard,
  getSupervisorDashboard,
  getHelperDashboard,
} from '../../services/dashboardService'

// ── Redesigned stat card — dark tile, label on top, large value below ─────
function StatCard({ label, value, accent = false, onClick }) {
  const isLoading = value === null
  return (
    <button
      onClick={onClick}
      disabled={!onClick || isLoading}
      className={`
        bg-gray-800 rounded-xl px-5 py-4 flex flex-col gap-1 min-w-[140px] flex-1
        text-left transition-all duration-150 border border-gray-700
        ${onClick && !isLoading ? 'hover:bg-gray-700 hover:border-gray-500 cursor-pointer active:scale-95' : 'cursor-default'}
      `}
    >
      <span className="text-xs font-medium text-gray-400 leading-tight tracking-wide">{label}</span>
      <span className={`text-2xl font-bold leading-tight ${accent ? 'text-hh-green' : 'text-white'}`}>
        {isLoading
          ? <span className="w-5 h-5 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin inline-block align-middle" />
          : (value ?? 0)}
      </span>
    </button>
  )
}

// ── Nav card (quick action — unchanged style) ─────────────────────────────
function NavCard({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-hh-green-med text-white rounded-hh-xl shadow-hh w-36 h-32
        flex flex-col items-center justify-center gap-1
        hover:bg-green-500 active:scale-95 transition-all duration-150 cursor-pointer"
    >
      {label.map((line, j) => (
        <span key={j} className="text-sm font-medium leading-tight">{line}</span>
      ))}
    </button>
  )
}

// ── Overview section wrapper ──────────────────────────────────────────────
function OverviewSection({ title, children }) {
  return (
    <section className="mt-12 pt-8 border-t border-gray-200">
      <h2 className="text-xs font-semibold text-hh-placeholder uppercase tracking-widest mb-4">
        {title}
      </h2>
      <div className="flex flex-wrap gap-3">
        {children}
      </div>
    </section>
  )
}

// ── Admin ─────────────────────────────────────────────────────────────────
function AdminDashboard({ navigate }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    getAdminDashboard().then(setStats).catch(() => setStats({}))
  }, [])
  return (
    <div>
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-6">
          <NavCard label={['Manage', 'Users']}                 onClick={() => navigate('/admin/manage-users')} />
          <NavCard label={['Manage', 'Jobs']}                  onClick={() => navigate('/admin/manage-jobs')} />
          <NavCard label={['Manage', 'Job', 'Specifications']} onClick={() => navigate('/admin/job-specs')} />
          <NavCard label={['Manage', 'Setup']}                 onClick={() => navigate('/admin/setup')} />
        </div>
      </section>

      <OverviewSection title="Overview">
        <StatCard label="Total Users"          value={stats?.total_users}        onClick={() => navigate('/admin/manage-users')} />
        <StatCard label="Total Jobs"           value={stats?.total_jobs}         onClick={() => navigate('/admin/manage-jobs')} />
        <StatCard label="Pending Jobs"         value={stats?.pending}            onClick={() => navigate('/admin/manage-jobs')} />
        <StatCard label="Completed Jobs"       value={stats?.completed}          onClick={() => navigate('/admin/manage-jobs')} accent />
        <StatCard label="Helpers Not Assigned" value={stats?.unassigned_helpers} onClick={() => navigate('/admin/manage-users')} />
      </OverviewSection>
    </div>
  )
}

// ── Supervisor ────────────────────────────────────────────────────────────
function SupervisorDashboard({ navigate }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    getSupervisorDashboard().then(setStats).catch(() => setStats({}))
  }, [])
  return (
    <div>
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-6">
          <NavCard label={['Manage', 'Users']}                 onClick={() => navigate('/supervisor/manage-users')} />
          <NavCard label={['Manage', 'Jobs']}                  onClick={() => navigate('/supervisor/manage-jobs')} />
          <NavCard label={['Manage', 'Job', 'Specifications']} onClick={() => navigate('/supervisor/job-specs')} />
        </div>
      </section>

      <OverviewSection title="Overview">
        <StatCard label="Unassigned Jobs"      value={stats?.unassigned_jobs}    onClick={() => navigate('/supervisor/manage-jobs')} />
        <StatCard label="Pending Jobs"         value={stats?.pending}            onClick={() => navigate('/supervisor/manage-jobs')} />
        <StatCard label="Ongoing Jobs"         value={stats?.ongoing}            onClick={() => navigate('/supervisor/manage-jobs')} accent />
        <StatCard label="Completed Jobs"       value={stats?.completed}          onClick={() => navigate('/supervisor/manage-jobs')} accent />
        <StatCard label="Helpers Not Assigned" value={stats?.unassigned_helpers} onClick={() => navigate('/supervisor/manage-users')} />
      </OverviewSection>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────
function HelperDashboard({ navigate, userId }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    if (!userId) return
    getHelperDashboard(userId).then(setStats).catch(() => setStats({}))
  }, [userId])
  return (
    <div>
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-6">
          <NavCard label={['Manage', 'Jobs']} onClick={() => navigate('/helper/manage-jobs')} />
        </div>
      </section>

      <OverviewSection title="My Jobs Overview">
        <StatCard label="Pending Jobs"   value={stats?.pending}   onClick={() => navigate('/helper/manage-jobs')} />
        <StatCard label="Completed Jobs" value={stats?.completed} onClick={() => navigate('/helper/manage-jobs')} accent />
      </OverviewSection>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function AdminHome() {
  const navigate = useNavigate()
  const { user, isAdmin, isSupervisor, isHelper } = useAuth()
  return (
    <MainLayout title="Home">
      <div className="max-w-4xl mx-auto py-6 px-2">
        {isAdmin      && <AdminDashboard      navigate={navigate} />}
        {isSupervisor && <SupervisorDashboard navigate={navigate} />}
        {isHelper     && <HelperDashboard     navigate={navigate} userId={user?.id} />}
      </div>
    </MainLayout>
  )
}
