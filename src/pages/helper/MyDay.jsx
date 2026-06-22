import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  getJobsForCheckin, checkInToJob, checkOutOfJob, getUpcomingJobsForUser,
} from '../../services/jobService'

/* ────────────────────────────────────────────────────────────────────────
   MyDay — worker / supervisor check-in/out screen
   Visual job cards, large tap buttons, minimal reading (low-literacy first).
   Backend auto-captures date, time, GPS on each tap. No approval workflow.
──────────────────────────────────────────────────────────────────────────*/

const fmtTime = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

const fmtClock = (t) => (t || '').slice(0, 5) || '—'

function elapsed(fromIso) {
  if (!fromIso) return ''
  const mins = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function MyDay() {
  const { user: dbUser } = useAuth()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState(null)
  const [upcoming, setUpcoming] = useState(null)
  const [tab, setTab] = useState('today')
  const [busyJobId, setBusyJobId] = useState(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)   // re-render for live timers

  const today = new Date().toISOString().slice(0, 10)

  const load = async () => {
    if (!dbUser?.id) return
    try {
      const data = await getJobsForCheckin(dbUser.id, today)
      setJobs(data)
    } catch (e) {
      setError(e.message || 'Could not load your jobs')
      setJobs([])
    }
  }

  useEffect(() => { load() }, [dbUser?.id])             // eslint-disable-line
  useEffect(() => {
    if (tab === 'upcoming' && upcoming === null && dbUser?.id) {
      getUpcomingJobsForUser(dbUser.id, today)
        .then(setUpcoming)
        .catch(() => setUpcoming([]))
    }
  }, [tab, upcoming, dbUser?.id])                        // eslint-disable-line
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 60000)  // tick every minute
    return () => clearInterval(i)
  }, [])

  const handleCheckIn = async (job) => {
    setBusyJobId(job.id); setError('')
    try {
      await checkInToJob(job.id, dbUser.id, { attendanceDate: today })
      await load()
    } catch (e) {
      setError(e.message || 'Check-in failed')
    } finally {
      setBusyJobId(null)
    }
  }

  const handleCheckOut = async (job) => {
    if (!job.attendance?.id) return
    setBusyJobId(job.id); setError('')
    try {
      await checkOutOfJob(job.attendance.id)
      await load()
    } catch (e) {
      setError(e.message || 'Check-out failed')
    } finally {
      setBusyJobId(null)
    }
  }

  // Stats for the header strip
  const stats = useMemo(() => {
    const list = jobs || []
    const completed = list.filter(j => j.checkin_state === 'completed').length
    let totalMins = 0
    list.forEach(j => {
      const a = j.attendance
      if (a?.checkin_at && a?.checkout_at) {
        totalMins += Math.max(0, (new Date(a.checkout_at) - new Date(a.checkin_at)) / 60000)
      } else if (a?.checkin_at) {
        totalMins += Math.max(0, (Date.now() - new Date(a.checkin_at)) / 60000)
      }
    })
    const h = Math.floor(totalMins / 60)
    const m = Math.floor(totalMins % 60)
    return { completed, total: list.length, hoursLabel: `${h}h ${m}m` }
  }, [jobs, tick])

  // The "active now" job — the one currently checked in
  const activeJob = (jobs || []).find(j => j.checkin_state === 'checked_in')
  const otherJobs = (jobs || []).filter(j => j.id !== activeJob?.id)

  const greeting = dbUser?.user_name ? `Hello, ${dbUser.user_name}` : 'Hello'
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div className="min-h-screen bg-hh-mint px-4 py-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-hh-placeholder">{dateLabel}</p>
          <h1 className="text-2xl font-bold text-hh-text">{greeting}</h1>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-gray-900 rounded-2xl px-5 py-4 flex items-center mb-5">
        <div className="flex-1">
          <p className="text-[10px] tracking-widest text-gray-400 font-semibold">HOURS TODAY</p>
          <p className="text-2xl font-bold text-white leading-tight">{stats.hoursLabel}</p>
        </div>
        <div className="w-px h-10 bg-gray-700 mx-4" />
        <div className="flex-1">
          <p className="text-[10px] tracking-widest text-gray-400 font-semibold">COMPLETED</p>
          <p className="text-2xl font-bold text-white leading-tight">{stats.completed} / {stats.total}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 mb-5">
        {['today', 'upcoming'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 text-sm font-semibold capitalize transition-colors
              ${tab === t ? 'text-hh-text border-b-2 border-hh-green' : 'text-hh-placeholder'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-hh-error text-sm rounded-hh px-3 py-2 mb-4">{error}</div>
      )}

      {jobs === null && (
        <div className="flex justify-center py-12">
          <span className="w-7 h-7 border-2 border-gray-300 border-t-hh-green rounded-full animate-spin" />
        </div>
      )}

      {jobs !== null && jobs.length === 0 && (
        <div className="text-center py-12 text-hh-placeholder">
          <p className="text-sm">No jobs assigned for today.</p>
        </div>
      )}

      {/* Active job — featured card */}
      {tab === 'today' && activeJob && (
        <FeaturedJobCard
          job={activeJob}
          busy={busyJobId === activeJob.id}
          onCheckOut={() => handleCheckOut(activeJob)}
          tick={tick}
        />
      )}

      {/* Remaining jobs */}
      {tab === 'today' && otherJobs.length > 0 && (
        <>
          <p className="text-[11px] tracking-widest text-hh-placeholder font-semibold mt-6 mb-3">
            REMAINING TODAY
          </p>
          <div className="space-y-3">
            {otherJobs.map(job => (
              <CompactJobCard
                key={job.id}
                job={job}
                busy={busyJobId === job.id}
                onCheckIn={() => handleCheckIn(job)}
                onCheckOut={() => handleCheckOut(job)}
                onOpen={() => navigate(`/helper/jobs/${job.id}`)}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'upcoming' && (
        <>
          {upcoming === null && (
            <div className="flex justify-center py-12">
              <span className="w-7 h-7 border-2 border-gray-300 border-t-hh-green rounded-full animate-spin" />
            </div>
          )}
          {upcoming !== null && upcoming.length === 0 && (
            <div className="text-center py-12 text-hh-placeholder">
              <p className="text-sm">No upcoming jobs scheduled.</p>
            </div>
          )}
          {upcoming !== null && upcoming.length > 0 && (
            <div className="space-y-3">
              {upcoming.map(job => (
                <UpcomingJobCard
                  key={job.id}
                  job={job}
                  onOpen={() => navigate(`/helper/jobs/${job.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Featured (active now) card ── */
function FeaturedJobCard({ job, busy, onCheckOut, tick }) {
  const a = job.attendance
  return (
    <div className="bg-white rounded-2xl shadow-hh overflow-hidden">
      <div className="bg-gradient-to-br from-green-100 to-green-50 h-32 relative flex items-start p-3">
        <span className="bg-hh-green text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-white rounded-full" /> ACTIVE NOW
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-hh-text">{job.job_name}</h2>
          <span className="text-hh-green text-sm font-semibold">{job.job_id}</span>
        </div>
        {job.job_location && (
          <p className="text-sm text-hh-placeholder mt-1">📍 {job.job_location}</p>
        )}

        <div className="flex items-end justify-between mt-4">
          <div>
            <span className="text-2xl font-bold text-hh-text">{fmtClock(job.job_start_time)}</span>
            {job.job_end_time && <span className="text-hh-placeholder"> – {fmtClock(job.job_end_time)}</span>}
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-widest text-hh-placeholder font-semibold">ON SITE</p>
            <p className="text-hh-green font-bold">{elapsed(a?.checkin_at)}</p>
          </div>
        </div>

        <button
          onClick={onCheckOut}
          disabled={busy}
          className="w-full mt-4 bg-hh-error text-white font-bold text-lg py-4 rounded-xl
            flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] transition-transform"
        >
          {busy ? 'Saving…' : '◻  CHECK OUT'}
        </button>
        {a?.checkin_at && (
          <p className="text-center text-xs text-hh-placeholder mt-2">
            Checked in at <span className="text-hh-green font-semibold">{fmtTime(a.checkin_at)}</span>
            {a.location_missing && <span className="text-hh-error"> · location off</span>}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── Upcoming card — read-only preview, tap to view full job details (read-only) ── */
function UpcomingJobCard({ job, onOpen }) {
  const fmtDate = (d) => {
    if (!d) return ''
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString(undefined,
        { weekday: 'short', month: 'short', day: 'numeric' })
    } catch { return d }
  }
  const daysLabel = {
    weekdays_only: 'Weekdays',
    weekends_only: 'Weekends',
    weekdays_and_weekends: 'Every day',
  }[job.job_days] || ''

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen() }}
      className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3
        cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-50 to-green-50 shrink-0
        flex items-center justify-center text-hh-green font-bold text-xs">
        {job.job_id?.replace('JOB-', '#') || 'JOB'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-hh-text truncate">{job.job_name}</h3>
          <span className="text-xs text-hh-placeholder shrink-0 ml-2">
            {fmtClock(job.job_start_time)}
          </span>
        </div>
        {job.job_location && (
          <p className="text-xs text-hh-placeholder truncate">{job.job_location}</p>
        )}
        <p className="text-xs text-hh-green font-medium mt-1">
          {job.is_recurring
            ? `${daysLabel} until ${fmtDate(job.upcoming_to)}`
            : fmtDate(job.upcoming_from)}
        </p>
      </div>
      <span className="text-hh-placeholder shrink-0">›</span>
    </div>
  )
}
function CompactJobCard({ job, busy, onCheckIn, onCheckOut, onOpen }) {
  const state = job.checkin_state
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-green-100 to-green-50 shrink-0
        flex items-center justify-center text-hh-green font-bold text-xs"
        onClick={onOpen} role="button">
        {job.job_id?.replace('JOB-', '#') || 'JOB'}
      </div>
      <div className="flex-1 min-w-0" onClick={onOpen} role="button">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-hh-text truncate">{job.job_name}</h3>
          <span className="text-xs text-hh-placeholder shrink-0 ml-2">{fmtClock(job.job_start_time)}</span>
        </div>
        {job.job_location && (
          <p className="text-xs text-hh-placeholder truncate">{job.job_location}</p>
        )}
        <div className="mt-1">
          {state === 'completed'
            ? <span className="text-xs text-hh-green font-semibold">✓ Done</span>
            : <span className="text-xs text-hh-placeholder">Scheduled</span>}
        </div>
      </div>
      {state === 'not_started' && (
        <button onClick={(e) => { e.stopPropagation(); onCheckIn() }} disabled={busy}
          className="bg-green-50 text-hh-green font-bold text-sm px-4 py-2 rounded-lg
            shrink-0 disabled:opacity-60 active:scale-95 transition-transform">
          {busy ? '…' : 'CHECK IN'}
        </button>
      )}
      {state === 'checked_in' && (
        <button onClick={(e) => { e.stopPropagation(); onCheckOut() }} disabled={busy}
          className="bg-hh-error text-white font-bold text-sm px-4 py-2 rounded-lg
            shrink-0 disabled:opacity-60 active:scale-95 transition-transform">
          {busy ? '…' : 'CHECK OUT'}
        </button>
      )}
    </div>
  )
}
