// Scoreboard sections: standing, ghost, up next, records, highlights reel. Presentation only; numbers come from model.ts.
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../lib/dates'
import type { FormMark, GhostLine, ScoreRecord, Standing, UpNext } from './model'
import type { Highlight } from './highlights'
import { renderHighlightCard, saveShareCard } from './highlightCard'
import { FloorCard } from '../buildings/Floor'

export function FormMarks({ marks, weeks }: { marks: FormMark[]; weeks: string[] }) {
  const label = { full: 'strong week', half: 'steady week', empty: 'quiet week' } as const
  return (
    <ol className="sc-form" aria-label="Form guide, last 8 finished weeks, oldest first">
      {marks.map((m, i) => (
        <li key={weeks[i]} style={{ '--i': i } as CSSProperties} title={`Week of ${formatDate(weeks[i])}: ${label[m]}`}>
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

export function StandingCard({ st, next }: { st: Standing; next?: UpNext }) {
  return (
    <section className="card floor-hero sc-hero" aria-labelledby="sc-standing-h" data-testid="standing">
      <p className="sc-kicker" id="sc-standing-h">{st.quarter} standing</p>
      <div className="sc-hero-main">
        <div>
          {st.status === 'ready' ? <p className="sc-big" data-testid="standing-headline">{st.headline}</p> : <p className="sc-big sc-big-quiet" data-testid="standing-headline">{st.headline}</p>}
          <p className="sc-sub">{st.sub}</p>
        </div>
        {st.form.length > 0 && (
          <div className="sc-formwrap">
            <FormMarks marks={st.form} weeks={st.formWeeks} />
            <p className="sc-cap" title="Filled is strong, half is steady, open is quiet">Last 8 weeks</p>
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
      {next && (
        <Link to={next.href} className="sc-upnext" data-testid="up-next">
          <span className="sc-upnext-k">Up next</span>
          <span className="sc-upnext-t">{next.title}</span>
          <span className="sc-upnext-h">{next.hint}</span>
          <span className="sc-bar" aria-hidden><span style={{ transform: `scaleX(${next.progress})` }} /></span>
        </Link>
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
    <FloorCard title="Ghost" label="Ghost: you against your own best">
      {hasData ? <><GhostRow g={week} /><GhostRow g={month} /></> : <p className="sc-note">Nothing to race yet. Finish a week and your ghost shows up.</p>}
    </FloorCard>
  )
}

export function UpNextList({ items }: { items: UpNext[] }) {
  return items.length === 0 ? <p className="sc-note">Nothing close yet. Log a few things.</p> : (
    <ul className="sc-next">
      {items.map((n) => (
        <li key={n.id}>
          <Link to={n.href} className="sc-next-link">
            <span className="sc-next-t">{n.title}</span>
            <span className="sc-next-h">{n.hint}</span>
            <span className="sc-bar" aria-hidden><span style={{ transform: `scaleX(${n.progress})` }} /></span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function RecordsList({ records, limit }: { records: ScoreRecord[]; limit?: number }) {
  if (records.length === 0) return <p className="sc-note" data-testid="records-empty">No records yet. Finish a week and the first one posts.</p>
  return (
    <ul className="sc-records">
      {records.slice(0, limit).map((r) => (
        <li key={r.id} className="sc-rec" data-testid="record">
          <p className="sc-rec-l">{r.label}</p>
          <p className="sc-rec-v sc-num">{r.display}</p>
          <p className="sc-rec-d">{r.holding ? <span className="sc-gold">Holding it now</span> : null}{r.holding ? ' · ' : ''}{r.dateLabel}</p>
          <span className="sc-bar" aria-hidden><span style={{ transform: `scaleX(${r.progress})` }} /></span>
          <p className="sc-rec-h"><Link to={r.href}>{r.hint}</Link></p>
        </li>
      ))}
    </ul>
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
    <li className="sc-hl" data-testid="highlight">
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
    <FloorCard title="Highlights" className="sc-reelcard">
      {items.length === 0 ? (
        <p className="sc-note" data-testid="reel-empty">No highlights yet. Real moments land here as you log.</p>
      ) : (
        <ul className="sc-reel" aria-label="Highlights reel, swipe sideways">
          {items.map((h) => <HighlightCardView key={h.id} h={h} />)}
          <li className="sc-hl sc-hl-end" data-testid="reel-end"><p className="sc-hl-h">You're caught up.</p></li>
        </ul>
      )}
    </FloorCard>
  )
}
