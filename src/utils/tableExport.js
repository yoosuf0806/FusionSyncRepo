import * as XLSX from 'xlsx'

// Generic CSV / Excel export for a simple list of rows.
// columns: [{ key, label }]; rows: array of objects; name: base file name.

const fileStamp = () => new Date().toISOString().slice(0, 10)

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportTableCSV(columns, rows, name = 'export') {
  const header = columns.map(c => c.label).join(',')
  const lines = rows.map(r => columns.map(c => {
    const val = String(r[c.key] ?? '')
    return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val
  }).join(','))
  const csv = [header, ...lines].join('\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${name}_${fileStamp()}.csv`)
}

export function exportTableExcel(columns, rows, name = 'export', sheetName = 'Sheet1') {
  const sheetData = [columns.map(c => c.label), ...rows.map(r => columns.map(c => r[c.key] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = columns.map(c => ({ wch: Math.max(c.label.length + 2, 14) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${name}_${fileStamp()}.xlsx`)
}
