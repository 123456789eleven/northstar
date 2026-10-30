import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type JournalEntry } from '../db'
import { Card, Empty, PageHeader } from '../components/ui'
import ChartFrame from '../components/ChartFrame'
import KpiStrip from '../components/KpiStrip'
import { formatDate, today } from '../lib/dates'
import { EntryEditor } from '../features/journal/EntryEditor'
import { MoodChart } from '../features/journal/MoodChart'
import { groupByMonth, matchesSearch, moodSeries, onThisDay, wordCount, wordStreak } from '../features/journal/stats'
import '../features/journal/journal.css'

function EntryRow({ e, onEdit }: { e: JournalEntry; onEdit: (d: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="jr-entry">
      <button className="jr-entry-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="jr-entry-date">{formatDate(e.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="jr-entry-meta">
          {[e.mood ? `Mood ${e.mood}` : '', e.energy ? `Energy ${e.energy}` : '', `${wordCount(e.text)} words`].filter(Boolean).join(' · ')}
        </span>
      </button>
      {e.text.trim() && <div className={`jr-entry-body ${open ? '' : 'clamp'}`}>{e.text}</div>}
      {open && (
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(e.date)}>
          Edit
        </button>
      )}
    </div>
  )
}

export default function Journal() {
  const t = today()
  const entries = useLiveQuery(() => db.journal.toArray(), [])
  const [date, setDate] = useState(t)
  const [q, setQ] = useState('')

  const current = entries?.find((e) => e.date === date)
  const stats = useMemo(() => {
    const all = entries ?? []
    return { streak: wordStreak(all, t), series: moodSeries(all, t, 90), then: onThisDay(all, t), hasMood: all.some((e) => e.mood) }
  }, [entries, t])
  const groups = useMemo(() => groupByMonth((entries ?? []).filter((e) => e.date !== date && (e.text.trim() || e.mood) && matchesSearch(e, q))), [entries, date, q])

  return (
    <>
      <PageHeader
        title="Journal"
        sub={entries === undefined ? ' ' : stats.streak ? `${stats.streak}-day writing streak` : 'Private to this device'}
        actions={date !== t && <button className="btn" onClick={() => setDate(t)}>Back to today</button>}
      />
      {entries !== undefined && (
        <KpiStrip
          items={[
            { label: 'Writing streak', value: stats.streak, note: stats.streak === 1 ? 'day' : 'days' },
            { label: 'Entries', value: entries.filter((e) => e.text.trim()).length },
            { label: 'This month', value: entries.filter((e) => e.text.trim() && e.date.startsWith(t.slice(0, 7))).length },
          ]}
        />
      )}
      <div className="jr-grid">
        <div className="jr-col">
          <Card title={date === t ? 'Today' : formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}>
            {entries !== undefined && <EntryEditor key={date} date={date} entry={current} />}
          </Card>
          <Card title="Earlier">
            <input className="input" style={{ marginBottom: 14 }} type="search" placeholder="Search entries or #tags" aria-label="Search journal" value={q} onChange={(e) => setQ(e.target.value)} />
            {groups.length === 0 ? (
              <Empty>{q ? 'Nothing matches.' : 'Past entries will collect here, grouped by month.'}</Empty>
            ) : (
              groups.map((g) => (
                <div key={g.month}>
                  <div className="jr-month">{formatDate(`${g.month}-01`, { month: 'long', year: 'numeric' })}</div>
                  {g.entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      e={e}
                      onEdit={(d) => {
                        setDate(d)
                        window.scrollTo({ top: 0 })
                      }}
                    />
                  ))}
                </div>
              ))
            )}
          </Card>
        </div>
        <div className="jr-col">
          <ChartFrame
            title="Mood, 90 days"
            hasData={stats.hasMood}
            table={
              <table className="table">
                <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Mood</th></tr></thead>
                <tbody>{stats.series.filter((p) => p.mood != null).reverse().slice(0, 30).map((p) => <tr key={p.date}><td>{formatDate(p.date, { month: 'short', day: 'numeric' })}</td><td className="mono" style={{ textAlign: 'right' }}>{p.mood}</td></tr>)}</tbody>
              </table>
            }
          >
            <MoodChart data={stats.series} />
          </ChartFrame>
          {stats.then.length > 0 && (
            <Card title="On this day">
              {stats.then.map((e) => (
                <div key={e.id} className="jr-then">
                  <div className="jr-entry-meta">{e.date.slice(0, 4)}</div>
                  <div className="jr-entry-body clamp">{e.text}</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
