import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getRoster, weekStart, addDays, ymd } from '../../services/rosterService'
import { getDepartments } from '../../services/departmentService'
import { jobDetailPath } from '../../constants/jobPaths'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const initials = (n) => (n || 'U').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const dayNum = (d) => new Date(d + 'T12:00:00').getDate()
const dowLabel = (d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })
const todayStr = () => ymd(new Date())

export default function Roster() {
  const navigate = useNavigate()
  const { role, isAdmin, isSupervisor, user: authUser } = useAuth()
  const [start, setStart] = useState(weekStart(todayStr()))
  const [deptId, setDeptId] = useState(isSupervisor ? (authUser?.department_id || '') : 'all')
  const [departments, setDepartments] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { if (isAdmin) getDepartments().then(d => setDepartments(d || [])).catch(() => {}) }, [isAdmin])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const scopeDept = isSupervisor ? (authUser?.department_id || null) : (deptId === 'all' ? null : deptId)
      setData(await getRoster(start, scopeDept))
    } catch (e) { setError(e.message); setData(null) } finally { setLoading(false) }
  }, [start, deptId, isSupervisor, authUser])

  useEffect(() => { load() }, [load])

  const rangeLabel = `${new Date(start + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(addDays(start, 6) + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <MainLayout title="Roster">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStart(addDays(start, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2 text-sm font-medium tabular-nums">{rangeLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStart(addDays(start, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setStart(weekStart(todayStr()))}>This week</Button>
          {isAdmin && (
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger className="w-auto min-w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {loading ? <LoadingSpinner /> : !data || data.workers.length === 0 ? (
          <Card><EmptyState message="No scheduled workers this week" /></Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-card p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Worker</th>
                  {data.days.map((d) => {
                    const isToday = d === todayStr()
                    return (
                      <th key={d} className={cn('min-w-[120px] p-3 text-center text-xs font-semibold uppercase tracking-wide', isToday ? 'text-primary' : 'text-muted-foreground')}>
                        <div>{dowLabel(d)}</div>
                        <div className={cn('mt-0.5 text-sm', isToday && 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground')}>{dayNum(d)}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {data.workers.map(w => (
                  <tr key={w.id} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials(w.name)}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{w.name}</div>
                          <div className="text-xs capitalize text-muted-foreground">{w.type === 'supervisor' ? 'Supervisor' : 'Helper'}</div>
                        </div>
                      </div>
                    </td>
                    {data.days.map(d => {
                      const jobs = data.cells[w.id]?.[d] || []
                      return (
                        <td key={d} className="p-2 align-top">
                          <div className="flex flex-col gap-1">
                            {jobs.map(j => (
                              <button key={j.id} onClick={() => navigate(jobDetailPath(role, j.id))}
                                className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-left text-xs transition-colors hover:bg-primary/10">
                                <div className="truncate font-medium text-primary">{j.job_name}</div>
                                {(j.job_start_time) && <div className="text-[10px] text-muted-foreground">{(j.job_start_time || '').slice(0, 5)}{j.job_end_time ? `–${(j.job_end_time).slice(0, 5)}` : ''}</div>}
                              </button>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarRange className="h-3.5 w-3.5" /> Shows active jobs each assigned worker is scheduled on, by day. Tap a job to open it.</p>
      </div>
    </MainLayout>
  )
}
