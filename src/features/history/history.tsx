import { useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AREAS, db, logEvent, type Area, type LifeEvent } from '../../db'
import { AREA_LABEL, Empty, Field, Modal } from '../../components/ui'
import { formatDate, parseISODate, today } from '../../lib/dates'
import { countByArea, dayOf, groupByWeek, weekLabel } from './group'

const PAGE = 100
const EVENT_AREAS: LifeEvent['area'][] = [...AREAS, 'tasks', 'food']

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

/** Highlights the search match inside a title (accent text, no background). */
function Hit({ text, needle }: { text: string; needle: string }) {
  const i = needle ? text.toLowerCase().indexOf(needle) : -1
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i)}<mark className="hist-hit">{text.slice(i, i + needle.length)}</mark>{text.slice(i + needle.length)}</>
}

function AreaChips<T extends string>({ value, onChange, areas, label }: { value: '' | T; onChange: (v: '' | T) => void; areas: T[]; label: string }) {
  return (
    <div className="hist-chips" role="group" aria-label={label}>
      <button type="button" className="hist-chipbtn" aria-pressed={value === ''} onClick={() => onChange('')}>All</button>
      {areas.map((a) => (
        <button type="button" key={a} className="hist-chipbtn" aria-pressed={value === a} onClick={() => onChange(value === a ? '' : a)}>{AREA_LABEL[a as LifeEvent['area']] ?? a}</button>
      ))}
    </div>
  )
}

export function Timeline({ onAdd }: { onAdd: () => void }) {
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
  const weeks = useMemo(() => groupByWeek(shown), [shown])
  const filtered = !!area || !!needle
  const clear = () => { setQ(''); setArea(''); setPages(1) }

  return (
    <div>
      <div className="hist-filters">
        <input className="input" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPages(1) }} placeholder="Search history" aria-label="Search history" />
        <AreaChips<LifeEvent['area']> value={area} onChange={(v) => { setArea(v); setPages(1) }} areas={EVENT_AREAS} label="Filter by area" />
      </div>
      {filtered && shown.length > 0 && (
        <div className="hist-result small faint" role="status">
          <span>
            {shown.length}{hasMore ? '+' : ''} {shown.length === 1 ? 'entry' : 'entries'}
            {area ? ` in ${AREA_LABEL[area]}` : ''}{needle ? ` matching “${q.trim()}”` : ''}
          </span>
          <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '0 10px' }} onClick={clear}>Clear filters</button>
        </div>
      )}
      {rows && weeks.length === 0 && (
        <Empty>
          {filtered ? (
            <>Nothing matches that filter.<br /><button className="btn btn-sm" style={{ marginTop: 10 }} onClick={clear}>Clear filters</button></>
          ) : (
            <>Your history fills itself as you complete tasks, log meals, contact people and finish goals.<br /><button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={onAdd}>Add something worth remembering</button></>
          )}
        </Empty>
      )}
      {weeks.map((w) => (
        <section className="hist-week" key={w.weekOf} aria-label={weekLabel(w.weekOf)}>
          <h2 className="hist-week-head">
            <span>{weekLabel(w.weekOf)}</span>
            <span className="faint">{w.count} {w.count === 1 ? 'entry' : 'entries'}</span>
          </h2>
          {w.days.map(({ day, items }) => (
            <div className="hist-day" key={day}>
              <div className="hist-day-head">
                <span>{dayLabel(day)}</span>
                <span className="faint">{items.length}</span>
              </div>
              {items.map((e) => (
                <div className="hist-item" key={e.id}>
                  <span className="hist-time">{timeOf(e)}</span>
                  <span className={e.milestone ? 'chip chip-accent hist-chip' : 'chip hist-chip'}>{AREA_LABEL[e.area] ?? e.area}</span>
                  <span className={e.milestone ? 'hist-title is-milestone' : 'hist-title'}><Hit text={e.title} needle={needle} /></span>
                  <button className="btn btn-ghost hist-del" aria-label={`Remove ${e.title}`} onClick={() => removeEvent(e)}><XIcon /></button>
                </div>
              ))}
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

export function Achievements({ onAdd }: { onAdd: () => void }) {
  const all = useLiveQuery(() => db.events.orderBy('at').reverse().filter((e) => e.milestone).toArray(), [])
  const [area, setArea] = useState<'' | LifeEvent['area']>('')
  const items = useMemo(() => (all ?? []).filter((e) => !area || e.area === area), [all, area])
  const areaCounts = useMemo(() => countByArea(all ?? []), [all])

  const years = useMemo(() => {
    const out: { year: string; total: number; areas: [string, number][]; months: { key: string; items: LifeEvent[] }[] }[] = []
    for (const e of items) {
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
    for (const y of out) y.areas = countByArea(y.months.flatMap((m) => m.items))
    return out
  }, [items])

  if (!all) return null
  if (all.length === 0)
    return (
      <Empty>
        Milestones collect here: finished goals, completed courses, and anything you add with “Milestone” switched on.<br />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={onAdd}>Add a milestone</button>
      </Empty>
    )

  const latest = all[0]
  return (
    <div>
      <p className="ach-summary small">
        <b>{all.length}</b> {all.length === 1 ? 'milestone' : 'milestones'} since {formatDate(dayOf(all[all.length - 1]), { month: 'long', year: 'numeric' })}.
        {' '}Latest: <span className="ach-latest">{latest.title}</span> <span className="faint">({formatDate(dayOf(latest))})</span>
      </p>
      {areaCounts.length > 1 && (
        <div className="hist-filters">
          <AreaChips<LifeEvent['area']> value={area} onChange={setArea} areas={areaCounts.map(([a]) => a as LifeEvent['area'])} label="Filter milestones by area" />
        </div>
      )}
      {years.map((y) => (
        <section className="ach-year" key={y.year}>
          <div className="ach-year-head">
            <h2><span className="ach-year-num">{y.year}</span><span className="ach-year-total">{y.total} {y.total === 1 ? 'milestone' : 'milestones'}</span></h2>
            <div className="ach-areas">
              {y.areas.map(([a, n]) => <span key={a}>{AREA_LABEL[a as LifeEvent['area']] ?? a} <b>{n}</b></span>)}
            </div>
          </div>
          {y.months.map((m) => (
            <div className="ach-month" key={m.key}>
              <div className="ach-month-name">{formatDate(`${m.key}-01`, { month: 'long' })}<span className="faint"> · {m.items.length}</span></div>
              <div className="ach-list">
                {m.items.map((e) => (
                  <div className="ach-entry" key={e.id}>
                    <span className="ach-entry-date">{formatDate(dayOf(e))}</span>
                    <span className="ach-entry-title">{e.title}</span>
                    <span className="ach-entry-meta">{AREA_LABEL[e.area] ?? e.area}</span>
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
