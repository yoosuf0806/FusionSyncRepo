import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import MainLayout from '../../layouts/MainLayout'
import { getAllAttendanceRecords } from '../../services/jobService'
import { exportPayrollCSV, exportPayrollExcel, exportPayrollPDF } from '../../utils/payrollExport'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Payroll() {
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)   // index of worker whose jobs are shown

  const load = useCallback(async () => {
    setRows(null); setError('')
    try { setRows(await getAllAttendanceRecords({ dateFrom, dateTo, viewerType: 'admin' })) }
    catch (e) { setError(e.message || 'Could not load payroll data'); setRows([]) }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  // Aggregate approved attendance per worker, keeping the per-job breakdown
  const summary = useMemo(() => {
    const byWorker = {}
    for (const r of rows || []) {
      if (r.att_status && r.att_status !== 'approved' && r.att_status !== 'completed') continue
      const key = r.helper_id || r.worker_name
      const w = (byWorker[key] ||= { worker_name: r.worker_name || '—', worker_type: r.worker_type || 'helper', days: 0, hours: 0, pay: 0, jobs: [] })
      const hrs = Number(r.total_hours) || 0
      const pay = Number(r.rate_for_day) || 0
      w.days += 1
      w.hours += hrs
      w.pay += pay
      w.jobs.push({
        date: r.attendance_date,
        job_code: r.job_code || '—',
        job_name: r.job_name || '—',
        hours: Math.round(hrs * 100) / 100,
        pay: Math.round(pay * 100) / 100,
      })
    }
    return Object.values(byWorker)
      .map(w => ({ ...w, hours: Math.round(w.hours * 100) / 100, pay: Math.round(w.pay * 100) / 100 }))
      .sort((a, b) => b.pay - a.pay)
  }, [rows])

  const totals = useMemo(() => summary.reduce((t, w) => ({ days: t.days + w.days, hours: t.hours + w.hours, pay: t.pay + w.pay }), { days: 0, hours: 0, pay: 0 }), [summary])
  const period = `${dateFrom}_${dateTo}`
  const exportRows = summary.map(w => ({ ...w, hours: w.hours, pay: money(w.pay) }))

  return (
    <MainLayout title="Payroll">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">Approved worker hours and pay for the selected period. Computed from attendance × configured rate.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5"><Label>From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" /></div>
          <div className="flex flex-col gap-1.5"><Label>To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" /></div>
          {summary.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Export:</span>
              <Button variant="outline" size="sm" onClick={() => exportPayrollCSV(exportRows, period)}>CSV</Button>
              <Button variant="outline" size="sm" onClick={() => exportPayrollExcel(exportRows, period)}>Excel</Button>
              <Button variant="outline" size="sm" onClick={() => exportPayrollPDF(exportRows, period)}>PDF</Button>
            </div>
          )}
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {rows === null ? <LoadingSpinner /> : summary.length === 0 ? (
          <Card><EmptyState message="No approved attendance in this period" /></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Workers</div><div className="mt-1 text-2xl font-bold">{summary.length}</div></Card>
              <Card className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Shifts</div><div className="mt-1 text-2xl font-bold">{totals.days}</div></Card>
              <Card className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Total Hours</div><div className="mt-1 text-2xl font-bold">{Math.round(totals.hours * 100) / 100}</div></Card>
              <Card className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Total Pay</div><div className="mt-1 text-2xl font-bold text-primary">{money(totals.pay)}</div></Card>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Worker</TableHead><TableHead>Role</TableHead>
                    <TableHead className="text-right">Days</TableHead><TableHead className="text-right">Hours</TableHead><TableHead className="text-right">Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((w, i) => (
                    <Fragment key={i}>
                      <TableRow>
                        <TableCell className="font-medium text-foreground">{w.worker_name}</TableCell>
                        <TableCell><Badge variant="muted" className="capitalize">{w.worker_type}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">
                          <button
                            onClick={() => setExpanded(expanded === i ? null : i)}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            title="View the jobs counted in this payroll">
                            {w.days}
                            <span className="text-xs">{expanded === i ? '▲' : '▼'}</span>
                          </button>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{w.hours}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-primary">{money(w.pay)}</TableCell>
                      </TableRow>
                      {expanded === i && (
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell colSpan={5} className="p-0">
                            <div className="px-4 py-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Jobs counted for {w.worker_name}
                              </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-muted-foreground">
                                    <th className="py-1 pr-4 font-medium">Date</th>
                                    <th className="py-1 pr-4 font-medium">Job</th>
                                    <th className="py-1 pr-4 text-right font-medium">Hours</th>
                                    <th className="py-1 text-right font-medium">Pay</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {w.jobs.map((j, k) => (
                                    <tr key={k} className="border-t border-border/50">
                                      <td className="py-1 pr-4 tabular-nums text-muted-foreground">{j.date}</td>
                                      <td className="py-1 pr-4"><span className="text-primary">{j.job_code}</span> {j.job_name}</td>
                                      <td className="py-1 pr-4 text-right tabular-nums">{j.hours}</td>
                                      <td className="py-1 text-right tabular-nums">{money(j.pay)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  )
}
