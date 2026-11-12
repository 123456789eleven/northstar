// Money hero: the form guide. Last 8 completed weeks as W / D / L marks, the rule that makes them, and this month
// against last month and your best month (ghost lines). Describes what happened; never scolds.
import { Link } from 'react-router-dom'
import type { Budget, Transaction } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import type { Bill } from './bills'
import './wealth.css'
import { FORM_RULE, formGuide, formTally, monthGhost, underBudgetRuns, type Ghost } from './wealth'

const LABEL: Record<string, string> = { W: 'Win: spent at least 5% under the weekly allowance', D: 'Draw: within 5% of the weekly allowance', L: 'Loss: over the weekly allowance', none: 'No transactions that week' }

function GhostChart({ g }: { g: Ghost }) {
  const days = Math.max(g.cur.length, g.last?.length ?? 0, g.best?.length ?? 0, 28)
  const max = Math.max(1, ...g.cur, ...(g.last ?? []), ...(g.best ?? []))
  const W = 320
  const H = 84
  const pts = (a: number[]) => a.map((v, i) => `${((i / (days - 1)) * W).toFixed(1)},${(H - 4 - (v / max) * (H - 10)).toFixed(1)}`).join(' ')
  return (
    <svg className="fg-ghost" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Cumulative spending this month against last month and your best month">
      {g.best && <polyline points={pts(g.best)} className="fg-line fg-best" />}
      {g.last && <polyline points={pts(g.last)} className="fg-line fg-last" />}
      {g.cur.length > 0 && <polyline points={pts(g.cur)} className="fg-line fg-cur" />}
    </svg>
  )
}

export default function FormGuide({ txs, budgets, bills, budgetsHref }: { txs: Transaction[]; budgets: Budget[]; bills: Bill[]; budgetsHref: string }) {
  const t = today()
  const form = formGuide(txs, budgets, bills, t, 8)
  const judged = form.some((w) => w.mark !== 'none')
  const tally = formTally(form)
  const runs = underBudgetRuns(form)
  const g = monthGhost(txs, t)
  const diff = g.lastAtDay != null ? g.lastAtDay - g.curTotal : null
  const bestLabel = g.bestMonth ? formatDate(`${g.bestMonth}-01`, { month: 'short' }) : null

  return (
    <section className="card floor-card fg" aria-label="Form guide" data-testid="form-guide">
      <div className="floor-card-head">
        <h2>Form guide</h2>
        {judged && runs.current > 0 && <span className="fg-run mn-num" data-testid="fg-run">{runs.current} {runs.current === 1 ? 'week' : 'weeks'} in a row</span>}
      </div>
      <p className="fg-title mn-num">{judged ? `${tally.w}W ${tally.d}D ${tally.l}L, last 8 weeks` : 'Starts with a budget'}</p>
      <ol className="fg-marks" aria-label="Last 8 weeks, oldest first">
        {form.map((w) => (
          <li key={w.start} title={`${formatDate(w.start)} to ${formatDate(w.end)}: ${money(w.spent)} of ${money(w.allowance)}`}>
            <span className={`fg-mark is-${w.mark}`} role="img" aria-label={`Week of ${formatDate(w.start)}: ${LABEL[w.mark]}`}>{w.mark === 'none' ? '' : w.mark}</span>
            <span className="fg-wk tiny">{formatDate(w.start, { day: 'numeric' })}</span>
          </li>
        ))}
      </ol>
      {judged ? (
        <details className="fg-rule">
          <summary className="small">How the marks work</summary>
          <p className="small muted" data-testid="fg-rule">{FORM_RULE} Allowance now: {money(form[0].allowance)} a week.</p>
        </details>
      ) : (
        <Link className="btn btn-sm fg-set" to={budgetsHref}>Set budgets</Link>
      )}
      <div className="fg-month">
        <div className="fg-month-text">
          <div className="small mn-num">
            <strong>{money(g.curTotal)}</strong> spent this month
            {diff != null && diff !== 0 && <span className={diff < 0 ? 'warn' : 'fg-ahead'}>{diff > 0 ? `, ${money(diff)} under last month` : `, ${money(-diff)} over last month`}</span>}
          </div>
          <div className="fg-legend tiny">
            <span><i className="fg-key fg-cur" /> Now</span>
            {g.last && <span><i className="fg-key fg-last" /> Last</span>}
            {g.best && <span><i className="fg-key fg-best" /> Best ({bestLabel})</span>}
          </div>
        </div>
        <GhostChart g={g} />
      </div>
    </section>
  )
}
