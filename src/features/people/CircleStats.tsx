// The circle warmth meter with its inputs and 8-week form guide, and the records strip.
import { formatDate } from '../../lib/dates'
import type { ISODate } from '../../db'
import type { CircleWarmth, FormWeek, Records } from './warmth'
import { FORM_RULE } from './warmth'

const MARK_WORD = { W: 'win', D: 'draw', L: 'loss' } as const

export function WarmthMeter({ warmth }: { warmth: CircleWarmth }) {
  if (warmth.pct === null) return null
  const { pct, tracked, warm, cooling, untracked } = warmth
  const inputs = [`${warm} of ${tracked} ${tracked === 1 ? 'person is' : 'people are'} inside their rhythm`, cooling > 0 ? `${cooling} cooling` : null, untracked > 0 ? `${untracked} without a rhythm` : null].filter(Boolean).join(' · ')
  return (
    <section className="cw" aria-label="Circle warmth" data-testid="circle-warmth">
      <div className="cw-main">
        <h2 className="cw-head">Your circle is <span className="cw-pct mono" data-pct={pct}>{pct}%</span> warm</h2>
        <div className="cw-bar" role="progressbar" aria-label="Circle warmth" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }} /></div>
        <p className="cw-inputs small muted">{inputs}</p>
        <details className="cw-how small muted">
          <summary>How this is scored</summary>
          <p>Each person counts 100% the day you speak, 50% when their check-in comes due, and 0% at twice that gap. The circle is the average of everyone with a rhythm.</p>
        </details>
      </div>
    </section>
  )
}

export function FormGuide({ form }: { form: FormWeek[] }) {
  if (form.length === 0) return null
  return (
    <section className="cw-form" aria-label="Form guide">
      <div className="cw-form-title small muted">Last 8 weeks</div>
      <ol className="cw-marks" aria-label="Form guide, last 8 weeks, oldest first">
        {form.map((w) => (
          <li key={w.start} className={`cw-mark is-${w.mark}${w.current ? ' is-current' : ''}`} title={`Week of ${formatDate(w.start)}: reached ${w.reached} of ${w.total}`} aria-label={`Week of ${formatDate(w.start)}: ${MARK_WORD[w.mark]}, reached ${w.reached} of ${w.total}${w.current ? ', still open' : ''}`}>
            <span className="cw-letter" aria-hidden>{w.mark}</span>
            <span className="cw-count mono" aria-hidden>{w.reached}</span>
          </li>
        ))}
      </ol>
      <details className="cw-how small muted"><summary>What W, D and L mean</summary><p>{FORM_RULE}</p></details>
    </section>
  )
}

const monthName = (m: string) => formatDate(`${m}-01`, { month: 'long', year: 'numeric' })
const span = (a: ISODate, b: ISODate) => `${formatDate(a, { month: 'short', day: 'numeric' })} to ${formatDate(b, { month: 'short', day: 'numeric', year: 'numeric' })}`

export function RecordsStrip({ rec }: { rec: Records }) {
  const { warmStretch: s, busiestMonth: m, oldestReconnect: o } = rec
  if (!s && !m && !o) return null
  return (
    <section className="rec" aria-label="Circle records">
      <h2 className="ppl-soon-h">Your records</h2>
      <dl className="rec-list">
        {s && <div><dt>Longest stretch with everyone warm</dt><dd><span className="rec-val mono">{s.days} {s.days === 1 ? 'day' : 'days'}</span><span className="rec-when">{span(s.start, s.end)}</span></dd></div>}
        {m && <div><dt>Most people reached in a month</dt><dd><span className="rec-val mono">{m.count}</span><span className="rec-when">{monthName(m.month)}</span></dd></div>}
        {o && <div><dt>Oldest friendship reconnected</dt><dd><span className="rec-val mono">{o.days} days</span><span className="rec-when">{o.name.split(/\s+/)[0]}, back in touch {formatDate(o.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></dd></div>}
      </dl>
    </section>
  )
}
