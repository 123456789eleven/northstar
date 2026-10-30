// File importers for the Data Hub: .ics calendar and .vcf contacts, each with a preview before anything is saved.
import { useMemo, useRef, useState } from 'react'
import { Card } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { commitCalendar, commitContacts, existingNames, newCalendarEvents } from './dataActions'
import { MAX_FILE_BYTES, parseIcs, type IcsResult } from './ics'
import { parseVcf, type VcfResult } from './vcf'

async function readText(f: File): Promise<string> {
  if (f.size > MAX_FILE_BYTES) throw new Error('That file is over 5 MB. Export a smaller date range and try again.')
  return f.text()
}

function Picker({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button className="btn btn-primary" onClick={() => ref.current?.click()}>
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
    </>
  )
}

export function CalendarImport() {
  const [file, setFile] = useState('')
  const [res, setRes] = useState<(IcsResult & { fresh: number }) | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(f: File) {
    setErr('')
    setMsg('')
    try {
      const parsed = parseIcs(await readText(f))
      if (parsed.total === 0) throw new Error('No events found. Is this an .ics calendar file?')
      setFile(f.name)
      setRes({ ...parsed, fresh: (await newCalendarEvents(parsed.events)).length })
    } catch (e) {
      setRes(null)
      setErr(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }
  async function run() {
    if (!res) return
    setBusy(true)
    try {
      const r = await commitCalendar(file, res.events)
      setMsg(`Added ${r.added} event${r.added === 1 ? '' : 's'}, skipped ${r.skipped} already imported. Undo it from Import history below.`)
      setRes(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Calendar file (.ics)" action={<Picker label="Choose .ics file" accept=".ics,text/calendar" onFile={load} />}>
      <p className="small muted" style={{ margin: 0 }}>
        Export a calendar from Google, Apple or Outlook and pick the file. Repeating events are expanded up to a year ahead; multi-day events become one row per day. Read on this device only.
      </p>
      {err && <div className="small warn" style={{ marginTop: 8 }}>{err}</div>}
      {msg && <div className="small good" style={{ marginTop: 8 }}>{msg}</div>}
      {res && (
        <div style={{ marginTop: 12 }}>
          <div className="small">
            <strong>{file}</strong>: {res.events.length} event{res.events.length === 1 ? '' : 's'} found, <strong>{res.fresh}</strong> new, {res.events.length - res.fresh} already in your calendar.
          </div>
          {res.skipped.length > 0 && (
            <details className="small muted" style={{ marginTop: 6 }}>
              <summary>{res.skipped.length} skipped</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {res.skipped.slice(0, 20).map((s, i) => (
                  <li key={i}>
                    {s.title}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <tbody>
                {res.events.slice(0, 8).map((e, i) => (
                  <tr key={i}>
                    <td className="mono muted nowrap">{formatDate(e.date, { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                    <td className="mono muted nowrap">{e.allDay ? 'all day' : `${e.start ?? ''}${e.end ? `–${e.end}` : ''}`}</td>
                    <td>{e.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy || res.fresh === 0} onClick={() => void run()}>
              {res.fresh > 0 ? `Import ${res.fresh}` : 'Nothing new to import'}
            </button>
            <button className="btn btn-ghost" onClick={() => setRes(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

export function ContactsImport() {
  const [file, setFile] = useState('')
  const [res, setRes] = useState<VcfResult | null>(null)
  const [have, setHave] = useState<Set<string>>(new Set())
  const [off, setOff] = useState<Set<number>>(new Set())
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(f: File) {
    setErr('')
    setMsg('')
    try {
      const parsed = parseVcf(await readText(f))
      if (parsed.contacts.length === 0) throw new Error('No contacts with names found. Is this a .vcf file?')
      setFile(f.name)
      setHave(await existingNames())
      setOff(new Set())
      setRes(parsed)
    } catch (e) {
      setRes(null)
      setErr(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }
  const rows = useMemo(() => (res?.contacts ?? []).map((c, i) => ({ c, i, dup: have.has(c.name.trim().toLowerCase()) })), [res, have])
  const chosen = rows.filter((r) => !r.dup && !off.has(r.i))

  async function run() {
    setBusy(true)
    try {
      const r = await commitContacts(file, chosen.map((x) => x.c))
      setMsg(`Added ${r.added} contact${r.added === 1 ? '' : 's'}. Reminders are off for them until you set a cadence in People. Undo from Import history below.`)
      setRes(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Contacts file (.vcf)" action={<Picker label="Choose .vcf file" accept=".vcf,text/vcard,text/x-vcard" onFile={load} />}>
      <p className="small muted" style={{ margin: 0 }}>
        Names, birthdays, company/title and notes are imported. Phone numbers and emails are deliberately left out. Read on this device only.
      </p>
      {err && <div className="small warn" style={{ marginTop: 8 }}>{err}</div>}
      {msg && <div className="small good" style={{ marginTop: 8 }}>{msg}</div>}
      {res && (
        <div style={{ marginTop: 12 }}>
          <div className="small">
            <strong>{file}</strong>: {rows.length} contact{rows.length === 1 ? '' : 's'}
            {res.skipped > 0 && `, ${res.skipped} without a name skipped`}. Untick any you don’t want.
          </div>
          <div className="list" style={{ maxHeight: 280, overflowY: 'auto', marginTop: 6 }}>
            {rows.map(({ c, i, dup }) => (
              <label key={i} className="list-item small" style={{ opacity: dup ? 0.5 : 1 }}>
                <input type="checkbox" className="check" disabled={dup} checked={!dup && !off.has(i)} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })} />
                <span className="grow">
                  {c.name} {c.relation && <span className="faint">· {c.relation}</span>}
                </span>
                <span className="tiny faint">{dup ? 'already in People' : c.birthday ? `bday ${c.birthday}` : ''}</span>
              </label>
            ))}
          </div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy || chosen.length === 0} onClick={() => void run()}>
              {chosen.length > 0 ? `Import ${chosen.length}` : 'Nothing to import'}
            </button>
            <button className="btn btn-ghost" onClick={() => setRes(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
