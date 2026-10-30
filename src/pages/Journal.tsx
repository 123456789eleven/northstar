import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type JournalEntry } from '../db'
import { Card, Empty, PageHeader } from '../components/ui'
import ChartFrame from '../components/ChartFrame'
import { addDays, formatDate, today } from '../lib/dates'
import { EntryEditor } from '../features/journal/EntryEditor'
import { MoodChart } from '../features/journal/MoodChart'
import { groupByMonth, matchesSearch, moodSeries, onThisDay, wordCount, wordStreak } from '../features/journal/stats'
import '../features/journal/journal.css'

function EntryRow({ e, hidePreview, onOpen }: { e: JournalEntry; hidePreview: boolean; onOpen: (d: string) => void }) {
  const first = e.text.trim().split('\n')[0]
  return (
    <button className="jr-entry" onClick={() => onOpen(e.date)} aria-label={`Open ${formatDate(e.date)}`}>
      <span className="jr-entry-head">
        <span className="jr-entry-date">{formatDate(e.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="jr-entry-meta">
          {[e.mood ? `Mood ${e.mood}` : '', e.energy ? `Energy ${e.energy}` : '', `${wordCount(e.text)} words`].filter(Boolean).join(' · ')}
        </span>
      </span>
      {first && !hidePreview && <span className="jr-entry-body clamp">{first}</span>}
    </button>
  )
}

const HIDE_KEY = 'northstar.journal.hidePreviews'

export default function Journal() {
  const t = today()
  const entries = useLiveQuery(() => db.journal.toArray(), [])
  const [date, setDate] = useState(t)
  const [q, setQ] = useState('')
  const [hidePreview, setHidePreview] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
  })
  const togglePreview = () => {
    const v = !hidePreview
    setHidePreview(v)
    try { localStorage.setItem(HIDE_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }
  const written = (entries ?? []).filter((e) => e.text.trim()).length

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
        sub={entries === undefined ? ' ' : `${stats.streak ? `${stats.streak}-day streak · ` : ''}${written} ${written === 1 ? 'entry' : 'entries'} · private to this device`}
              />
      <div className="jr-grid">
        <div className="jr-col">
          <Card
            title={date === t ? `Today · ${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}` : formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            action={
              <span className="row jr-nav">
                <button className="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
                {date !== t && <button className="btn btn-ghost btn-sm" onClick={() => setDate(t)}>Today</button>}
                <button className="btn btn-ghost btn-sm" disabled={date >= t} onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
                <input className="jr-date" type="date" value={date} max={t} onChange={(e) => setDate(e.target.value || t)} aria-label="Jump to date" />
              </span>
            }
          >
            {entries !== undefined && <EntryEditor key={date} date={date} entry={current} />}
          </Card>
          <Card title="Earlier" action={<button className="btn btn-ghost btn-sm" onClick={togglePreview} aria-pressed={hidePreview}>{hidePreview ? 'Show previews' : 'Hide previews'}</button>}>
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
                      hidePreview={hidePreview}
                      onOpen={(d) => {
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
                  <div className="jr-entry-body clamp">{hidePreview ? 'Hidden' : e.text}</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
