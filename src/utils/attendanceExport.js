import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* Columns shown in every export */
const COLUMNS = [
  { key: 'worker_name',     label: 'Worker' },
  { key: 'worker_type',     label: 'Role' },
  { key: 'job_code',        label: 'Job ID' },
  { key: 'job_name',        label: 'Job Name' },
  { key: 'attendance_date', label: 'Date' },
  { key: 'checkin_time',    label: 'Check In' },
  { key: 'checkout_time',   label: 'Check Out' },
  { key: 'total_hours',     label: 'Hours' },
  { key: 'att_status',      label: 'Status' },
  { key: 'location',        label: 'Location (lat,lng)' },
]

const fmtTime = (iso) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

/* Flatten a raw attendance row into export-ready fields */
function toExportRow(r) {
  return {
    worker_name: r.worker_name || '',
    worker_type: r.worker_type || 'helper',
    job_code: r.job_code || '',
    job_name: r.job_name || '',
    attendance_date: r.attendance_date || '',
    checkin_time: fmtTime(r.checkin_at),
    checkout_time: fmtTime(r.checkout_at),
    total_hours: r.total_hours != null ? r.total_hours : '',
    att_status: (r.att_status || '').replace('_', ' '),
    location: (r.checkin_latitude != null && r.checkin_longitude != null)
      ? `${r.checkin_latitude}, ${r.checkin_longitude}`
      : (r.location_missing ? 'Not captured' : ''),
  }
}

function fileStamp() {
  return new Date().toISOString().slice(0, 10)
}

/* ── CSV ── */
export function exportAttendanceCSV(rows) {
  const data = rows.map(toExportRow)
  const header = COLUMNS.map(c => c.label).join(',')
  const lines = data.map(row =>
    COLUMNS.map(c => {
      const val = String(row[c.key] ?? '')
      // Escape quotes/commas
      return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val
    }).join(',')
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `attendance_${fileStamp()}.csv`)
}

/* ── Excel (XLSX) ── */
export function exportAttendanceExcel(rows) {
  const data = rows.map(toExportRow)
  const sheetData = [
    COLUMNS.map(c => c.label),
    ...data.map(row => COLUMNS.map(c => row[c.key] ?? '')),
  ]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.label.length + 2, 14) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
  XLSX.writeFile(wb, `attendance_${fileStamp()}.xlsx`)
}

/* ── PDF ── */
export function exportAttendancePDF(rows) {
  const data = rows.map(toExportRow)
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('FusionSync — Attendance Report', 14, 14)
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20)

  autoTable(doc, {
    startY: 25,
    head: [COLUMNS.map(c => c.label)],
    body: data.map(row => COLUMNS.map(c => String(row[c.key] ?? ''))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [76, 175, 80] },   // hh-green
  })

  doc.save(`attendance_${fileStamp()}.pdf`)
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
