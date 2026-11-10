// Home HUD over the Life map: title bar, overview stats, the curved district strip and the breakout panel (one tab at a time).
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Ring } from '../game/ui/Ring'
import { WeekDots } from '../game/ui/Meters'
import type { PlayerState, SkillId } from '../game/types'
import { seasonOf } from '../you/season'
import { formatDate, today } from '../../lib/dates'
import { loadDemoWithConfirm } from '../onboarding/demoActions'
import { openSetup } from '../onboarding/setupLogic'
import { clamp01, money as whole, weightProgress, type District, type LifeMap } from './model'
import type { HomeHud } from './useHomeHud'

export type HomeTab = 'today' | SkillId
export const TABS: { id: HomeTab; label: string; strip: string }[] = [
  { id: 'today', label: 'Today', strip: 'Overview' },
  { id: 'money', label: 'Money', strip: 'Money' },
  { id: 'body', label: 'Body', strip: 'Body' },
  { id: 'mind', label: 'Mind', strip: 'Mind' },
  { id: 'career', label: 'Career', strip: 'Career' },
  { id: 'people', label: 'People', strip: 'People' },
]
const OPEN: Record<HomeTab, { to: string; label: string }> = {
  today: { to: '/today', label: 'Open Today' }, money: { to: '/finance', label: 'Open Money' }, body: { to: '/body', label: 'Open Body' },
  mind: { to: '/mind', label: 'Open Mind' }, career: { to: '/career', label: 'Open Career' }, people: { to: '/people', label: 'Open People' },
}
const num = (n: number) => Math.round(n).toLocaleString('en-US')

