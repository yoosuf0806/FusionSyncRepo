import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLUMNS = [
  { key: 'worker_name', label: 'Worker' },
  { key: 'worker_type', label: 'Role' },
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'pay', label: 'Pay' },
]

const fileStamp = () => new Date().toISOString().slice(0, 10)

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportPayrollCSV(rows, period = '') {
  const header = COLUMNS.map(c => c.label).join(',')
  const lines = rows.map(r => COLUMNS.map(c => {
    const val = String(r[c.key] ?? '')
    return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val
  }).join(','))
  const csv = [header, ...lines].join('\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `payroll_${period || fileStamp()}.csv`)
}

export function exportPayrollExcel(rows, period = '') {
  const sheetData = [COLUMNS.map(c => c.label), ...rows.map(r => COLUMNS.map(c => r[c.key] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.label.length + 2, 14) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll')
  XLSX.writeFile(wb, `payroll_${period || fileStamp()}.xlsx`)
}

export function exportPayrollPDF(rows, period = '') {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('FusionSync — Payroll Summary', 14, 14)
  doc.setFontSize(9)
  doc.text(`Period: ${period || 'all'} · Generated: ${new Date().toLocaleString()}`, 14, 20)
  autoTable(doc, {
    startY: 25,
    head: [COLUMNS.map(c => c.label)],
    body: rows.map(r => COLUMNS.map(c => String(r[c.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [36, 133, 65] },
  })
  doc.save(`payroll_${period || fileStamp()}.pdf`)
}
