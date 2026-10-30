import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Card, Empty, PageHeader } from '../components/ui'
import DataTable from '../components/DataTable'
import KpiStrip from '../components/KpiStrip'
import StatusChip from '../components/StatusChip'
import { db } from '../db'
import { DATA_IMPORTS_KEY, undoDataImport, type DataImportRecord } from '../features/data/dataActions'
import { CalendarImport, ContactsImport } from '../features/data/Importers'
import { OFF_OPTIN_KEY } from '../features/data/offSearch'
import { undoImport } from '../features/finance/importActions'
import { IMPORTS_KEY, type ImportRecord } from '../features/finance/model'
import GoogleCalendarCard from '../features/gcal/GoogleCalendarCard'
import '../features/data/data.css'

interface Status {
  state?: string
  lastSyncedAt?: string
  count?: number
  pending?: number
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const STATE: Record<string, string> = { off: 'Off', connected: 'Connected', syncing: 'Syncing', error: 'Error', idle: 'On', ok: 'On' }

function Feeds({ types }: { types: [string, string?][] }) {
  return (
    <>
      {types.map(([label, key], i) => (
        <span key={label}>
          {i > 0 && ', '}
          {key ? <Link to={`/ontology?t=${key}`}>{label}</Link> : <span title="Shown on the calendar; not an ontology type yet">{label}</span>}
        </span>
      ))}
    </>
  )
}

interface Row {
  name: string
  brings: string
  feeds: [string, string?][]
  status: string
  tone?: 'good' | 'warn' | 'faint'
  last?: string
  rows?: string
  action: { label: string; to: string } | { label: string; href: string }
}

export default function DataHub() {
  const data = useLiveQuery(async () => {
    const s = async <T,>(k: string) => (await db.settings.get(k))?.value as T | undefined
    const [fin, dat, optin, sync, gcal] = await Promise.all([s<ImportRecord[]>(IMPORTS_KEY), s<DataImportRecord[]>(DATA_IMPORTS_KEY), s<boolean>(OFF_OPTIN_KEY), s<Status>('sync.status'), s<Status>('gcal.status')])
    const [tx, cal, ppl, tasks, meals, events] = await Promise.all([db.transactions.count(), db.calendar.count(), db.people.count(), db.tasks.count(), db.meals.count(), db.events.count()])
    return { fin: fin ?? [], dat: dat ?? [], optin: optin === true, sync, gcal, tx, cal, ppl, tasks, meals, events }
  }, [])
  if (!data) return <PageHeader title="Data" />
  const { fin, dat, optin, sync, gcal } = data
  const lastOf = (kind: DataImportRecord['kind']) => dat.find((r) => r.kind === kind)
  const sumOf = (kind: DataImportRecord['kind']) => dat.filter((r) => r.kind === kind).reduce((n, r) => n + r.added, 0)
  const syncOn = sync?.state && sync.state !== 'off'
  const gOn = gcal?.state && gcal.state !== 'off'

  const rows: Row[] = [
    { name: 'Bank CSV', brings: 'Transactions you download from your bank', feeds: [['Transaction', 'Transaction'], ['Budget', 'Budget']], status: fin.length ? 'Used' : 'Ready', tone: fin.length ? 'good' : 'faint', last: when(fin[0]?.at), rows: `${fin.reduce((n, r) => n + r.added, 0)} imported · ${data.tx} total`, action: { label: 'Open Finance import', to: '/finance' } },
    { name: 'Calendar file (.ics)', brings: 'Events from any calendar export', feeds: [['Calendar event']], status: lastOf('calendar') ? 'Used' : 'Ready', tone: lastOf('calendar') ? 'good' : 'faint', last: when(lastOf('calendar')?.at), rows: `${sumOf('calendar')} imported · ${data.cal} on calendar`, action: { label: 'Import below', href: '#import-calendar' } },
    { name: 'Google Calendar', brings: 'Events read from your Google Calendar (opt-in)', feeds: [['Calendar event']], status: STATE[gcal?.state ?? 'off'] ?? 'Off', tone: gOn ? (gcal?.state === 'error' ? 'warn' : 'good') : 'faint', last: when(gcal?.lastSyncedAt), rows: gcal?.count != null ? `${gcal.count} events` : undefined, action: { label: 'Connect below', href: '#gcal' } },
    { name: 'Contacts file (.vcf)', brings: 'Names, birthdays, company and notes', feeds: [['Person', 'Person']], status: lastOf('contacts') ? 'Used' : 'Ready', tone: lastOf('contacts') ? 'good' : 'faint', last: when(lastOf('contacts')?.at), rows: `${sumOf('contacts')} imported · ${data.ppl} people`, action: { label: 'Import below', href: '#import-contacts' } },
    { name: 'Food search (Open Food Facts)', brings: 'Calories and protein for packaged foods', feeds: [['Meal', 'Meal']], status: optin ? 'On (opt-in)' : 'Off', tone: optin ? 'good' : 'faint', action: { label: 'Open Food', to: '/food' } },
    { name: 'Built-in food reference', brings: '~150 staple foods, approximate values, works offline', feeds: [['Meal', 'Meal']], status: 'Always on', tone: 'good', action: { label: 'Open Food', to: '/food' } },
    { name: 'Backup file', brings: 'A full JSON export you restore yourself', feeds: [['Everything']], status: 'Manual', tone: 'faint', action: { label: 'Open Settings', to: '/settings' } },
    { name: 'Cloud sync', brings: 'Your data mirrored to your own cloud store (optional)', feeds: [['Everything']], status: syncOn ? (STATE[sync!.state!] ?? sync!.state!) : 'Off', tone: syncOn ? (sync?.state === 'error' ? 'warn' : 'good') : 'faint', last: when(sync?.lastSyncedAt), rows: sync?.pending ? `${sync.pending} pending` : undefined, action: { label: 'Open Settings', to: '/settings' } },
    { name: 'Manual & quick capture', brings: 'Things you type: tasks, meals, notes', feeds: [['Task', 'Task'], ['Meal', 'Meal'], ['Life event', 'LifeEvent']], status: 'Always on', tone: 'good', rows: `${data.tasks} tasks · ${data.meals} meals · ${data.events} events`, action: { label: 'Open Today', to: '/' } },
  ]

  // Per-batch history. Finance batches use the finance undo, others the data undo.
  const history = [
    ...fin.map((r) => ({ id: r.id, at: r.at, kind: 'Bank CSV', file: r.file, added: r.added, skipped: r.skipped, undo: () => undoImport(r.id), noun: 'transactions' })),
    ...dat.map((r) => ({ id: r.id, at: r.at, kind: r.kind === 'calendar' ? 'Calendar' : 'Contacts', file: r.file, added: r.added, skipped: r.skipped, undo: () => undoDataImport(r.id), noun: r.kind === 'calendar' ? 'events' : 'contacts' })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <>
      <PageHeader title="Data" sub="Every way data gets into Northstar, and where it goes." />

      <KpiStrip
        items={[
          { label: 'Sources in use', value: rows.filter((r) => r.tone === 'good').length, note: `of ${rows.length}` },
          { label: 'Import batches', value: history.length, note: history.length ? 'each can be undone' : 'none yet' },
          { label: 'Last import', value: history[0] ? when(history[0].at) : '—' },
        ]}
      />

      <Card title="Sources" flush>
        <DataTable
          label="Sources"
          rows={rows}
          rowKey={(r) => r.name}
          columns={[
            { key: 'src', header: 'Source', primary: true, render: (r) => (<span><span>{r.name}</span><span className="tiny faint"> · {r.brings}</span></span>) },
            { key: 'feeds', header: 'Feeds', render: (r) => <span className="small dh-feeds"><Feeds types={r.feeds} /></span> },
            { key: 'last', header: 'Last import', render: (r) => <span className="small muted nowrap">{r.last || '—'}</span> },
            { key: 'rows', header: 'Rows', render: (r) => <span className="small muted">{r.rows || '—'}</span> },
            { key: 'act', header: '', render: (r) =>
              'to' in r.action ? (
                <Link className="btn btn-sm" to={r.action.to}>{r.action.label}</Link>
              ) : (
                <button className="btn btn-sm" onClick={() => document.querySelector((r.action as { href: string }).href)?.scrollIntoView({ block: 'start' })}>{r.action.label}</button>
              ) },
            { key: 'status', header: 'Status', value: true, render: (r) => <StatusChip status={r.tone === 'good' ? 'good' : r.tone === 'warn' ? 'warn' : 'neutral'}>{r.status}</StatusChip> },
          ]}
        />
        <p className="small muted" style={{ margin: 0, padding: 16 }}>
          Where it goes: everything is stored in this browser on this device. Nothing leaves it except two things you turn on yourself: the food search, which sends only your search text to world.openfoodfacts.org, and optional sync / Google Calendar. Imported files are read locally and never uploaded.
        </p>
      </Card>

      <div className="stack" style={{ gap: 16, marginTop: 16 }}>
        <div id="import-calendar"><CalendarImport /></div>
        <div id="gcal"><GoogleCalendarCard /></div>
        <div id="import-contacts"><ContactsImport /></div>

        <Card title="Import history">
          {history.length === 0 ? (
            <Empty>No imports yet. Each file you import is kept as a batch here so you can undo it in one step.</Empty>
          ) : (
            <div className="list">
              {history.map((h) => (
                <div key={h.id} className="list-item small">
                  <div className="grow">
                    <div style={{ overflowWrap: 'anywhere' }}>
                      {h.kind} · {h.file}
                    </div>
                    <div className="tiny faint">
                      {when(h.at)} · {h.added} added · {h.skipped} skipped
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={async () => {
                      if (window.confirm(`Remove the ${h.added} ${h.noun} added by this import?`)) await h.undo()
                    }}
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
