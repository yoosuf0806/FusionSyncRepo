import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, LogOut, Clock, ChevronRight, CalendarPlus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import MainLayout from '../../layouts/MainLayout'
import {
  getJobsForCheckin, checkInToJob, checkOutOfJob, getUpcomingJobsForUser,
  getUnassignedJobsForSupervisor,
} from '../../services/jobService'
import { applyForLeave } from '../../services/leaveService'
import LoadingSpinner from '../../components/LoadingSpinner'
import JobChecklist from '../../components/JobChecklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const fmtTime = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '—' } }
const fmtClock = (t) => (t || '').slice(0, 5) || '—'
function elapsed(fromIso) {
  if (!fromIso) return ''
  const mins = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000))
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function MyDay() {
  const { user: dbUser, isSupervisor } = useAuth()
  const jobBasePath = isSupervisor ? '/supervisor/jobs' : '/helper/jobs'
  const navigate = useNavigate()
  const [jobs, setJobs] = useState(null)
  const [upcoming, setUpcoming] = useState(null)
  const [unassigned, setUnassigned] = useState(null)
  const [tab, setTab] = useState('today')
  const [busyJobId, setBusyJobId] = useState(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [showLeave, setShowLeave] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const load = async () => {
    if (!dbUser?.id) return
    try { setJobs(await getJobsForCheckin(dbUser.id, today)) }
    catch (e) { setError(e.message || 'Could not load your jobs'); setJobs([]) }
  }

  useEffect(() => { load() }, [dbUser?.id]) // eslint-disable-line
  useEffect(() => {
    if (tab === 'upcoming' && upcoming === null && dbUser?.id) getUpcomingJobsForUser(dbUser.id, today).then(setUpcoming).catch(() => setUpcoming([]))
    if (tab === 'unassigned' && unassigned === null && dbUser?.id && isSupervisor) getUnassignedJobsForSupervisor(dbUser.id, dbUser.department_id).then(setUnassigned).catch(() => setUnassigned([]))
  }, [tab, upcoming, dbUser?.id]) // eslint-disable-line
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 60000); return () => clearInterval(i) }, [])

  const handleCheckIn = async (job) => {
    setBusyJobId(job.id); setError('')
    try { await checkInToJob(job.id, dbUser.id, { attendanceDate: today }); await load() }
    catch (e) { setError(e.message || 'Check-in failed') } finally { setBusyJobId(null) }
  }
  const handleCheckOut = async (job) => {
    if (!job.attendance?.id) return
    setBusyJobId(job.id); setError('')
    try { await checkOutOfJob(job.attendance.id); await load() }
    catch (e) { setError(e.message || 'Check-out failed') } finally { setBusyJobId(null) }
  }

  const stats = useMemo(() => {
    const list = jobs || []
    const completed = list.filter(j => j.checkin_state === 'completed').length
    let totalMins = 0
    list.forEach(j => {
      const a = j.attendance
      if (a?.checkin_at && a?.checkout_at) totalMins += Math.max(0, (new Date(a.checkout_at) - new Date(a.checkin_at)) / 60000)
      else if (a?.checkin_at) totalMins += Math.max(0, (Date.now() - new Date(a.checkin_at)) / 60000)
    })
    return { completed, total: list.length, hoursLabel: `${Math.floor(totalMins / 60)}h ${Math.floor(totalMins % 60)}m` }
  }, [jobs, tick])

  const activeJob = (jobs || []).find(j => j.checkin_state === 'checked_in')
  const otherJobs = (jobs || []).filter(j => j.id !== activeJob?.id)
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  const Spinner = () => <div className="py-12"><LoadingSpinner /></div>

  return (
    <MainLayout title="My Day">
      <div className="mx-auto max-w-lg space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{dbUser?.user_name ? `Hello, ${dbUser.user_name}` : 'Hello'}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowLeave(true)}><CalendarPlus className="h-4 w-4" /> Apply Leave</Button>
        </div>

        {/* Stats hero */}
        <div className="flex items-center rounded-2xl bg-slate-900 px-5 py-4 text-white">
          <div className="flex-1">
            <p className="text-[10px] font-semibold tracking-widest text-slate-400">HOURS TODAY</p>
            <p className="text-2xl font-bold leading-tight">{stats.hoursLabel}</p>
          </div>
          <div className="mx-4 h-10 w-px bg-slate-700" />
          <div className="flex-1">
            <p className="text-[10px] font-semibold tracking-widest text-slate-400">COMPLETED</p>
            <p className="text-2xl font-bold leading-tight">{stats.completed} / {stats.total}</p>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
            {isSupervisor && <TabsTrigger value="unassigned" className="flex-1">Unassigned</TabsTrigger>}
          </TabsList>

          <TabsContent value="today" className="space-y-3">
            {jobs === null ? <Spinner /> : jobs.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No jobs assigned for today.</p>
            ) : (
              <>
                {activeJob && <FeaturedJobCard job={activeJob} busy={busyJobId === activeJob.id} onCheckOut={() => handleCheckOut(activeJob)} userId={dbUser?.id} />}
                {otherJobs.length > 0 && (
                  <>
                    <p className="pt-2 text-[11px] font-semibold tracking-widest text-muted-foreground">REMAINING TODAY</p>
                    {otherJobs.map(job => (
                      <CompactJobCard key={job.id} job={job} busy={busyJobId === job.id}
                        onCheckIn={() => handleCheckIn(job)} onCheckOut={() => handleCheckOut(job)}
                        onOpen={() => navigate(`${jobBasePath}/${job.id}`)} />
                    ))}
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-3">
            {upcoming === null ? <Spinner /> : upcoming.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No upcoming jobs scheduled.</p>
            ) : upcoming.map(job => <UpcomingJobCard key={job.id} job={job} onOpen={() => navigate(`${jobBasePath}/${job.id}`)} />)}
          </TabsContent>

          {isSupervisor && (
            <TabsContent value="unassigned" className="space-y-3">
              {unassigned === null ? <Spinner /> : unassigned.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Nothing needs assignment right now.</p>
              ) : unassigned.map(job => (
                <Card key={job.id} onClick={() => navigate(`${jobBasePath}/${job.id}`, { state: { from: 'myday' } })}
                  className="cursor-pointer border-l-4 border-l-warning p-4 transition-shadow hover:shadow-hh-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">{job.job_id}</span>
                    <span className="font-semibold text-foreground">{job.job_name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{job.job_category === 'frequent' ? 'Recurring' : 'One-time'} · Tap to assign</p>
                </Card>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </div>

      <ApplyLeaveModal open={showLeave} userId={dbUser?.id} onClose={() => setShowLeave(false)} onSubmitted={() => setShowLeave(false)} />
    </MainLayout>
  )
}

function FeaturedJobCard({ job, busy, onCheckOut, userId }) {
  const a = job.attendance
  return (
    <Card className="overflow-hidden">
      <div className="relative flex h-24 items-start bg-gradient-to-br from-primary/15 to-primary/5 p-3">
        <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> ACTIVE NOW
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-foreground">{job.job_name}</h2>
          <span className="text-sm font-semibold text-primary">{job.job_id}</span>
        </div>
        {job.job_location && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {job.job_location}</p>}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold text-foreground">{fmtClock(job.job_start_time)}</span>
            {job.job_end_time && <span className="text-muted-foreground"> – {fmtClock(job.job_end_time)}</span>}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">ON SITE</p>
            <p className="font-bold text-primary">{elapsed(a?.checkin_at)}</p>
          </div>
        </div>
        <Button onClick={onCheckOut} disabled={busy} variant="destructive" size="lg" className="mt-4 h-14 w-full text-base">
          <LogOut className="h-5 w-5" /> {busy ? 'Saving…' : 'CHECK OUT'}
        </Button>
        {a?.checkin_at && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Checked in at <span className="font-semibold text-primary">{fmtTime(a.checkin_at)}</span>
            {a.location_missing && <span className="text-destructive"> · location off</span>}
          </p>
        )}
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Tasks</p>
          <JobChecklist jobId={job.id} canManage={false} userId={userId} compact />
        </div>
      </div>
    </Card>
  )
}

function UpcomingJobCard({ job, onOpen }) {
  const fmtDate = (d) => { if (!d) return ''; try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return d } }
  const daysLabel = { weekdays_only: 'Weekdays', weekends_only: 'Weekends', weekdays_and_weekends: 'Every day' }[job.job_days] || ''
  return (
    <Card onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen() }}
      className="flex cursor-pointer items-center gap-3 p-3 transition-shadow hover:shadow-hh-lg">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-primary">{job.job_id?.replace('JOB-', '#') || 'JOB'}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="truncate font-semibold text-foreground">{job.job_name}</h3>
          <span className="ml-2 shrink-0 text-xs text-muted-foreground">{fmtClock(job.job_start_time)}</span>
        </div>
        {job.job_location && <p className="truncate text-xs text-muted-foreground">{job.job_location}</p>}
        <p className="mt-1 text-xs font-medium text-primary">{job.is_recurring ? `${daysLabel} until ${fmtDate(job.upcoming_to)}` : fmtDate(job.upcoming_from)}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Card>
  )
}

function CompactJobCard({ job, busy, onCheckIn, onCheckOut, onOpen }) {
  const state = job.checkin_state
  return (
    <Card className="flex items-center gap-3 p-3">
      <div onClick={onOpen} role="button" className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-muted text-xs font-bold text-primary">{job.job_id?.replace('JOB-', '#') || 'JOB'}</div>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen} role="button">
        <div className="flex items-center justify-between">
          <h3 className="truncate font-semibold text-foreground">{job.job_name}</h3>
          <span className="ml-2 shrink-0 text-xs text-muted-foreground">{fmtClock(job.job_start_time)}</span>
        </div>
        {job.job_location && <p className="truncate text-xs text-muted-foreground">{job.job_location}</p>}
        <div className="mt-1 flex items-center gap-1 text-xs">
          {state === 'completed'
            ? <span className="font-semibold text-primary">✓ Done</span>
            : <span className="text-muted-foreground"><Clock className="mr-0.5 inline h-3 w-3" />Scheduled</span>}
        </div>
      </div>
      {state === 'not_started' && (
        <Button onClick={(e) => { e.stopPropagation(); onCheckIn() }} disabled={busy} variant="secondary" className="shrink-0 font-bold text-primary">
          {busy ? '…' : 'CHECK IN'}
        </Button>
      )}
      {state === 'checked_in' && (
        <Button onClick={(e) => { e.stopPropagation(); onCheckOut() }} disabled={busy} variant="destructive" className="shrink-0 font-bold">
          {busy ? '…' : 'CHECK OUT'}
        </Button>
      )}
    </Card>
  )
}

function ApplyLeaveModal({ open, userId, onClose, onSubmitted }) {
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().slice(0, 10))
  const [leaveToDate, setLeaveToDate] = useState(new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState('full_day')
  const [reason, setReason] = useState('sick')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const isSingleDay = leaveToDate === leaveDate
  const REASONS = [{ key: 'sick', label: 'Sick' }, { key: 'personal', label: 'Personal' }, { key: 'emergency', label: 'Emergency' }, { key: 'other', label: 'Other' }]
  const DURATIONS = [{ key: 'full_day', label: 'Full Day' }, { key: 'first_half', label: 'Morning (8am–1pm)' }, { key: 'second_half', label: 'Afternoon (1pm–6pm)' }]

  const submit = async () => {
    setSaving(true); setErr('')
    try {
      await applyForLeave(userId, { leaveDate, leaveToDate, duration: isSingleDay ? duration : 'full_day', reason, note })
      onSubmitted()
    } catch (e) { setErr(e.message || 'Could not submit leave'); setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Apply for leave</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lfrom">From</Label>
              <Input id="lfrom" type="date" value={leaveDate} onChange={e => { setLeaveDate(e.target.value); if (leaveToDate < e.target.value) setLeaveToDate(e.target.value) }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lto">To</Label>
              <Input id="lto" type="date" value={leaveToDate} min={leaveDate} onChange={e => setLeaveToDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Reason</Label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map(r => (
                <button key={r.key} onClick={() => setReason(r.key)}
                  className={cn('rounded-xl border px-3 py-3 text-sm font-medium transition-colors',
                    reason === r.key ? 'border-primary bg-accent text-primary' : 'border-border text-foreground hover:bg-muted')}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {isSingleDay && (
            <div className="flex flex-col gap-2">
              <Label>Duration</Label>
              <div className="space-y-2">
                {DURATIONS.map(d => (
                  <button key={d.key} onClick={() => setDuration(d.key)}
                    className={cn('w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                      duration === d.key ? 'border-primary bg-accent text-primary' : 'border-border text-foreground hover:bg-muted')}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lnote">Note (optional)</Label>
            <Textarea id="lnote" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note if needed" className="min-h-[64px]" />
          </div>

          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
