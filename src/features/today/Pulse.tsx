// Today's two numbers that matter most to the owner: calories toward the daily target, and money against the month's budget.
// Read-only rings over existing tables; each opens its module. No target / no budget shows the one thing to do.
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../../db'
import { useNow } from '../../components/useNow'
import { Ring } from '../game/ui/Ring'
import { effectiveCalorieTarget, TARGETS_KEY, type FoodTargets } from '../food/foodData'
import { isSpend } from '../finance/categories'
import { monthKey, money, today } from '../../lib/dates'

function Gauge({ to, label, value, of, note, ring, tone }: { to: string; label: string; value: string; of?: string; note: string; ring: number; tone?: 'money' | 'body' | 'reward' }) {
  return (
    <Link to={to} className="card card-interactive pulse-card" data-spec>
      <Ring value={ring} size={72} stroke={6} tone={tone} label={`${label}: ${Math.round(ring * 100)} percent`} />
      <span className="pulse-text">
        <span className="pulse-label">{label}</span>
        <span className="pulse-value">{value}{of && <span className="pulse-of"> {of}</span>}</span>
        <span className="pulse-note">{note}</span>
      </span>
    </Link>
  )
}

function Calories() {
  const hour = useNow().getHours()
  const d = useLiveQuery(async () => {
    const meals = await db.meals.where('date').equals(today()).toArray()
    const t = await getSetting<FoodTargets>(TARGETS_KEY, {})
    return { cal: meals.reduce((s, m) => s + (m.calories ?? 0), 0), protein: meals.reduce((s, m) => s + (m.protein ?? 0), 0), target: effectiveCalorieTarget(t), pTarget: t.protein, count: meals.length }
  }, [])
  if (!d) return <div className="card pulse-card skel-pulse" aria-hidden />
  const left = d.target - d.cal
  const behind = d.cal / d.target < Math.max(0, (hour - 8) / 14) - 0.2
  const note = left <= 0 ? 'Target reached' : behind && d.count > 0 ? `${left.toLocaleString()} to go. Behind pace for this hour` : `${left.toLocaleString()} to go${d.pTarget ? ` · ${Math.round(d.protein)} of ${d.pTarget} g protein` : ''}`
  return <Gauge to="/food" label="Calories" value={d.cal.toLocaleString()} of={`of ${d.target.toLocaleString()}`} note={note} ring={Math.min(1, d.cal / d.target)} tone={left <= 0 ? 'reward' : 'body'} />
}

function Spending() {
  const d = useLiveQuery(async () => {
    const m = monthKey()
    const tx = await db.transactions.where('date').between(`${m}-01`, `${m}-31`, true, true).toArray()
    const budgets = await db.budgets.toArray()
    const budgeted = new Set(budgets.map((b) => b.category))
    const spent = tx.filter((t) => isSpend(t) && (budgeted.size === 0 || budgeted.has(t.category))).reduce((s, t) => s - t.amount, 0)
    return { spent, limit: budgets.reduce((s, b) => s + b.monthlyLimit, 0), count: tx.length }
  }, [])
  if (!d) return <div className="card pulse-card skel-pulse" aria-hidden />
  if (d.limit <= 0) return <Gauge to="/finance" label="Spent this month" value={money(d.spent)} note={d.count ? 'No budgets set yet' : 'Import transactions on Money'} ring={0} tone="money" />
  const left = d.limit - d.spent
  return <Gauge to="/finance" label="Left this month" value={money(Math.max(0, left))} of={`of ${money(d.limit)}`} note={left < 0 ? `${money(-left)} over budget` : `${money(d.spent)} spent`} ring={Math.min(1, d.spent / d.limit)} tone="money" />
}

export function Pulse() {
  return <section className="pulse" aria-label="Calories and money"><Calories /><Spending /></section>
}