export function TitleBar() {
  const d = today()
  return (
    <header className="hm-title">
      <h1>Northstar</h1>
      <span className="hm-title-sep" aria-hidden="true" />
      <span className="hm-title-date mono">{formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
    </header>
  )
}

function StatRow({ to, label, value, ring, warn, note }: { to: string; label: string; value: string; ring: number; warn?: boolean; note?: string }) {
  return (
    <Link to={to} className="hm-stat">
      <Ring value={ring} size={34} stroke={3} />
      <span className="hm-stat-text">
        <span className="hm-stat-label">{label}</span>
        <span className={`hm-stat-value mono${warn ? ' is-warn' : ''}`}>{value}{note && <span className="hm-stat-note"> {note}</span>}</span>
      </span>
    </Link>
  )
}

export function Overview({ map, hud, p }: { map: LifeMap; hud: HomeHud | undefined; p: PlayerState }) {
  const money = map.districts.find((d) => d.id === 'money')
  const people = map.districts.find((d) => d.id === 'people')
  const total = p.quests.length
  const overdue = Number(map.overview.toContact)
  const tracked = people?.trees.filter((t) => !t.placeholder).length ?? 0
  const [busy, setBusy] = useState(false)
  return (
    <section className="hm-overview hm-glass" aria-label="Overview">
      <StatRow to="/finance" label="Net worth" value={map.overview.netWorth} ring={money?.glow ?? 0} />
      <StatRow to="/today" label="Today's plan" value={total ? `${p.questsDone} of ${total}` : 'None yet'} ring={total ? p.questsDone / total : 0} />
      <StatRow to="/food" label="Calories" value={hud ? num(hud.cal) : '0'} note={hud ? `of ${num(hud.calTarget)}` : undefined} ring={hud ? clamp01(hud.cal / hud.calTarget) : 0} />
      <StatRow to="/people" label="To contact" value={String(overdue)} warn={overdue > 0} ring={tracked ? 1 - overdue / tracked : 0} />
      {map.empty && (
        <div className="hm-first">
          <p>Your city is quiet. Log a weigh-in, a balance or a message to someone and the nearest district rises.</p>
          <div className="hm-first-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={openSetup}>Set up</button>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await loadDemoWithConfirm() } finally { setBusy(false) } }}>Load demo data</button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Roving-focus keyboard for a row of tabs: arrows, Home and End move and select. */
function useRoving(count: number, current: number, select: (i: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent) => {
    const next = e.key === 'ArrowRight' ? current + 1 : e.key === 'ArrowLeft' ? current - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : null
    if (next === null) return
    e.preventDefault()
    const i = (next + count) % count
    select(i)
    refs.current[i]?.focus()
  }
  return { refs, onKey }
}

/** Bottom strip: a gently curved glass band. Selecting a tab focuses its district and switches the panel. */
export function DistrictStrip({ tab, onTab, districts }: { tab: HomeTab; onTab: (t: HomeTab) => void; districts: District[] }) {
  const idx = TABS.findIndex((t) => t.id === tab)
  const { refs, onKey } = useRoving(TABS.length, idx, (i) => onTab(TABS[i].id))
  return (
    <nav className="hm-strip" aria-label="Districts">
      <svg className="hm-strip-bg" viewBox="0 0 660 82" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="hm-rim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className="hm-rim-0" /><stop offset="0.5" className="hm-rim-1" /><stop offset="1" className="hm-rim-0" />
          </linearGradient>
        </defs>
        <path d="M4 40 Q330 2 656 40 L656 80 Q330 48 4 80 Z" className="hm-strip-shape" />
        <path d="M4 40 Q330 2 656 40" className="hm-strip-rim" />
      </svg>
      <div className="hm-strip-row" role="tablist" aria-label="Districts" onKeyDown={onKey}>
        {TABS.map((t, i) => {
          const d = districts.find((x) => x.id === t.id)
          const u = (i + 0.5) / TABS.length
          const off = Math.round(43 - 76 * u * (1 - u)) // follows the band's top curve
          return (
            <button
              key={t.id} ref={(el) => { refs.current[i] = el }} type="button" role="tab" className="hm-strip-tab" data-tab={t.id}
              aria-selected={tab === t.id} aria-controls="hm-panel" tabIndex={tab === t.id ? 0 : -1}
              style={{ transform: `translateY(${off}px)` }} onClick={() => onTab(t.id)}
            >
              {t.strip}
              {d?.beacon && <i className="hm-dot" aria-hidden="true" />}
              {d?.gold && !d.beacon && <i className="hm-dot is-gold" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function Num({ label, value, of, warn }: { label: string; value: string; of?: string; warn?: boolean }) {
  return (
    <div className="hm-num">
      <span className="hm-num-label">{label}</span>
      <span className={`hm-num-value mono${warn ? ' is-warn' : ''}`}>{value}</span>
      {of && <span className="hm-num-of">{of}</span>}
    </div>
  )
}

function Flags({ d }: { d?: District }) {
  if (!d) return null
  return (
    <>
      {d.beacon && <p className="hm-warn">{d.beacon}</p>}
      {d.gold && <p className="hm-earned">Milestone logged this week</p>}
    </>
  )
}

function TodayTab({ p, hud, map }: { p: PlayerState; hud?: HomeHud; map: LifeMap }) {
  const season = seasonOf(today())
  const total = p.quests.length
  const safe = hud?.safe
  return (
    <>
      <section className="hm-sec" aria-label="Today's plan">
        <h3 className="hm-h">{p.cleared ? 'Plan done' : "Today's plan"}<span className="mono">{p.questsDone}/{total}</span></h3>
        {total ? (
          <ul className="hm-plan">
            {p.quests.slice(0, 5).map((q) => (
              <li key={q.id} className={q.done ? 'is-done' : ''}>
                <Link to={q.href ?? '/today'} className="hm-plan-row">
                  <span className="hm-tick" aria-hidden="true" />
                  <span className="hm-plan-title">{q.title}</span>
                  {q.progress && !q.done && <span className="hm-plan-prog mono">{num(q.progress.value)}/{num(q.progress.target)}</span>}
                  <span className="sr-only">{q.done ? ' (done)' : ' (not done yet)'}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hm-muted">The plan fills from your goals and routines. <Link to="/goals">Set a goal</Link> to start.</p>
        )}
      </section>
      <div className="hm-nums">
        <Num label="Calories" value={hud ? num(hud.cal) : '0'} of={hud ? `of ${num(hud.calTarget)}` : undefined} />
        {safe ? <Num label="Safe to spend" value={whole(Math.max(0, safe.left))} warn={safe.left < 0} of={safe.left < 0 ? `${whole(-safe.left)} over` : 'this month'} />
          : <Num label="Spent" value={whole(hud?.spentMonth ?? 0)} of="this month" />}
        <Num label="Active days" value={`${p.streak.daysThisWeek} of ${p.streak.target}`} of="this week" />
      </div>
      <p className="hm-next">
        <span className="hm-next-k">Next</span>
        {hud?.next ? <span><span className="mono">{hud.next.label}</span> {hud.next.title}</span> : <span className="hm-muted">Nothing else scheduled today</span>}
      </p>
      <footer className="hm-foot">
        <div className="hm-foot-row">
          <Link to="/review" className="hm-season">{season.name} <span>{season.daysLeft === 0 ? 'last day' : `${season.daysLeft} days left`}</span></Link>
          <WeekDots streak={p.streak} showLabels={false} />
        </div>
        <details className="hm-recent">
          <summary>Recent</summary>
          {p.recent.length ? (
            <ul>{p.recent.slice(0, 4).map((g) => <li key={g.id}>{g.reason.replace(/\s*\(\+\d+\)$/, '')}</li>)}</ul>
          ) : <p className="hm-muted">Log a weigh-in, a win or a journal line and it shows here.</p>}
        </details>
      </footer>
      {map.empty && <p className="hm-muted">Start with one line in the capture bar, for example <span className="mono">w 182.4</span>.</p>}
    </>
  )
}

function MoneyTab({ hud, map }: { hud?: HomeHud; map: LifeMap }) {
  const d = map.districts.find((x) => x.id === 'money')
  const safe = hud?.safe
  return (
    <>
      <Flags d={d} />
      <div className="hm-hero">
        <span className="hm-num-label">{safe ? 'Safe to spend this month' : 'Spent this month'}</span>
        <span className={`hm-hero-value mono${safe && safe.left < 0 ? ' is-warn' : ''}`}>{whole(safe ? safe.left : (hud?.spentMonth ?? 0))}</span>
        <span className="hm-muted">{safe ? `${whole(safe.spent)} spent of ${whole(safe.budget)}${safe.billsDue ? `, ${whole(safe.billsDue)} in bills due` : ''}` : 'Set budgets on Money to see what is safe to spend.'}</span>
      </div>
      <div className="hm-nums is-two">
        <Num label="Net worth" value={map.overview.netWorth} />
        <Num label="Portfolio" value={hud?.portfolio != null ? whole(hud.portfolio) : 'None yet'} of={hud?.portfolio != null ? 'at last price' : 'Add holdings on Money'} />
      </div>
    </>
  )
}

function BodyTab({ hud, map }: { hud?: HomeHud; map: LifeMap }) {
  const d = map.districts.find((x) => x.id === 'body')
  const w = hud?.weight
  const prog = weightProgress(w ?? null)
  const steps = d?.path ?? []
  return (
    <>
      <Flags d={d} />
      <section className="hm-sec" aria-label="Path to goal weight">
        <h3 className="hm-h">Path to goal weight</h3>
        {w ? (
          <>
            <div className="hm-path" role="img" aria-label={`${Math.round((prog ?? 0) * 100)} percent of the way from ${w.start} to ${w.goal} lb`}>
              {steps.map((s, i) => <span key={i} className={s.lit ? 'is-lit' : ''} />)}
              <i className={d?.pathDone ? 'is-earned' : ''} />
            </div>
            <p className="hm-path-line mono">{w.current} lb <span className="hm-muted">now, goal {w.goal} lb, started {w.start}</span></p>
          </>
        ) : <p className="hm-muted">Log a weigh-in (<span className="mono">w 182.4</span>) to draw the path.</p>}
      </section>
      <div className="hm-ringrow">
        <Ring value={hud ? clamp01(hud.cal / hud.calTarget) : 0} size={64} stroke={5} tone="body" label={`Calories: ${hud ? num(hud.cal) : 0} of ${hud ? num(hud.calTarget) : 0}`} />
        <div>
          <span className="hm-num-label">Calories today</span>
          <span className="hm-hero-value is-sm mono">{hud ? num(hud.cal) : '0'} <span className="hm-num-of">of {hud ? num(hud.calTarget) : '0'}</span></span>
          {hud?.proteinTarget ? <span className="hm-muted">{Math.round(hud.protein)} of {hud.proteinTarget} g protein</span> : null}
        </div>
      </div>
    </>
  )
}

function ListOr({ items, empty }: { items: { key: string | number; text: ReactNode }[]; empty: ReactNode }) {
  return items.length ? <ul className="hm-list">{items.map((x) => <li key={x.key}>{x.text}</li>)}</ul> : <p className="hm-muted">{empty}</p>
}

function MindTab({ hud, map }: { hud?: HomeHud; map: LifeMap }) {
  const d = map.districts.find((x) => x.id === 'mind')
  return (
    <>
      <Flags d={d} />
      <div className="hm-nums is-two">
        <Num label="Journal" value={String(hud?.journalWeek ?? 0)} of="entries, 7 days" />
        <Num label="Study" value={String(hud?.studyWeek ?? 0)} of="sessions, 7 days" />
      </div>
      <section className="hm-sec" aria-label="Mind goals">
        <h3 className="hm-h">Goals</h3>
        <ListOr items={(hud?.mindGoals ?? []).map((g) => ({ key: g.id, text: g.title }))} empty={<>Write one journal line, <span className="mono">journal: long walk</span>, to light the library.</>} />
      </section>
    </>
  )
}

function CareerTab({ hud, map }: { hud?: HomeHud; map: LifeMap }) {
  const d = map.districts.find((x) => x.id === 'career')
  return (
    <>
      <Flags d={d} />
      <div className="hm-nums is-two">
        <Num label="Wins" value={String(hud?.winsWeek ?? 0)} of="last 7 days" />
        <Num label="Projects" value={String(hud?.careerGoals.length ?? 0)} of="active" />
      </div>
      <section className="hm-sec" aria-label="Career projects">
        <h3 className="hm-h">Projects</h3>
        <ListOr items={(hud?.careerGoals ?? []).map((g) => ({ key: g.id, text: g.title }))} empty={<>Log a win, <span className="mono">win: shipped it #career</span>, to raise an office.</>} />
      </section>
    </>
  )
}

function PeopleTab({ hud, map }: { hud?: HomeHud; map: LifeMap }) {
  const d = map.districts.find((x) => x.id === 'people')
  const reach = hud?.reach ?? []
  return (
    <>
      <Flags d={d} />
      <section className="hm-sec" aria-label="Reach out soon">
        <h3 className="hm-h">Reach out soon</h3>
        {reach.length ? (
          <ul className="hm-list hm-people">
            {reach.map((r) => (
              <li key={r.id}>
                <Link to={`/people?focus=${r.id}`} className="hm-person">
                  <span className={`hm-leaf${r.overdue ? ' is-overdue' : ''}`} aria-hidden="true" />
                  <span className="hm-plan-title">{r.name}</span>
                  <span className={`mono hm-due${r.overdue ? ' is-warn' : ''}`}>{r.overdue ? 'Overdue' : r.dueIn === 0 ? 'Today' : `In ${r.dueIn} d`}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="hm-muted">{map.overview.toContact === '0' && (d?.trees.some((t) => !t.placeholder)) ? 'Nobody due this week.' : 'Add someone on People and set how often to check in. Each person grows a tree.'}</p>}
      </section>
    </>
  )
}

/** Right panel (desktop) or bottom sheet (phone): one breakout tab at a time, an Open link, collapsible. */
export function BreakoutPanel({ tab, onTab, open, onOpen, map, hud, p, phone }: {
  tab: HomeTab; onTab: (t: HomeTab) => void; open: boolean; onOpen: (o: boolean) => void
  map: LifeMap; hud?: HomeHud; p: PlayerState; phone: boolean
}) {
  const idx = TABS.findIndex((t) => t.id === tab)
  const { refs, onKey } = useRoving(TABS.length, idx, (i) => onTab(TABS[i].id))
  const current = TABS[idx]
  const body = tab === 'today' ? <TodayTab p={p} hud={hud} map={map} />
    : tab === 'money' ? <MoneyTab hud={hud} map={map} />
    : tab === 'body' ? <BodyTab hud={hud} map={map} />
    : tab === 'mind' ? <MindTab hud={hud} map={map} />
    : tab === 'career' ? <CareerTab hud={hud} map={map} />
    : <PeopleTab hud={hud} map={map} />
  if (!phone && !open) {
    return (
      <button type="button" className="hm-reopen hm-glass" onClick={() => onOpen(true)} aria-expanded="false">
        <span>{current.label}</span><span aria-hidden="true">&lsaquo;</span><span className="sr-only">Show panel</span>
      </button>
    )
  }
  return (
    <aside className={`hm-panel hm-glass${phone ? ' is-sheet' : ''}${phone && open ? ' is-open' : ''}`} aria-label="Details" data-testid="home-panel">
      {phone && (
        <button type="button" className="hm-grab" onClick={() => onOpen(!open)} aria-expanded={open} aria-controls="hm-panel">
          <span aria-hidden="true" /><span className="sr-only">{open ? 'Shrink details' : 'Expand details'}</span>
        </button>
      )}
      <div className="hm-tabs" role="tablist" aria-label="Details" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t.id} ref={(el) => { refs.current[i] = el }} type="button" role="tab" id={`hm-tab-${t.id}`} className="hm-tab" data-panel-tab={t.id}
            aria-selected={tab === t.id} aria-controls="hm-panel" tabIndex={tab === t.id ? 0 : -1} onClick={() => onTab(t.id)}
          >{t.label}</button>
        ))}
      </div>
      <div className="hm-body" id="hm-panel" role="tabpanel" aria-labelledby={`hm-tab-${tab}`} data-testid="home-tabpanel" data-tab={tab} key={tab}>
        {body}
      </div>
      <div className="hm-panel-foot">
        <Link className="hm-open" to={OPEN[tab].to}>{OPEN[tab].label}<span aria-hidden="true">&nbsp;&rarr;</span></Link>
        {!phone && <button type="button" className="hm-collapse" onClick={() => onOpen(false)} aria-label="Hide panel" aria-expanded="true">&rsaquo;</button>}
      </div>
    </aside>
  )
}
