// Money hero: the form guide. Last 8 completed weeks as W / D / L marks, the rule that makes them, and this month
// against last month and your best month (ghost lines). Describes what happened; never scolds.
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

export default function FormGuide({ txs, budgets, bills, onBudgets }: { txs: Transaction[]; budgets: Budget[]; bills: Bill[]; onBudgets: () => void }) {
  const t = today()
  const form = formGuide(txs, budgets, bills, t, 8)
  const judged = form.some((w) => w.mark !== 'none')
  const tally = formTally(form)
  const runs = underBudgetRuns(form)
  const g = monthGhost(txs, t)
  const diff = g.lastAtDay != null ? g.lastAtDay - g.curTotal : null
  const bestLabel = g.bestMonth ? formatDate(`${g.bestMonth}-01`, { month: 'long' }) : null

  return (
    <section className="card fg" aria-label="Form guide" data-testid="form-guide">
      <div className="fg-head">
        <div>
          <span className="mn-label">Form guide</span>
          <h2 className="fg-title">{judged ? `${tally.w} wins, ${tally.d} draws, ${tally.l} losses in the last 8 weeks` : 'Your form starts with a budget'}</h2>
        </div>
        {judged && runs.current > 0 && <span className="fg-run mn-num" data-testid="fg-run">{runs.current} {runs.current === 1 ? 'week' : 'weeks'} in a row within budget</span>}
      </div>

      <ol className="fg-marks" aria-label="Last 8 weeks, oldest first">
        {form.map((w) => (
          <li key={w.start} title={`${formatDate(w.start)} to ${formatDate(w.end)}: ${money(w.spent)} of ${money(w.allowance)}`}>
            <span className={`fg-mark is-${w.mark}`} role="img" aria-label={`Week of ${formatDate(w.start)}: ${LABEL[w.mark]}`}>{w.mark === 'none' ? '' : w.mark}</span>
            <span className="fg-wk tiny">{formatDate(w.start)}</span>
          </li>
        ))}
      </ol>
      {judged ? (
        <details className="fg-rule">
          <summary className="small">How the marks work</summary>
          <p className="small muted" data-testid="fg-rule">{FORM_RULE} Allowance right now: {money(form[0].allowance)} a week.</p>
        </details>
      ) : (
        <p className="small muted">Set a monthly limit for a few categories and the next completed week gets a mark. <button className="btn btn-sm" onClick={onBudgets}>Set budgets</button></p>
      )}

      <div className="fg-month">
        <div className="fg-month-text">
          <span className="mn-label">This month against your own past</span>
          <div className="mn-sub">
            <strong className="mn-num">{money(g.curTotal)}</strong> spent so far
            {diff != null && (diff === 0 ? ', level with last month at this point.' : diff > 0 ? `, ${money(diff)} less than last month at this point.` : `, ${money(-diff)} more than last month at this point.`)}
            {diff == null && '. Last month will show up as a ghost line once you have it.'}
          </div>
          <div className="fg-legend tiny">
            <span><i className="fg-key fg-cur" /> This month</span>
            {g.last && <span><i className="fg-key fg-last" /> Last month</span>}
            {g.best && <span><i className="fg-key fg-best" /> Best month ({bestLabel})</span>}
          </div>
        </div>
        <GhostChart g={g} />
      </div>
    </section>
  )
}
