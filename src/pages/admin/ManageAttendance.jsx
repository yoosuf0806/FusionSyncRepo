import { useState, useEffect } from 'react'
import { MapPin, Flag, Pencil } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import MainLayout from '../../layouts/MainLayout'
import {
  getAllAttendanceRecords, correctAttendanceRecord, getAvailableReplacementWorkers,
} from '../../services/jobService'
import { exportAttendanceCSV, exportAttendanceExcel, exportAttendancePDF } from '../../utils/attendanceExport'
import {
  getLeaveRequestsToReview, reviewLeaveRequest, getOpenReplacementFlags, assignReplacement, getUsersOnLeave,
} from '../../services/leaveService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const todayStr = () => new Date().toISOString().slice(0, 10)
const weekAgoStr = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) }
const fmtDateTime = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) } catch { return '—' } }
const fmtTime = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '—' } }

function StatusBadge({ status, corrected }) {
  const v = status === 'completed' ? 'success' : status === 'not_started' ? 'muted' : null
  return (
    <span className="inline-flex items-center gap-1">
      {v
        ? <Badge variant={v} className="capitalize">{(status || '').replace('_', ' ')}</Badge>
        : <Badge className="border-transparent bg-blue-50 capitalize text-blue-600">{(status || '').replace('_', ' ')}</Badge>}
      {corrected && <Pencil className="h-3 w-3 text-warning" title={`Corrected ${fmtDateTime(corrected)}`} />}
    </span>
  )
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
  const [editing, setEditing] = useState(null)
  const [leaves, setLeaves] = useState(null)
  const [flags, setFlags] = useState(null)
  const [onLeave, setOnLeave] = useState(null)
  const [replacing, setReplacing] = useState(null)
  const [replSearch, setReplSearch] = useState('')
  const [replFrom, setReplFrom] = useState('')
  const [replTo, setReplTo] = useState('')

  const load = async () => {
    setRows(null); setError('')
    try { setRows(await getAllAttendanceRecords({ dateFrom, dateTo, viewerType })) }
    catch (e) { setError(e.message || 'Could not load attendance records'); setRows([]) }
  }
  useEffect(() => { load() }, [dateFrom, dateTo]) // eslint-disable-line

  const loadLeaves = async () => { setLeaves(null); try { setLeaves(await getLeaveRequestsToReview({ viewerType, statusFilter: 'pending' })) } catch { setLeaves([]) } }
  const loadFlags = async () => { setFlags(null); try { setFlags(await getOpenReplacementFlags()) } catch { setFlags([]) } }
  const loadOnLeave = async () => { setOnLeave(null); try { setOnLeave(await getUsersOnLeave()) } catch { setOnLeave([]) } }

  useEffect(() => {
    if (tab === 'leave' && leaves === null) loadLeaves()
    if (tab === 'replacements' && flags === null) loadFlags()
    if (tab === 'onleave' && onLeave === null) loadOnLeave()
  }, [tab]) // eslint-disable-line

  const handleReview = async (leaveId, decision) => {
    try { await reviewLeaveRequest(leaveId, decision, user?.id, null); await loadLeaves(); setFlags(null) }
    catch (e) { setError(e.message || 'Could not review leave') }
  }

  const filtered = (rows || []).filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (r.worker_name || '').toLowerCase().includes(q) || (r.job_name || '').toLowerCase().includes(q) || (r.job_code || '').toLowerCase().includes(q)
  })

  return (
    <MainLayout title="Manage Attendance">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Manage Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">View worker check-in/out records. Correct forgotten check-outs or mistaken taps.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leave">Leave Requests</TabsTrigger>
            <TabsTrigger value="onleave">On Leave</TabsTrigger>
            <TabsTrigger value="replacements">Replacements</TabsTrigger>
          </TabsList>

          {/* Attendance */}
          <TabsContent value="attendance" className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5"><Label>From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" /></div>
              <div className="flex flex-col gap-1.5"><Label>To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" /></div>
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5"><Label>Search</Label><Input placeholder="Worker, job name or ID" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>

            {error && <ErrorBanner message={error} onClose={() => setError('')} />}

            {rows !== null && filtered.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="mr-1 text-xs text-muted-foreground">Export {filtered.length} record{filtered.length > 1 ? 's' : ''}:</span>
                <Button variant="outline" size="sm" onClick={() => exportAttendanceCSV(filtered)}>CSV</Button>
                <Button variant="outline" size="sm" onClick={() => exportAttendanceExcel(filtered)}>Excel</Button>
                <Button variant="outline" size="sm" onClick={() => exportAttendancePDF(filtered)}>PDF</Button>
              </div>
            )}

            {rows === null ? <LoadingSpinner /> : filtered.length === 0 ? (
              <Card className="py-16 text-center text-sm text-muted-foreground">No attendance records for this period.</Card>
            ) : (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Worker</TableHead><TableHead>Job</TableHead><TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead><TableHead>Check Out</TableHead><TableHead>Hours</TableHead>
                      <TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5">{r.worker_name}{r.worker_type === 'supervisor' && <Badge variant="secondary" className="text-[10px]">SUP</Badge>}</span>
                        </TableCell>
                        <TableCell><span className="font-medium text-primary">{r.job_code}</span><span className="text-muted-foreground"> · {r.job_name}</span></TableCell>
                        <TableCell className="text-muted-foreground">{r.attendance_date}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">{fmtTime(r.checkin_at)}{r.location_missing && <Flag className="h-3 w-3 text-destructive" title="Location not captured" />}</span>
                        </TableCell>
                        <TableCell>{fmtTime(r.checkout_at)}</TableCell>
                        <TableCell className="text-muted-foreground">{r.total_hours != null ? `${r.total_hours}h` : '—'}</TableCell>
                        <TableCell>
                          {r.checkin_latitude != null && r.checkin_longitude != null ? (
                            <a href={`https://www.google.com/maps?q=${r.checkin_latitude},${r.checkin_longitude}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline" title={`${r.checkin_latitude}, ${r.checkin_longitude}`}>
                              <MapPin className="h-3 w-3" /> View
                            </a>
                          ) : r.location_missing ? <span className="text-xs text-destructive">Not captured</span> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><StatusBadge status={r.att_status} corrected={r.corrected_at} /></TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Correct</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="leave"><LeaveReviewList leaves={leaves} onReview={handleReview} /></TabsContent>
          <TabsContent value="onleave"><OnLeaveList rows={onLeave} /></TabsContent>

          <TabsContent value="replacements" className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[180px] flex-1 flex-col gap-1.5"><Label>Search</Label><Input value={replSearch} onChange={e => setReplSearch(e.target.value)} placeholder="Worker or job name" /></div>
              <div className="flex flex-col gap-1.5"><Label>From</Label><Input type="date" value={replFrom} onChange={e => setReplFrom(e.target.value)} className="w-auto" /></div>
              <div className="flex flex-col gap-1.5"><Label>To</Label><Input type="date" value={replTo} onChange={e => setReplTo(e.target.value)} className="w-auto" /></div>
              {(replSearch || replFrom || replTo) && <Button variant="ghost" size="sm" onClick={() => { setReplSearch(''); setReplFrom(''); setReplTo('') }}>Clear</Button>}
            </div>
            <ReplacementsList flags={filterReplacements(flags, replSearch, replFrom, replTo)} onReplace={(flag) => setReplacing(flag)} />
          </TabsContent>
        </Tabs>
      </div>

      {editing && <CorrectionModal row={editing} correctedBy={user?.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {replacing && <ReplacementModal flag={replacing} viewerId={user?.id} onClose={() => setReplacing(null)} onAssigned={() => { setReplacing(null); loadFlags() }} />}
    </MainLayout>
  )
}

function LeaveReviewList({ leaves, onReview }) {
  if (leaves === null) return <LoadingSpinner />
  if (leaves.length === 0) return <Card className="py-16 text-center text-sm text-muted-foreground">No pending leave requests.</Card>
  const reasonLabel = { sick: 'Sick', personal: 'Personal', emergency: 'Emergency', other: 'Other' }
  const durLabel = { full_day: 'Full Day', first_half: 'Morning', second_half: 'Afternoon' }
  return (
    <div className="space-y-3">
      {leaves.map(l => (
        <Card key={l.id} className="flex items-center justify-between p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{l.requester_name}</span>
              {l.requester_type === 'supervisor' && <Badge variant="secondary" className="text-[10px]">SUP</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {l.leave_date}{l.leave_to_date && l.leave_to_date !== l.leave_date ? ` – ${l.leave_to_date}` : ''} · {durLabel[l.duration]} · {reasonLabel[l.reason]}
            </p>
            {l.note && <p className="mt-1 text-xs italic text-muted-foreground">"{l.note}"</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => onReview(l.id, 'reject')}>Reject</Button>
            <Button onClick={() => onReview(l.id, 'approve')}>Approve</Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function OnLeaveList({ rows }) {
  if (rows === null) return <LoadingSpinner />
  if (rows.length === 0) return <Card className="py-16 text-center text-sm text-muted-foreground">No one is currently on leave.</Card>
  const dateLabel = (r) => r.is_range ? `${r.leave_date} → ${r.to_date}` : r.leave_date
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <Card key={r.id} className="flex items-center justify-between p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{r.person_name}</span>
              {r.person_type === 'supervisor' && <Badge variant="secondary" className="text-[10px]">SUPERVISOR</Badge>}
              {r.person_type === 'helper' && <Badge className="border-transparent bg-blue-50 text-[10px] text-blue-600">WORKER</Badge>}
              {r.active && <Badge variant="warning">On leave now</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel(r)} · {r.duration_label}</p>
            {r.note && <p className="mt-1 text-xs italic text-muted-foreground">"{r.note}"</p>}
          </div>
          <span className="text-xs capitalize text-muted-foreground">{r.reason}</span>
        </Card>
      ))}
    </div>
  )
}

function filterReplacements(groups, search, from, to) {
  if (groups === null) return null
  const q = (search || '').trim().toLowerCase()
  return groups.filter(g => {
    if (q) { const hay = `${g.job_name} ${g.job_code} ${g.absent_name}`.toLowerCase(); if (!hay.includes(q)) return false }
    if (from && g.to_date < from) return false
    if (to && g.from_date > to) return false
    return true
  })
}

function ReplacementsList({ flags, onReplace }) {
  if (flags === null) return <LoadingSpinner />
  if (flags.length === 0) return <Card className="py-16 text-center text-sm text-muted-foreground">No replacements needed. 🎉</Card>
  const dateLabel = (g) => g.from_date === g.to_date ? g.from_date : `${g.from_date} to ${g.to_date}`
  return (
    <div className="space-y-3">
      {flags.map(g => (
        <Card key={`${g.job_id}_${g.absent_user_id}_${g.from_date}`} className="flex items-center justify-between border-l-4 border-l-destructive p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary">{g.job_code}</span>
              <span className="font-semibold text-foreground">{g.job_name}</span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {g.absent_name} absent {dateLabel(g)}{g.flag_ids.length > 1 && <span className="ml-1 text-xs">({g.flag_ids.length} days)</span>}
            </p>
          </div>
          <Button onClick={() => onReplace(g)}>Replace worker</Button>
        </Card>
      ))}
    </div>
  )
}

function ReplacementModal({ flag, viewerId, onClose, onAssigned }) {
  const [fromDate, setFromDate] = useState(flag.from_date)
  const [toDate, setToDate] = useState(flag.to_date)
  const [helpers, setHelpers] = useState(null)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!fromDate || !toDate || toDate < fromDate) { setHelpers([]); return }
    setHelpers(null); setSelected('')
    getAvailableReplacementWorkers(flag.job_id, flag.absent_user_id, fromDate, toDate).then(list => setHelpers(list || [])).catch(() => setHelpers([]))
  }, [fromDate, toDate, flag])

  const save = async () => {
    if (!fromDate || !toDate) { setErr('Set the coverage dates.'); return }
    if (toDate < fromDate) { setErr('To date must be on or after From date.'); return }
    if (!selected) { setErr('Select a replacement worker.'); return }
    setSaving(true); setErr('')
    try { await assignReplacement(flag, selected, fromDate, toDate, viewerId); onAssigned() }
    catch (e) { setErr(e.message || 'Could not assign replacement'); setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Replace worker</DialogTitle>
          <DialogDescription>{flag.job_code} · {flag.job_name} · {flag.absent_name} absent</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label>From</Label><Input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); if (toDate < e.target.value) setToDate(e.target.value) }} /></div>
            <div className="flex flex-col gap-1.5"><Label>To</Label><Input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} /></div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Replacement worker {helpers && helpers.length === 0 && '(none available for this window)'}</Label>
            {helpers === null ? <p className="py-2 text-sm text-muted-foreground">Checking availability…</p> : (
              <Select value={selected || undefined} onValueChange={setSelected} disabled={helpers.length === 0}>
                <SelectTrigger><SelectValue placeholder="Select a worker…" /></SelectTrigger>
                <SelectContent>{helpers.map(h => <SelectItem key={h.id} value={h.id}>{h.user_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">Workers on leave or already booked in this window are hidden.</p>
          </div>
          {err && <ErrorBanner message={err} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !selected}>{saving ? 'Assigning…' : 'Assign replacement'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CorrectionModal({ row, correctedBy, onClose, onSaved }) {
  const toLocalInput = (iso) => {
    if (!iso) return ''
    const d = new Date(iso); const off = d.getTimezoneOffset()
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
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
      if (corrections.checkin_at && corrections.checkout_at && new Date(corrections.checkout_at) <= new Date(corrections.checkin_at)) {
        setErr('Check-out must be after check-in.'); setSaving(false); return
      }
      await correctAttendanceRecord(row.id, corrections, correctedBy, note || null)
      onSaved()
    } catch (e) { setErr(e.message || 'Could not save correction'); setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Correct attendance</DialogTitle>
          <DialogDescription>{row.worker_name} · {row.job_code} · {row.attendance_date}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5"><Label>Check in</Label><Input type="datetime-local" value={checkinAt} onChange={e => setCheckinAt(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label>Check out</Label><Input type="datetime-local" value={checkoutAt} onChange={e => setCheckoutAt(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label>Reason (optional)</Label><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. worker forgot to check out" className="min-h-[64px]" /></div>
          <p className="text-xs text-muted-foreground">The original values are kept for audit. This change is recorded against your account.</p>
          {err && <ErrorBanner message={err} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save correction'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
