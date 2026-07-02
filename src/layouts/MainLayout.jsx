import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Bell, Menu, LogOut, User, CalendarDays, Users, Briefcase,
  ClipboardCheck, ListChecks, Settings, ChevronRight,
  CalendarRange, Wallet, BarChart3,
} from 'lucide-react'
import logo from '../assets/logo.png'
import { useAuth } from '../contexts/AuthContext'
import { getUnreadCount } from '../services/notificationService'
import { jobsHubPath, usersHubPath, jobSpecsHubPath } from '../constants/jobPaths'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ROLE_LABEL = { admin: 'Administrator', supervisor: 'Supervisor', helper: 'Helper', helpee: 'Client' }

function initials(name) {
  if (!name) return 'U'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function MainLayout({ children, title }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, isSupervisor, isHelper, isHelpee, signOut, user: authUser } = useAuth()

  const role = isAdmin ? 'admin' : isSupervisor ? 'supervisor' : isHelper ? 'helper' : 'helpee'
  const homePath = isAdmin ? '/admin/home' : isSupervisor ? '/supervisor/my-day' : isHelper ? '/helper/my-day' : '/helpee/home'

  const navItems = [
    { label: 'My Day', icon: CalendarDays, path: isSupervisor ? '/supervisor/my-day' : '/helper/my-day', show: isHelper || isSupervisor },
    { label: 'Manage Users', icon: Users, path: usersHubPath(role), show: isAdmin || isSupervisor },
    { label: 'Manage Jobs', icon: Briefcase, path: jobsHubPath(role), show: true },
    { label: 'Manage Attendance', icon: ClipboardCheck, path: isAdmin ? '/admin/manage-attendance' : '/supervisor/manage-attendance', show: isAdmin || isSupervisor },
    { label: 'Roster', icon: CalendarRange, path: isAdmin ? '/admin/roster' : '/supervisor/roster', show: isAdmin || isSupervisor },
    { label: 'Job Specifications', icon: ListChecks, path: jobSpecsHubPath(role), show: isAdmin || isSupervisor },
    { label: 'Payroll', icon: Wallet, path: '/admin/payroll', show: isAdmin },
    { label: 'Reports', icon: BarChart3, path: '/admin/reports', show: isAdmin },
    { label: 'Setup', icon: Settings, path: '/admin/setup', show: isAdmin },
  ].filter(item => item.show)

  const navItemActive = (item) => {
    if (item.label === 'My Day') return location.pathname.endsWith('/my-day')
    if (item.label === 'Manage Attendance') return location.pathname.endsWith('/manage-attendance')
    if (item.label === 'Manage Jobs') {
      if (isHelpee) return location.pathname === '/helpee/home' || location.pathname.startsWith('/helpee/jobs')
      if (isHelper) return location.pathname.startsWith('/helper/manage-jobs') || location.pathname.startsWith('/helper/jobs')
      if (isSupervisor) return location.pathname.startsWith('/supervisor/manage-jobs') || location.pathname.startsWith('/supervisor/jobs')
      return location.pathname.startsWith('/admin/manage-jobs') || location.pathname.startsWith('/admin/jobs')
    }
    if (item.label === 'Manage Users') {
      if (isSupervisor) return location.pathname.startsWith('/supervisor/manage-users') || location.pathname.startsWith('/supervisor/users')
      return location.pathname.startsWith('/admin/manage-users') || location.pathname.startsWith('/admin/users')
    }
    if (item.label === 'Job Specifications') {
      if (isSupervisor) return location.pathname.startsWith('/supervisor/job-specs')
      return location.pathname.startsWith('/admin/job-specs')
    }
    return location.pathname.startsWith(item.path)
  }

  useEffect(() => {
    if (!authUser?.id) return
    getUnreadCount(authUser.id).then(setUnreadCount).catch(() => {})
  }, [authUser, location.pathname])

  const handleSignOut = async () => { await signOut(); navigate('/') }
  const go = (path) => { navigate(path); setMobileNavOpen(false) }

  const NavList = () => (
    <nav className="flex flex-col gap-1">
      {navItems.map(item => {
        const active = navItemActive(item)
        const Icon = item.icon
        return (
          <button
            key={item.label}
            onClick={() => go(item.path)}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-100/80 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )

  const Brand = () => (
    <button onClick={() => go(homePath)} className="flex items-center gap-2.5 px-1 py-1">
      <img src={logo} alt="FusionSync" className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/20" />
      <div className="text-left leading-tight">
        <div className="text-sm font-bold text-white">FusionSync</div>
        <div className="text-[11px] text-slate-100/60">{ROLE_LABEL[role]}</div>
      </div>
    </button>
  )

  const SidebarInner = () => (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />
      <div className="flex-1"><NavList /></div>
      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100/80 hover:bg-white/10 hover:text-white transition-colors"
      >
        <LogOut className="h-[18px] w-[18px]" /> Sign Out
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-hh-sidebar md:block">
        <SidebarInner />
      </aside>

      <div className="md:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
          {/* Mobile nav trigger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 bg-hh-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarInner />
            </SheetContent>
          </Sheet>

          <h1 className="flex-1 truncate text-lg font-semibold tracking-tight text-foreground">{title}</h1>

          <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifications')} title="Notifications">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40" title="Account">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials(authUser?.user_name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="truncate">{authUser?.user_name || 'User'}</span>
                <span className="text-xs font-normal text-muted-foreground">{ROLE_LABEL[role]}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="h-4 w-4" /> My Profile <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
