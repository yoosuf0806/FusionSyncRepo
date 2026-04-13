import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAdminDashboard,
  getSupervisorDashboard,
  getHelperDashboard,
} from '../../services/dashboardService'

function StatCard({ label, value, color = 'green', onClick }) {
  const colorMap = {
    green:  'bg-hh-green    text-white',
    teal:   'bg-emerald-500 text-white',
    yellow: 'bg-yellow-400  text-hh-text',
    red:    'bg-hh-error    text-white',
    blue:   'bg-blue-500    text-white',
    gray:   'bg-gray-400    text-white',
  }
  const isLoading = value === null
  return (
    <button
      onClick={onClick}
      disabled={!onClick || isLoading}
      className={`
        ${colorMap[color] || colorMap.green}
        rounded-hh-xl shadow-hh flex flex-col items-center justify-center gap-2
        w-40 h-32 px-3 transition-all duration-150
        ${onClick && !isLoading ? 'hover:opacity-90 active:scale-95 cursor-pointer' : 'cursor-default'}
      `}
    >
      <span className="text-3xl font-bold leading-none">
        {isLoading
          ? <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin block" />
          : (value ?? '—')}
      </span>
      <span className="text-xs font-medium text-center leading-tight opacity-90">{label}</span>
    </button>
  )
}

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

function AdminDashboard({ navigate }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    getAdminDashboard().then(setStats).catch(() => setStats({}))
  }, [])
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">Overview</h2>
        <div className="flex flex-wrap gap-4">
          <StatCard label="Total Users"          value={stats?.total_users}        color="teal"   onClick={() => navigate('/admin/manage-users')} />
          <StatCard label="Total Jobs"           value={stats?.total_jobs}         color="blue"   onClick={() => navigate('/admin/manage-jobs')} />
          <StatCard label="Pending Jobs"         value={stats?.pending}            color="yellow" onClick={() => navigate('/admin/manage-jobs')} />
          <StatCard label="Completed Jobs"       value={stats?.completed}          color="green"  onClick={() => navigate('/admin/manage-jobs')} />
          <StatCard label="Helpers Not Assigned" value={stats?.unassigned_helpers} color="red"    onClick={() => navigate('/admin/manage-users')} />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-6">
          <NavCard label={['Manage', 'Users']}                 onClick={() => navigate('/admin/manage-users')} />
          <NavCard label={['Manage', 'Jobs']}                  onClick={() => navigate('/admin/manage-jobs')} />
          <NavCard label={['Manage', 'Job', 'Specifications']} onClick={() => navigate('/admin/job-specs')} />
          <NavCard label={['Manage', 'Setup']}                 onClick={() => navigate('/admin/setup')} />
        </div>
      </section>
    </div>
  )
}

function SupervisorDashboard({ navigate }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    getSupervisorDashboard().then(setStats).catch(() => setStats({}))
  }, [])
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">Overview</h2>
        <div className="flex flex-wrap gap-4">
          <StatCard label="Unassigned Jobs"      value={stats?.unassigned_jobs}    color="red"    onClick={() => navigate('/supervisor/manage-jobs')} />
          <StatCard label="Pending Jobs"         value={stats?.pending}            color="yellow" onClick={() => navigate('/supervisor/manage-jobs')} />
          <StatCard label="Ongoing Jobs"         value={stats?.ongoing}            color="blue"   onClick={() => navigate('/supervisor/manage-jobs')} />
          <StatCard label="Completed Jobs"       value={stats?.completed}          color="green"  onClick={() => navigate('/supervisor/manage-jobs')} />
          <StatCard label="Helpers Not Assigned" value={stats?.unassigned_helpers} color="gray"   onClick={() => navigate('/supervisor/manage-users')} />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-6">
          <NavCard label={['Manage', 'Users']}                 onClick={() => navigate('/supervisor/manage-users')} />
          <NavCard label={['Manage', 'Jobs']}                  onClick={() => navigate('/supervisor/manage-jobs')} />
          <NavCard label={['Manage', 'Job', 'Specifications']} onClick={() => navigate('/supervisor/job-specs')} />
        </div>
      </section>
    </div>
  )
}

function HelperDashboard({ navigate, userId }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    if (!userId) return
    getHelperDashboard(userId).then(setStats).catch(() => setStats({}))
  }, [userId])
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">My Jobs</h2>
        <div className="flex flex-wrap gap-4">
          <StatCard label="Pending Jobs"   value={stats?.pending}   color="yellow" onClick={() => navigate('/helper/manage-jobs')} />
          <StatCard label="Completed Jobs" value={stats?.completed} color="green"  onClick={() => navigate('/helper/manage-jobs')} />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-hh-placeholder uppercase tracking-wide mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-6">
          <NavCard label={['Manage', 'Jobs']} onClick={() => navigate('/helper/manage-jobs')} />
        </div>
      </section>
    </div>
  )
}

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
