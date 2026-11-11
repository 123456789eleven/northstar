// Scoreboard sections: standing, ghost, up next, records, highlights reel. Presentation only; numbers come from model.ts.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../lib/dates'
import type { FormMark, GhostLine, ScoreRecord, Standing, UpNext } from './model'
import type { Highlight } from './highlights'
import { renderHighlightCard, saveShareCard } from './highlightCard'

export function FormMarks({ marks, weeks }: { marks: FormMark[]; weeks: string[] }) {
  const label = { full: 'strong week', half: 'steady week', empty: 'quiet week' } as const
  return (
    <ol className="sc-form" aria-label="Form guide, last 8 finished weeks, oldest first">
      {marks.map((m, i) => (
        <li key={weeks[i]} title={`Week of ${formatDate(weeks[i])}: ${label[m]}`}>
          <svg viewBox="0 0 20 20" width="22" height="22" role="img" aria-label={`Week of ${formatDate(weeks[i])}: ${label[m]}`}>
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
            {m === 'full' && <circle cx="10" cy="10" r="8" fill="currentColor" />}
            {m === 'half' && <path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor" />}
          </svg>
        </li>
      ))}
    </ol>
  )
}

export function StandingCard({ st }: { st: Standing }) {
  return (
    <section className="card sc-hero" aria-labelledby="sc-standing-h" data-testid="standing">
      <p className="sc-kicker" id="sc-standing-h">{st.quarter} standing</p>
      <div className="sc-hero-main">
        <div>
          {st.status === 'ready' ? <p className="sc-big" data-testid="standing-headline">{st.headline}</p> : <p className="sc-big sc-big-quiet" data-testid="standing-headline">{st.headline}</p>}
          <p className="sc-sub">{st.sub}</p>
        </div>
        {st.form.length > 0 && (
          <div className="sc-formwrap">
            <FormMarks marks={st.form} weeks={st.formWeeks} />
            <p className="sc-cap">Last 8 weeks. Filled is strong, half is steady, open is quiet.</p>
          </div>
        )}
      </div>
      {st.inputs.length > 0 && (
        <ul className="sc-inputs" aria-label="What the standing is built from">
          {st.inputs.map((i) => (
            <li key={i.id}>
              <Link to={i.href} className="sc-input">
                <span className="sc-input-h"><span>{i.label}</span><span className="sc-num">{i.pct === null ? 'No data' : `Stronger than ${Math.round(i.pct * 100)}% of weeks`}</span></span>
                <span className="sc-bar" aria-hidden><span style={{ transform: `scaleX(${i.pct ?? 0})` }} /></span>
                <span className="sc-input-v">{i.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function GhostRow({ g }: { g: GhostLine }) {
  const max = Math.max(g.now, g.last, g.best, 1)
  return (
    <div className="sc-ghost-row" data-testid={`ghost-${g.period.toLowerCase()}`}>
      <div className="sc-ghost-h"><b>{g.period === 'Week' ? 'This week' : 'This month'}</b><span className="sc-num sc-ghost-now">{g.now}</span></div>
      <div className="sc-ghost-bars" aria-hidden>
        <span className="sc-gbar sc-gbar-now" style={{ width: `${(g.now / max) * 100}%` }} />
        <span className="sc-gbar sc-gbar-ghost" style={{ width: `${(g.best / max) * 100}%` }} />
      </div>
      <p className="sc-ghost-line">
        <span>{g.period === 'Week' ? 'Last week' : 'Last month'} <b className="sc-num">{g.last}</b></span>
        <span>Best {g.period.toLowerCase()} <b className="sc-num">{g.best}</b>{g.best > 0 ? ` (${g.bestLabel})` : ''}</span>
      </p>
      <p className="sc-note">{g.note}</p>
    </div>
  )
}

export function GhostCard({ week, month, hasData }: { week: GhostLine; month: GhostLine; hasData: boolean }) {
  return (
    <section className="card sc-card" aria-labelledby="sc-ghost-h">
      <h2 className="sc-h" id="sc-ghost-h">Ghost</h2>
      <p className="sc-sub">You against your own best. Counts everything you did: tasks, habits, journal days, study sessions, people reached, weigh-ins, workouts and wins.</p>
      {hasData ? <><GhostRow g={week} /><GhostRow g={month} /></> : <p className="sc-note">Nothing to race yet. Finish a week and your ghost appears.</p>}
    </section>
  )
}

export function UpNextCard({ items }: { items: UpNext[] }) {
  return (
    <section className="card sc-card" aria-labelledby="sc-next-h">
      <h2 className="sc-h" id="sc-next-h">Up next</h2>
      {items.length === 0 ? <p className="sc-note">Nothing close yet. Log a few things and the nearest record or milestone lands here.</p> : (
        <ul className="sc-next">
          {items.map((n) => (
            <li key={n.id}>
              <Link to={n.href} className="sc-next-link" data-testid="up-next">
                <span className="sc-next-t">{n.title}</span>
                <span className="sc-next-h">{n.hint}</span>
                <span className="sc-bar" aria-hidden><span style={{ transform: `scaleX(${n.progress})` }} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function RecordsSection({ records }: { records: ScoreRecord[] }) {
  return (
    <section aria-labelledby="sc-rec-h" className="sc-section">
      <h2 className="sc-h" id="sc-rec-h">Records</h2>
      {records.length === 0 ? (
        <div className="card sc-card" data-testid="records-empty">
          <p className="sc-big sc-big-quiet">No records yet.</p>
          <p className="sc-sub">A record appears the first time you finish a week or month of something: tasks done, a saving month, weigh-ins, study minutes, people reached or a daily run. Log a few days and the first ones post themselves, each with its date and how far the next one is.</p>
        </div>
      ) : (
        <ul className="sc-records">
          {records.map((r) => (
            <li key={r.id} className="card sc-rec" data-testid="record">
              <p className="sc-rec-l">{r.label}</p>
              <p className="sc-rec-v sc-num">{r.display}</p>
              <p className="sc-rec-d">{r.holding ? <span className="sc-gold">Holding it now</span> : null}{r.holding ? ' · ' : ''}{r.dateLabel}</p>
              <span className="sc-bar" aria-hidden><span style={{ transform: `scaleX(${r.progress})` }} /></span>
              <p className="sc-rec-h"><Link to={r.href}>{r.hint}</Link></p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Visual({ h }: { h: Highlight }) {
  const v = h.visual.values
  const W = 160, H = 44
  if (h.visual.type === 'dots') {
    const n = Math.min(14, Math.max(1, Math.round(v[0] ?? 1)))
    return <svg viewBox={`0 0 ${W} ${H}`} className="sc-vis" aria-hidden>{Array.from({ length: n }, (_, i) => <circle key={i} cx={8 + i * (W - 16) / Math.max(1, n - 1 || 1)} cy={H / 2} r="5" className={i === n - 1 ? 'sc-v-gold' : 'sc-v-main'} />)}</svg>
  }
  if (h.visual.type === 'line' && v.length > 1) {
    const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1
    const pts = v.map((n, i) => `${(W * i) / (v.length - 1)},${H - 4 - ((n - lo) / span) * (H - 8)}`).join(' ')
    return <svg viewBox={`0 0 ${W} ${H}`} className="sc-vis" aria-hidden><polyline points={pts} fill="none" className="sc-v-line" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
  }
  const hi = Math.max(...v.map(Math.abs), 1)
  const bw = Math.min(16, (W / Math.max(1, v.length)) * 0.6)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sc-vis" aria-hidden>
      {v.map((n, i) => { const bh = Math.max(3, (Math.abs(n) / hi) * (H - 4)); return <rect key={i} x={(W / v.length) * i + 4} y={H - bh} width={bw} height={bh} rx="3" className={i === v.length - 1 ? 'sc-v-gold' : 'sc-v-main'} /> })}
    </svg>
  )
}

function HighlightCardView({ h }: { h: Highlight }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'fail'>('idle')
  const share = async () => {
    setState('busy')
    try {
      const blob = await renderHighlightCard(h)
      if (!blob) { setState('fail'); return }
      await saveShareCard(blob, `northstar-highlight-${h.date}.png`)
      setState('done')
    } catch { setState('fail') }
  }
  return (
    <li className="card sc-hl" data-testid="highlight">
      <p className="sc-hl-date">{h.dateLabel}</p>
      <p className="sc-hl-h">{h.headline}</p>
      <p className="sc-hl-d">{h.detail}</p>
      <Visual h={h} />
      <div className="sc-hl-foot">
        <button type="button" className="btn btn-sm" onClick={share} disabled={state === 'busy'} data-testid="highlight-share">{state === 'busy' ? 'Drawing' : 'Share'}</button>
        <span className="sc-note" role="status">{state === 'done' ? 'Image ready.' : state === 'fail' ? 'Could not draw the image here.' : ''}</span>
      </div>
    </li>
  )
}

export function Reel({ items }: { items: Highlight[] }) {
  return (
    <section aria-labelledby="sc-reel-h" className="sc-section">
      <h2 className="sc-h" id="sc-reel-h">Highlights</h2>
      {items.length === 0 ? (
        <div className="card sc-card" data-testid="reel-empty">
          <p className="sc-sub">Highlights are real moments from the last few months: a net worth high, a record week, a friend you got back in touch with, a milestone. None yet. They appear on their own as you log.</p>
        </div>
      ) : (
        <ul className="sc-reel" aria-label="Highlights reel, swipe sideways">
          {items.map((h) => <HighlightCardView key={h.id} h={h} />)}
          <li className="card sc-hl sc-hl-end" data-testid="reel-end"><p className="sc-hl-h">You&apos;re caught up.</p><p className="sc-hl-d">That is every highlight from the last few months.</p></li>
        </ul>
      )}
    </section>
  )
}
