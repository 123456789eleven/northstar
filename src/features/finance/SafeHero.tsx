// Money hero: what is safe to spend this month, with its inputs shown plainly, plus the budget pace line.
import { useNumberRoll } from '../../components/motion'
import { today } from '../../lib/dates'
import { Ring } from '../game/ui/Ring'
import { monthLabel } from './model'
import { dueText, paceLine, type SafeToSpend } from './safeToSpend'

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function SafeHero({ month, safe, onBudgets }: { month: string; safe: SafeToSpend | null; onBudgets: () => void }) {
  const t = today()
  const closed = month < t.slice(0, 7)
  const shown = useNumberRoll(Math.round(safe?.left ?? 0))
  if (!safe) {
    return (
      <section className="card mn-hero" aria-label={`${monthLabel(month)} safe to spend`} data-testid="safe-empty">
        <div className="mn-hero-main">
          <span className="mn-label">Left this month</span>
          <div className="mn-empty-title" data-testid="month-status">No budget yet</div>
          <p className="mn-note">Set a monthly limit for a few categories and this becomes your safe to spend: budget, minus spent, minus bills still due.</p>
          <div><button className="btn btn-primary" onClick={onBudgets}>Set budgets</button></div>
        </div>
      </section>
    )
  }
  const over = safe.left < 0
  const usedShare = safe.budget > 0 ? safe.spent / safe.budget : 0
  const pace = paceLine(safe.budget, safe.spent, month, t)
  const next = safe.billsDueList[0]
  return (
    <section className="card mn-hero" aria-label={`${monthLabel(month)} safe to spend`} data-testid="safe-hero">
      <div className="mn-hero-main">
        <span className="mn-label">{closed ? `${monthLabel(month)}, closed` : 'Left this month, safe to spend'}</span>
        <div className={`mn-hero-num mn-num ${over ? 'is-bad' : ''}`} data-testid="safe-left">{shown < 0 ? '-' : ''}{money(Math.abs(shown))}</div>
        <div className="mn-inputs mn-num" data-testid="safe-inputs">
          <span>{money(safe.budget)} budgeted spending</span>
          <span>{money(safe.spent)} spent</span>
          <span>{money(safe.billsDue)} bills due</span>
        </div>
        <span className="mn-sub">Budgeted categories only. Cash flow below counts all spending.</span>
        <span className="sr-only" data-testid="month-status">{over ? `${money(-safe.left)} over` : 'On budget'}</span>
        {next && !closed && <span className="mn-sub mn-num">Next bill: {next.name}, {money(next.amount)}, {dueText(next.due, t)}</span>}
        {pace && (
          <div className={`mn-pace is-${pace.status}`} data-testid="budget-pace">
            <span className="mn-pace-label">Budget pace: {pace.label}</span>
            <span className="mn-pace-note">{pace.note}</span>
          </div>
        )}
      </div>
      <div className="mn-hero-ring">
        <Ring value={usedShare} size={104} stroke={9} className={over || usedShare > 1 ? 'mn-ring-hot' : ''} label={`${Math.round(usedShare * 100)} percent of budget used`}>
          <span className="mn-ring-pct mn-num">{Math.round(usedShare * 100)}%</span>
        </Ring>
        <span className="mn-sub mn-num">{Math.round(usedShare * 100)}% of budget used{closed ? ', month closed' : `, ${safe.daysLeft} ${safe.daysLeft === 1 ? 'day' : 'days'} left`}</span>
      </div>
    </section>
  )
}
