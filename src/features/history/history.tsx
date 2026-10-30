import { useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AREAS, db, logEvent, type Area, type LifeEvent } from '../../db'
import { AREA_LABEL, Empty, Field, Modal } from '../../components/ui'
import { formatDate, parseISODate, toISODate, today } from '../../lib/dates'

const PAGE = 100
const EVENT_AREAS: LifeEvent['area'][] = [...AREAS, 'tasks', 'food']

const dayOf = (e: LifeEvent) => toISODate(new Date(e.at))
const timeOf = (e: LifeEvent) => new Date(e.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

function dayLabel(d: string) {
  const t = today()
  const diff = Math.round((parseISODate(t).getTime() - parseISODate(d).getTime()) / 86_400_000)
  const sameYear = d.slice(0, 4) === t.slice(0, 4)
  const base = formatDate(d, { weekday: 'long', month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
  if (diff === 0) return `Today · ${base}`
  if (diff === 1) return `Yesterday · ${base}`
  return base
}

async function removeEvent(e: LifeEvent) {
  if (e.id == null) return
  if (!confirm(`Remove “${e.title}” from your history?`)) return
  await db.events.delete(e.id)
}

export function Timeline() {
  const [area, setArea] = useState<'' | LifeEvent['area']>('')
  const [q, setQ] = useState('')
  const [pages, setPages] = useState(1)
  const needle = q.trim().toLowerCase()

  const rows = useLiveQuery(() => {
    let c = db.events.orderBy('at').reverse()
    if (area || needle) c = c.filter((e) => (!area || e.area === area) && (!needle || e.title.toLowerCase().includes(needle)))
    return c.limit(pages * PAGE + 1).toArray()
  }, [area, needle, pages])

  const hasMore = !!rows && rows.length > pages * PAGE
  const shown = useMemo(() => (rows ?? []).slice(0, pages * PAGE), [rows, pages])
  const days = useMemo(() => {
    const out: { day: string; items: LifeEvent[] }[] = []
    for (const e of shown) {
      const d = dayOf(e)
      const last = out[out.length - 1]
      if (last && last.day === d) last.items.push(e)
      else out.push({ day: d, items: [e] })
    }
    return out
  }, [shown])

  return (
    <div>
      <div className="hist-filters">
        <input className="input" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPages(1) }} placeholder="Search history" aria-label="Search history" />
        <select className="select" value={area} onChange={(e) => { setArea(e.target.value as LifeEvent['area']); setPages(1) }} aria-label="Filter by area">
          <option value="">All areas</option>
          {EVENT_AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
        </select>
      </div>
      {rows && days.length === 0 && (
        <Empty>
          {area || needle
            ? 'Nothing matches that filter.'
            : 'Your history fills itself as you complete tasks, log meals, contact people and finish goals. Add something worth remembering to start it now.'}
        </Empty>
      )}
      {days.map(({ day, items }) => (
        <section className="hist-day" key={day} aria-label={dayLabel(day)}>
          <div className="hist-day-head">
            <span>{dayLabel(day)}</span>
            <span className="faint">{items.length}</span>
          </div>
          {items.map((e) => (
            <div className="hist-item" key={e.id}>
              <span className="hist-time">{timeOf(e)}</span>
              <span className={e.milestone ? 'chip chip-accent hist-chip' : 'chip hist-chip'}>{AREA_LABEL[e.area] ?? e.area}</span>
              <span className={e.milestone ? 'hist-title is-milestone' : 'hist-title'}>{e.title}</span>
              <button className="btn btn-ghost hist-del" aria-label={`Remove ${e.title}`} onClick={() => removeEvent(e)}><XIcon /></button>
            </div>
          ))}
        </section>
      ))}
      {hasMore && (
        <div className="hist-more"><button className="btn" onClick={() => setPages((p) => p + 1)}>Load {PAGE} more</button></div>
      )}
    </div>
  )
}

export function Achievements() {
  const items = useLiveQuery(() => db.events.orderBy('at').reverse().filter((e) => e.milestone).toArray(), [])

  const years = useMemo(() => {
    const out: { year: string; total: number; areas: [string, number][]; months: { key: string; items: LifeEvent[] }[] }[] = []
    for (const e of items ?? []) {
      const d = dayOf(e)
      const year = d.slice(0, 4)
      const mk = d.slice(0, 7)
      let y = out[out.length - 1]
      if (!y || y.year !== year) { y = { year, total: 0, areas: [], months: [] }; out.push(y) }
      y.total++
      const m = y.months[y.months.length - 1]
      if (m && m.key === mk) m.items.push(e)
      else y.months.push({ key: mk, items: [e] })
    }
    for (const y of out) {
      const counts = new Map<string, number>()
      for (const m of y.months) for (const e of m.items) counts.set(e.area, (counts.get(e.area) ?? 0) + 1)
      y.areas = [...counts].sort((a, b) => b[1] - a[1])
    }
    return out
  }, [items])

  if (!items) return null
  if (items.length === 0)
    return <Empty>Milestones collect here: finished goals, completed courses, and anything you add with “Milestone” switched on.</Empty>

  return (
    <div>
      {years.map((y) => (
        <section className="ach-year" key={y.year}>
          <div className="ach-year-head">
            <h2><span className="ach-year-num">{y.year}</span><span className="ach-year-total">{y.total} {y.total === 1 ? 'milestone' : 'milestones'}</span></h2>
            <div className="ach-areas">
              {y.areas.map(([a, n]) => <span key={a}>{AREA_LABEL[a] ?? a} <b>{n}</b></span>)}
            </div>
          </div>
          {y.months.map((m) => (
            <div className="ach-month" key={m.key}>
              <div className="ach-month-name">{formatDate(`${m.key}-01`, { month: 'long' })}</div>
              <div className="ach-list">
                {m.items.map((e) => (
                  <div className="ach-entry" key={e.id}>
                    <span className="ach-entry-title">{e.title}</span>
                    <span className="ach-entry-meta">{AREA_LABEL[e.area] ?? e.area} · {formatDate(dayOf(e))}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** Events from today's month-day in earlier years. Renders nothing if there are none. */
export function OnThisDay() {
  const t = today()
  const md = t.slice(5)
  const year = t.slice(0, 4)
  const items = useLiveQuery(
    () => db.events.filter((e) => { const d = dayOf(e); return d.slice(5) === md && d.slice(0, 4) < year }).toArray(),
    [md, year],
  )
  if (!items || items.length === 0) return null
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <section className="card hist-past">
      <div className="card-title"><span>This day in past years</span></div>
      {sorted.slice(0, 8).map((e) => (
        <div className="hist-past-item" key={e.id}>
          <span className="hist-past-year">{dayOf(e).slice(0, 4)}</span>
          <span className="grow">{e.title}</span>
          <span className="faint small">{AREA_LABEL[e.area] ?? e.area}</span>
        </div>
      ))}
    </section>
  )
}

export function AddEntry({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today())
  const [area, setArea] = useState<Area>('personal')
  const [milestone, setMilestone] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const at = date === today() ? new Date().toISOString() : new Date(parseISODate(date).setHours(12)).toISOString()
    await logEvent({ area, kind: 'manual', title: title.trim(), milestone, at })
    onClose()
  }

  return (
    <Modal title="Something worth remembering" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label="What happened">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required maxLength={200} placeholder="Ran my first 10k" />
        </Field>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <Field label="Date">
            <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} />
          </Field>
          <Field label="Area">
            <select className="select" value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
            </select>
          </Field>
        </div>
        <label className="hist-toggle">
          <input type="checkbox" className="check" checked={milestone} onChange={(e) => setMilestone(e.target.checked)} />
          <span>Milestone <span className="faint small">— also show it on Achievements</span></span>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Add to history</button>
        </div>
      </form>
    </Modal>
  )
}
