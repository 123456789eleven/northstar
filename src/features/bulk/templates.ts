// CSV templates for Add many: a header row plus two example rows, built in the browser (Blob). No network.
import { addDays, today } from '../../lib/dates'
import type { BulkKind } from './parse'

export const TEMPLATE_KINDS: BulkKind[] = ['transactions', 'people', 'tasks']

export function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function templateRows(kind: BulkKind, now: string = today()): string[][] | null {
  switch (kind) {
    case 'transactions':
      return [
        ['Date', 'Description', 'Amount', 'Category'],
        [addDays(now, -2), 'Kroger', '-42.50', 'Groceries'],
        [addDays(now, -1), 'Paycheck', '2500.00', 'Income'],
      ]
    case 'people':
      return [
        ['Name', 'Relationship', 'Cadence', 'Birthday', 'Notes'],
        ['Alex Rivera', 'Friend', 'every 30 days', '03-14', 'Met at college'],
        ['Mom', 'Family', 'every 7 days', '09-02', ''],
      ]
    case 'tasks':
      return [
        ['Task', 'Due', 'Priority', 'Repeat', 'Notes'],
        ['Renew passport', addDays(now, 14), 'high', '', 'Needs a new photo'],
        ['Water the plants', '', 'low', 'weekly', ''],
      ]
    default:
      return null
  }
}

export function templateCsv(kind: BulkKind, now?: string): string | null {
  const rows = templateRows(kind, now)
  return rows ? rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n' : null
}

export function downloadTemplate(kind: BulkKind) {
  const csv = templateCsv(kind)
  if (!csv) return
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `northstar-${kind}-template.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
