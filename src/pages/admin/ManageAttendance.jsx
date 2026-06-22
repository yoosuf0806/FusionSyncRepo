import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAllAttendanceRecords, correctAttendanceRecord,
} from '../../services/jobService'

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
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState(weekAgoStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)   // row being corrected

  const load = async () => {
    setRows(null); setError('')
    try {
      const data = await getAllAttendanceRecords({ dateFrom, dateTo })
      setRows(data)
    } catch (e) {
      setError(e.message || 'Could not load attendance records')
      setRows([])
    }
  }

  useEffect(() => { load() }, [dateFrom, dateTo])   // eslint-disable-line

  const filtered = (rows || []).filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (r.worker_name || '').toLowerCase().includes(q)
      || (r.job_name || '').toLowerCase().includes(q)
      || (r.job_code || '').toLowerCase().includes(q)
  })

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-hh-text mb-1">Manage Attendance</h1>
      <p className="text-sm text-hh-placeholder mb-5">
        View worker check-in/out records. Correct forgotten check-outs or mistaken taps.
      </p>

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

      {editing && (
        <CorrectionModal
          row={editing}
          correctedBy={user?.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
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
