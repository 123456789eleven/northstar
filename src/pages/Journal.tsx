import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type JournalEntry } from '../db'
import { Card, Empty, PageHeader, Skeleton } from '../components/ui'
import ChartFrame from '../components/ChartFrame'
import { addDays, formatDate, today } from '../lib/dates'
import { EntryEditor } from '../features/journal/EntryEditor'
import { MoodChart } from '../features/journal/MoodChart'
import { groupByMonth, matchesSearch, moodSeries, wordCount, wordStreak } from '../features/journal/stats'
import { highlight, lookback, snippet, tagCounts } from '../features/journal/insights'
import { MonthMap } from '../features/journal/MonthMap'
import { useJournalPrefs } from '../features/journal/prefs'
import '../features/journal/journal.css'

function Hl({ text, q }: { text: string; q: string }) {
  return <>{highlight(text, q).map((s, i) => (s.hit ? <mark key={i} className="jr-hit">{s.text}</mark> : <span key={i}>{s.text}</span>))}</>
}

function EntryRow({ e, hidePreview, q, onOpen }: { e: JournalEntry; hidePreview: boolean; q: string; onOpen: (d: string) => void }) {
  const first = snippet(e.text, q)
  return (
    <button className="jr-entry" onClick={() => onOpen(e.date)}>
      <span className="jr-entry-head">
        <span className="jr-entry-date">{formatDate(e.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="jr-entry-meta">
          {[e.mood ? `Mood ${e.mood}` : '', e.energy ? `Energy ${e.energy}` : '', `${wordCount(e.text)} words`].filter(Boolean).join(' · ')}
        </span>
      </span>
      {first && !hidePreview && <span className="jr-entry-body clamp"><Hl text={first} q={q} /></span>}
    </button>
  )
}

function ReadingView({ entry, onEdit }: { entry: JournalEntry; onEdit: () => void }) {
  return (
    <div className="stack">
      <article className="jr-read" aria-label="Entry">{entry.text}</article>
      <div className="jr-foot">
        <span>{[entry.mood ? `Mood ${entry.mood}` : '', entry.energy ? `Energy ${entry.energy}` : '', (entry.tags ?? []).map((x) => `#${x}`).join(' ')].filter(Boolean).join(' · ') || 'No mood or tags'}</span>
        <span>{wordCount(entry.text)} words</span>
      </div>
      <div className="row"><button className="btn btn-sm" onClick={onEdit}>Edit</button><button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print</button></div>
    </div>
  )
}

const HIDE_KEY = 'northstar.journal.hidePreviews'

export default function Journal() {
  const t = today()
  const entries = useLiveQuery(() => db.journal.toArray(), [])
  const [date, setDate] = useState(t)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [prefs, setPrefs] = useJournalPrefs()
  const open = (d: string) => { setDate(d); setEditing(false) }
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
  const reading = date !== t && !editing && !!current?.text.trim()
  const stats = useMemo(() => {
    const all = entries ?? []
    return { streak: wordStreak(all, t), series: moodSeries(all, t, 90), then: lookback(all, t), tags: tagCounts(all).slice(0, 8), hasMood: all.some((e) => e.mood) }
  }, [entries, t])
  const groups = useMemo(() => groupByMonth((entries ?? []).filter((e) => e.date !== date && (e.text.trim() || e.mood) && matchesSearch(e, q) && (!tag || (e.tags ?? []).includes(tag)))), [entries, date, q, tag])

  return (
    <>
      <PageHeader
        title="Journal"
        sub={entries === undefined ? ' ' : `${stats.streak ? `${stats.streak}-day streak · ` : ''}${written} ${written === 1 ? 'entry' : 'entries'} · private to this device`}
              />
      <div className="jr-grid">
        <div className="jr-col">
          <Card
            className={reading ? 'jr-reading-card' : ''}
            title={date === t ? `Today · ${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}` : formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            action={
              <span className="row jr-nav">
                <button className="btn btn-ghost btn-sm" onClick={() => open(addDays(date, -1))} aria-label="Previous day">‹</button>
                {date !== t && <button className="btn btn-ghost btn-sm" onClick={() => open(t)}>Today</button>}
                <button className="btn btn-ghost btn-sm" disabled={date >= t} onClick={() => open(addDays(date, 1))} aria-label="Next day">›</button>
                <input className="jr-date" type="date" value={date} max={t} onChange={(e) => open(e.target.value || t)} aria-label="Jump to date" />
              </span>
            }
          >
            {entries === undefined && <Skeleton lines={6} label="Loading journal" />}
            {entries !== undefined && (reading && current
              ? <ReadingView entry={current} onEdit={() => setEditing(true)} />
              : <EntryEditor key={date} date={date} entry={current} entries={entries} prefs={prefs} onPref={setPrefs} />)}
          </Card>
          <Card title="Earlier" action={<button className="btn btn-ghost btn-sm" onClick={togglePreview} aria-pressed={hidePreview}>{hidePreview ? 'Show previews' : 'Hide previews'}</button>}>
            <input className="input" style={{ marginBottom: 10 }} type="search" placeholder="Search entries or #tags (stays on this device)" aria-label="Search journal" value={q} onChange={(e) => setQ(e.target.value)} />
            {stats.tags.length > 0 && (
              <div className="row wrap" style={{ marginBottom: 12 }} role="group" aria-label="Filter by tag">
                {stats.tags.map((x) => (
                  <button key={x.tag} type="button" className={`chip jr-chip ${tag === x.tag ? 'chip-accent' : ''}`} aria-pressed={tag === x.tag} onClick={() => setTag(tag === x.tag ? null : x.tag)}>#{x.tag} <span className="muted">{x.n}</span></button>
                ))}
              </div>
            )}
            {groups.length === 0 ? (
              <Empty>{q || tag ? 'Nothing matches.' : 'Past entries will collect here, grouped by month.'}</Empty>
            ) : (
              groups.map((g) => (
                <div key={g.month}>
                  <div className="jr-month">{formatDate(`${g.month}-01`, { month: 'long', year: 'numeric' })}</div>
                  {g.entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      e={e}
                      hidePreview={hidePreview}
                      q={q}
                      onOpen={(d) => {
                        open(d)
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
          <MonthMap entries={entries ?? []} goal={prefs.goal} selected={date} onOpen={(d) => { open(d); window.scrollTo({ top: 0 }) }} />
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
              {stats.then.map(({ entry: e, label }) => (
                <button key={e.id} className="jr-then jr-entry" onClick={() => { open(e.date); window.scrollTo({ top: 0 }) }}>
                  <span className="jr-entry-meta">{label} · {formatDate(e.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span className="jr-entry-body clamp">{hidePreview ? 'Hidden' : e.text}</span>
                </button>
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
