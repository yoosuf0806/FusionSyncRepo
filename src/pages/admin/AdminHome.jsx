import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Briefcase, ClipboardCheck, ListChecks, Settings, CalendarDays,
  Loader2, ArrowUpRight, UserX, RefreshCw, Clock, CheckCircle2, FileClock,
} from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAdminDashboard, getSupervisorDashboard, getHelperDashboard,
} from '../../services/dashboardService'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ── Stat card — white surface, dominant number, optional accent + icon ──────
function StatCard({ label, value, icon: Icon, accent = false, onClick }) {
  const isLoading = value === null || value === undefined
  return (
    <Card
      onClick={onClick && !isLoading ? onClick : undefined}
      className={cn(
        'group relative p-5 flex flex-col gap-2 transition-all',
        onClick && !isLoading && 'cursor-pointer hover:border-primary/40 hover:shadow-hh-lg'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg',
            accent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <span className={cn('text-3xl font-bold leading-none tracking-tight', accent ? 'text-primary' : 'text-foreground')}>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (value ?? 0)}
      </span>
      {onClick && !isLoading && (
        <ArrowUpRight className="absolute right-4 bottom-4 h-4 w-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60" />
      )}
    </Card>
  )
}

// ── Quick-action card — icon tile + label ──────────────────────────────────
function NavCard({ label, icon: Icon, onClick }) {
  return (
    <Card
      onClick={onClick}
      className="group flex cursor-pointer flex-col items-start gap-3 p-5 transition-all hover:border-primary/40 hover:shadow-hh-lg"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </Card>
  )
}

function Section({ title, children, className }) {
  return (
    <section className={className}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function AdminDashboard({ navigate }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { getAdminDashboard().then(setStats).catch(() => setStats({})) }, [])
  return (
    <div className="space-y-8">
      <Section title="Quick Actions">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <NavCard label="Manage Users" icon={Users} onClick={() => navigate('/admin/manage-users')} />
          <NavCard label="Manage Jobs" icon={Briefcase} onClick={() => navigate('/admin/manage-jobs')} />
          <NavCard label="Attendance" icon={ClipboardCheck} onClick={() => navigate('/admin/manage-attendance')} />
          <NavCard label="Job Specifications" icon={ListChecks} onClick={() => navigate('/admin/job-specs')} />
          <NavCard label="Setup" icon={Settings} onClick={() => navigate('/admin/setup')} />
        </div>
      </Section>
      <Section title="Overview">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Users" value={stats?.total_users} icon={Users} onClick={() => navigate('/admin/manage-users')} />
          <StatCard label="Total Jobs" value={stats?.total_jobs} icon={Briefcase} onClick={() => navigate('/admin/manage-jobs')} />
          <StatCard label="Pending Jobs" value={stats?.pending} icon={Clock} onClick={() => navigate('/admin/manage-jobs')} />
          <StatCard label="Completed Jobs" value={stats?.completed} icon={CheckCircle2} accent onClick={() => navigate('/admin/manage-jobs')} />
          <StatCard label="Helpers Free" value={stats?.unassigned_helpers} icon={UserX} onClick={() => navigate('/admin/manage-users')} />
          <StatCard label="Replacements" value={stats?.replacements_needed} icon={RefreshCw} accent onClick={() => navigate('/admin/manage-attendance')} />
        </div>
      </Section>
    </div>
  )
}

function SupervisorDashboard({ navigate }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { getSupervisorDashboard().then(setStats).catch(() => setStats({})) }, [])
  return (
    <div className="space-y-8">
      <Section title="Quick Actions">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <NavCard label="My Day" icon={CalendarDays} onClick={() => navigate('/supervisor/my-day')} />
          <NavCard label="Manage Users" icon={Users} onClick={() => navigate('/supervisor/manage-users')} />
          <NavCard label="Manage Jobs" icon={Briefcase} onClick={() => navigate('/supervisor/manage-jobs')} />
          <NavCard label="Attendance" icon={ClipboardCheck} onClick={() => navigate('/supervisor/manage-attendance')} />
          <NavCard label="Job Specifications" icon={ListChecks} onClick={() => navigate('/supervisor/job-specs')} />
        </div>
      </Section>
      <Section title="Overview">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Unassigned" value={stats?.unassigned_jobs} icon={FileClock} onClick={() => navigate('/supervisor/manage-jobs')} />
          <StatCard label="Pending Jobs" value={stats?.pending} icon={Clock} onClick={() => navigate('/supervisor/manage-jobs')} />
          <StatCard label="Ongoing Jobs" value={stats?.ongoing} icon={Briefcase} accent onClick={() => navigate('/supervisor/manage-jobs')} />
          <StatCard label="Completed" value={stats?.completed} icon={CheckCircle2} accent onClick={() => navigate('/supervisor/manage-jobs')} />
          <StatCard label="Helpers Free" value={stats?.unassigned_helpers} icon={UserX} onClick={() => navigate('/supervisor/manage-users')} />
          <StatCard label="Replacements" value={stats?.replacements_needed} icon={RefreshCw} accent onClick={() => navigate('/supervisor/manage-attendance')} />
        </div>
      </Section>
    </div>
  )
}

function HelperDashboard({ navigate, userId }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { if (userId) getHelperDashboard(userId).then(setStats).catch(() => setStats({})) }, [userId])
  return (
    <div className="space-y-8">
      <Section title="Quick Actions">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NavCard label="My Day" icon={CalendarDays} onClick={() => navigate('/helper/my-day')} />
          <NavCard label="Manage Jobs" icon={Briefcase} onClick={() => navigate('/helper/manage-jobs')} />
        </div>
      </Section>
      <Section title="My Jobs Overview">
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <StatCard label="Pending Jobs" value={stats?.pending} icon={Clock} onClick={() => navigate('/helper/manage-jobs')} />
          <StatCard label="Completed" value={stats?.completed} icon={CheckCircle2} accent onClick={() => navigate('/helper/manage-jobs')} />
        </div>
      </Section>
    </div>
  )
}

export default function AdminHome() {
  const navigate = useNavigate()
  const { user, isAdmin, isSupervisor, isHelper } = useAuth()
  return (
    <MainLayout title="Home">
      {isAdmin && <AdminDashboard navigate={navigate} />}
      {isSupervisor && <SupervisorDashboard navigate={navigate} />}
      {isHelper && <HelperDashboard navigate={navigate} userId={user?.id} />}
    </MainLayout>
  )
}
