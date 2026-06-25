import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import MainLayout from '../../layouts/MainLayout'
import {
  getAllAttendanceRecords, correctAttendanceRecord,
  getAvailableReplacementWorkers,
} from '../../services/jobService'
import {
  exportAttendanceCSV, exportAttendanceExcel, exportAttendancePDF,
} from '../../utils/attendanceExport'
import {
  getLeaveRequestsToReview, reviewLeaveRequest,
  getOpenReplacementFlags, assignReplacement,
} from '../../services/leaveService'

/* ────────────────────────────────────────────────────────────────────────
   ManageAttendance — internal team (admin/supervisor) view of all
   check-in/out records, with correction capability (forgotten checkout,
   wrong tap). Read-only display + a correction modal. No approval workflow.
──────────────────────────────────────────────────────────────────────────*/

const todayStr = () => new Date().toISOString().slice(0, 10)
const weekAgoStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) }
  catch { return '—' }
}
const fmtTime = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

const STATUS_STYLE = {
  not_started: 'bg-gray-100 text-gray-500',
  checked_in:  'bg-blue-50 text-blue-600',
  completed:   'bg-green-50 text-hh-green',
}

export default function ManageAttendance() {
  const { user, isAdmin } = useAuth()
  const viewerType = isAdmin ? 'admin' : 'supervisor'
  const [tab, setTab] = useState('attendance')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState(weekAgoStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)   // row being corrected
  const [leaves, setLeaves] = useState(null)
  const [flags, setFlags] = useState(null)
  const [replacing, setReplacing] = useState(null)  // flag being filled

  const load = async () => {
    setRows(null); setError('')
    try {
      const data = await getAllAttendanceRecords({ dateFrom, dateTo, viewerType })
      setRows(data)
    } catch (e) {
      setError(e.message || 'Could not load attendance records')
      setRows([])
    }
  }

  useEffect(() => { load() }, [dateFrom, dateTo])   // eslint-disable-line

  const loadLeaves = async () => {
    setLeaves(null)
    try {
      const data = await getLeaveRequestsToReview({ viewerType, statusFilter: 'pending' })
      setLeaves(data)
    } catch { setLeaves([]) }
  }
  const loadFlags = async () => {
    setFlags(null)
    try {
      const data = await getOpenReplacementFlags()
      setFlags(data)
    } catch { setFlags([]) }
  }

  useEffect(() => {
    if (tab === 'leave' && leaves === null) loadLeaves()
    if (tab === 'replacements' && flags === null) loadFlags()
  }, [tab])   // eslint-disable-line

  const handleReview = async (leaveId, decision) => {
    try {
      await reviewLeaveRequest(leaveId, decision, user?.id, null)
      await loadLeaves()
      // refresh flags too since approval creates them
      setFlags(null)
    } catch (e) {
      setError(e.message || 'Could not review leave')
    }
  }

  const filtered = (rows || []).filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (r.worker_name || '').toLowerCase().includes(q)
      || (r.job_name || '').toLowerCase().includes(q)
      || (r.job_code || '').toLowerCase().includes(q)
  })

  return (
    <MainLayout title="Manage Attendance">
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-hh-text mb-1">Manage Attendance</h1>
      <p className="text-sm text-hh-placeholder mb-5">
        View worker check-in/out records. Correct forgotten check-outs or mistaken taps.
      </p>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 mb-5">
        {[
          { key: 'attendance', label: 'Attendance' },
          { key: 'leave', label: 'Leave Requests' },
          { key: 'replacements', label: 'Replacements Needed' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-semibold transition-colors
              ${tab === t.key ? 'text-hh-text border-b-2 border-hh-green' : 'text-hh-placeholder'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'attendance' && (
      <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end mb-5">
        <div>
          <label className="block text-xs text-hh-placeholder mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="form-cell px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-hh-placeholder mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="form-cell px-3 py-1.5 text-sm" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-hh-placeholder mb-1">Search</label>
          <input type="text" placeholder="Worker, job name or ID"
            value={search} onChange={e => setSearch(e.target.value)}
            className="form-cell px-3 py-1.5 text-sm w-full" />
        </div>
      </div>

      {error && <div className="bg-red-50 text-hh-error text-sm rounded-hh px-3 py-2 mb-4">{error}</div>}

      {/* Export buttons */}
      {rows !== null && filtered.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-hh-placeholder mr-1">Export {filtered.length} record{filtered.length > 1 ? 's' : ''}:</span>
          <button onClick={() => exportAttendanceCSV(filtered)}
            className="text-xs font-medium px-3 py-1.5 rounded-hh border border-gray-300 hover:border-hh-green hover:text-hh-green transition-colors">
            CSV
          </button>
          <button onClick={() => exportAttendanceExcel(filtered)}
            className="text-xs font-medium px-3 py-1.5 rounded-hh border border-gray-300 hover:border-hh-green hover:text-hh-green transition-colors">
            Excel
          </button>
          <button onClick={() => exportAttendancePDF(filtered)}
            className="text-xs font-medium px-3 py-1.5 rounded-hh border border-gray-300 hover:border-hh-green hover:text-hh-green transition-colors">
            PDF
          </button>
        </div>
      )}

      {rows === null ? (
        <div className="flex justify-center py-16">
          <span className="w-7 h-7 border-2 border-gray-300 border-t-hh-green rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-hh-placeholder text-sm">
          No attendance records for this period.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-hh shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-hh-placeholder">
                <th className="px-3 py-2.5 font-medium">Worker</th>
                <th className="px-3 py-2.5 font-medium">Job</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Check In</th>
                <th className="px-3 py-2.5 font-medium">Check Out</th>
                <th className="px-3 py-2.5 font-medium">Hours</th>
                <th className="px-3 py-2.5 font-medium">Location</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-hh-mint/40">
                  <td className="px-3 py-2.5 font-medium text-hh-text">
                    {r.worker_name}
                    {r.worker_type === 'supervisor' && (
                      <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">SUP</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-hh-green font-medium">{r.job_code}</span>
                    <span className="text-hh-placeholder"> · {r.job_name}</span>
                  </td>
                  <td className="px-3 py-2.5">{r.attendance_date}</td>
                  <td className="px-3 py-2.5">
                    {fmtTime(r.checkin_at)}
                    {r.location_missing && (
                      <span className="ml-1 text-[10px] text-hh-error" title="Location not captured">⚑</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{fmtTime(r.checkout_at)}</td>
                  <td className="px-3 py-2.5">{r.total_hours != null ? `${r.total_hours}h` : '—'}</td>
                  <td className="px-3 py-2.5">
                    {r.checkin_latitude != null && r.checkin_longitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${r.checkin_latitude},${r.checkin_longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-hh-green hover:underline text-xs"
                        title={`${r.checkin_latitude}, ${r.checkin_longitude}`}
                      >
                        📍 View
                      </a>
                    ) : r.location_missing ? (
                      <span className="text-xs text-hh-error">Not captured</span>
                    ) : (
                      <span className="text-xs text-hh-placeholder">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[r.att_status] || ''}`}>
                      {(r.att_status || '').replace('_', ' ')}
                    </span>
                    {r.corrected_at && (
                      <span className="ml-1 text-[10px] text-amber-600" title={`Corrected ${fmtDateTime(r.corrected_at)}`}>✎</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="text-hh-green font-medium hover:underline text-xs">
                      Correct
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {/* ── LEAVE REQUESTS TAB ── */}
      {tab === 'leave' && (
        <LeaveReviewList leaves={leaves} onReview={handleReview} />
      )}

      {/* ── REPLACEMENTS NEEDED TAB ── */}
      {tab === 'replacements' && (
        <ReplacementsList
          flags={flags}
          onReplace={(flag) => setReplacing(flag)}
        />
      )}

      {editing && (
        <CorrectionModal
          row={editing}
          correctedBy={user?.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {replacing && (
        <ReplacementModal
          flag={replacing}
          onClose={() => setReplacing(null)}
          onAssigned={() => { setReplacing(null); loadFlags() }}
        />
      )}
    </div>
    </MainLayout>
  )
}

/* ── Leave review list ── */
function LeaveReviewList({ leaves, onReview }) {
  if (leaves === null) {
    return <div className="flex justify-center py-16">
      <span className="w-7 h-7 border-2 border-gray-300 border-t-hh-green rounded-full animate-spin" /></div>
  }
  if (leaves.length === 0) {
    return <div className="text-center py-16 text-hh-placeholder text-sm">No pending leave requests.</div>
  }
  const reasonLabel = { sick: 'Sick', personal: 'Personal', emergency: 'Emergency', other: 'Other' }
  const durLabel = { full_day: 'Full Day', first_half: 'Morning', second_half: 'Afternoon' }
  return (
    <div className="space-y-3">
      {leaves.map(l => (
        <div key={l.id} className="bg-white rounded-hh shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-hh-text">{l.requester_name}</span>
              {l.requester_type === 'supervisor' && (
                <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">SUP</span>
              )}
            </div>
            <p className="text-sm text-hh-placeholder mt-0.5">
              {l.leave_date}{l.leave_to_date && l.leave_to_date !== l.leave_date ? ` – ${l.leave_to_date}` : ''} · {durLabel[l.duration]} · {reasonLabel[l.reason]}
            </p>
            {l.note && <p className="text-xs text-hh-placeholder mt-1 italic">"{l.note}"</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onReview(l.id, 'reject')}
              className="px-4 py-2 text-sm font-medium text-hh-error border border-red-200 rounded-hh hover:bg-red-50">
              Reject
            </button>
            <button onClick={() => onReview(l.id, 'approve')}
              className="px-4 py-2 text-sm font-medium text-white bg-hh-green rounded-hh hover:opacity-90">
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Replacements-needed list ── */
function ReplacementsList({ flags, onReplace }) {
  if (flags === null) {
    return <div className="flex justify-center py-16">
      <span className="w-7 h-7 border-2 border-gray-300 border-t-hh-green rounded-full animate-spin" /></div>
  }
  if (flags.length === 0) {
    return <div className="text-center py-16 text-hh-placeholder text-sm">No replacements needed. 🎉</div>
  }
  const dateLabel = (g) => g.from_date === g.to_date
    ? g.from_date
    : `${g.from_date} to ${g.to_date}`
  return (
    <div className="space-y-3">
      {flags.map(g => (
        <div key={`${g.job_id}_${g.absent_user_id}_${g.from_date}`}
          className="bg-white rounded-hh shadow-sm p-4 flex items-center justify-between border-l-4 border-hh-error">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-hh-green font-semibold">{g.job_code}</span>
              <span className="font-semibold text-hh-text">{g.job_name}</span>
            </div>
            <p className="text-sm text-hh-placeholder mt-0.5">
              {g.absent_name} absent {dateLabel(g)}
              {g.flag_ids.length > 1 && (
                <span className="ml-1 text-xs text-hh-placeholder">({g.flag_ids.length} days)</span>
              )}
            </p>
          </div>
          <button onClick={() => onReplace(g)}
            className="px-4 py-2 text-sm font-medium text-white bg-hh-green rounded-hh hover:opacity-90">
            Replace Worker
          </button>
        </div>
      ))}
    </div>
  )
}

/* ── Replacement assignment modal ── */
function ReplacementModal({ flag, onClose, onAssigned }) {
  const [helpers, setHelpers] = useState(null)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    // Smart-filtered: exclude the absent worker, anyone already on the job, and
    // anyone on leave / booked during the coverage window.
    getAvailableReplacementWorkers(flag.job_id, flag.absent_user_id, flag.from_date, flag.to_date)
      .then(list => setHelpers(list || []))
      .catch(() => setHelpers([]))
  }, [flag])

  const save = async () => {
    if (!selected) { setErr('Select a replacement worker.'); return }
    setSaving(true); setErr('')
    try {
      await assignReplacement(flag.flag_ids, selected)  // fills the whole range
      onAssigned()
    } catch (e) {
      setErr(e.message || 'Could not assign replacement')
      setSaving(false)
    }
  }

  const dateLabel = flag.from_date === flag.to_date
    ? flag.from_date
    : `${flag.from_date} to ${flag.to_date}`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-hh-text mb-1">Replace Worker</h2>
        <p className="text-sm text-hh-placeholder mb-4">
          {flag.job_code} · {flag.job_name} · {dateLabel}
          {flag.flag_ids.length > 1 && <span className="ml-1">({flag.flag_ids.length} days)</span>}
        </p>

        <label className="block text-xs text-hh-placeholder mb-1">
          Replacement worker {helpers && helpers.length === 0 && '(none available for this window)'}
        </label>
        {helpers === null ? (
          <p className="text-sm text-hh-placeholder py-2">Checking availability…</p>
        ) : (
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="form-cell px-3 py-2 text-sm w-full mb-3">
            <option value="">Select a worker…</option>
            {helpers.map(h => (
              <option key={h.id} value={h.id}>{h.user_name}</option>
            ))}
          </select>
        )}

        {err && <div className="bg-red-50 text-hh-error text-sm rounded-hh px-3 py-2 mb-3">{err}</div>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-hh-placeholder">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-action px-6 disabled:opacity-50">
            {saving ? 'Assigning…' : 'Assign Replacement'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Correction modal ── */
function CorrectionModal({ row, correctedBy, onClose, onSaved }) {
  // Pre-fill datetime-local inputs from existing values
  const toLocalInput = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const off = d.getTimezoneOffset()
    const local = new Date(d.getTime() - off * 60000)
    return local.toISOString().slice(0, 16)
  }

  const [checkinAt, setCheckinAt] = useState(toLocalInput(row.checkin_at))
  const [checkoutAt, setCheckoutAt] = useState(toLocalInput(row.checkout_at))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setSaving(true); setErr('')
    try {
      const corrections = {}
      corrections.checkin_at = checkinAt ? new Date(checkinAt).toISOString() : null
      corrections.checkout_at = checkoutAt ? new Date(checkoutAt).toISOString() : null

      if (corrections.checkin_at && corrections.checkout_at
          && new Date(corrections.checkout_at) <= new Date(corrections.checkin_at)) {
        setErr('Check-out must be after check-in.')
        setSaving(false)
        return
      }

      await correctAttendanceRecord(row.id, corrections, correctedBy, note || null)
      onSaved()
    } catch (e) {
      setErr(e.message || 'Could not save correction')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}>
      <div className="bg-white rounded-hh-xl shadow-hh-lg w-full max-w-md p-5"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-hh-text mb-1">Correct Attendance</h2>
        <p className="text-sm text-hh-placeholder mb-4">
          {row.worker_name} · {row.job_code} · {row.attendance_date}
        </p>

        <label className="block text-xs text-hh-placeholder mb-1">Check In</label>
        <input type="datetime-local" value={checkinAt} onChange={e => setCheckinAt(e.target.value)}
          className="form-cell px-3 py-1.5 text-sm w-full mb-3" />

        <label className="block text-xs text-hh-placeholder mb-1">Check Out</label>
        <input type="datetime-local" value={checkoutAt} onChange={e => setCheckoutAt(e.target.value)}
          className="form-cell px-3 py-1.5 text-sm w-full mb-3" />

        <label className="block text-xs text-hh-placeholder mb-1">Reason for correction (optional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="e.g. worker forgot to check out"
          className="form-cell px-3 py-2 text-sm w-full h-16 resize-none mb-1" />

        <p className="text-[11px] text-hh-placeholder mb-4">
          The original values are kept for audit. This change is recorded against your account.
        </p>

        {err && <div className="bg-red-50 text-hh-error text-sm rounded-hh px-3 py-2 mb-3">{err}</div>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-hh-placeholder">Cancel</button>
          <button onClick={save} disabled={saving}
            className="btn-action px-6 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Correction'}
          </button>
        </div>
      </div>
    </div>
  )
}
