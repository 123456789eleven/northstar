// Read-only glance rows over other modules' tables. A row with no data renders nothing; the card hides itself when all are empty.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { isSpend } from '../finance/categories'
import { Progress } from '../../components/ui'
import { averageAt } from '../body/model'
import { addDays, monthKey, money, startOfWeek, today } from '../../lib/dates'

function Row({ to, label, value, note, children }: { to: string; label: string; value: ReactNode; note?: ReactNode; children?: ReactNode }) {
  return (
    <Link to={to} className="glance-row">
      <span className="glance-main">
        <span>{label}</span>
        {note && <span className="glance-note">{note}</span>}
        {children}
      </span>
      <span className="glance-value mono">{value}</span>
    </Link>
  )
}

function MoneyRow() {
  const data = useLiveQuery(async () => {
    const m = monthKey()
    const tx = await db.transactions.where('date').between(`${m}-01`, `${m}-31`, true, true).toArray()
    const budgets = await db.budgets.toArray()
    const budgeted = new Set(budgets.map((b) => b.category))
    // With budgets set, compare only budgeted categories against the limits; otherwise show total spending.
    const spent = tx.filter((t) => isSpend(t) && (budgeted.size === 0 || budgeted.has(t.category))).reduce((s, t) => s - t.amount, 0)
    const limit = budgets.reduce((s, b) => s + b.monthlyLimit, 0)
    return { spent, limit, count: tx.length }
  }, [])
  if (!data || (data.count === 0 && data.limit === 0)) return null
  const over = data.limit > 0 && data.spent > data.limit
  return (
    <Row
      to="/finance"
      label="Spent this month"
      value={money(data.spent)}
      note={data.limit > 0 ? (over ? `${money(data.spent - data.limit)} over a ${money(data.limit)} budget` : `${money(data.limit - data.spent)} left of ${money(data.limit)}`) : 'No budgets set'}
    >
      {data.limit > 0 && <Progress value={(data.spent / data.limit) * 100} label="Spent of monthly budget" />}
    </Row>
  )
}

function FoodRow() {
  const meals = useLiveQuery(() => db.meals.where('date').equals(today()).toArray(), [])
  if (!meals || meals.length === 0) return null
  const cal = meals.reduce((s, m) => s + (m.calories ?? 0), 0)
  return <Row to="/food" label="Food today" value={cal > 0 ? `${cal.toLocaleString()} cal` : `${meals.length} ${meals.length === 1 ? 'meal' : 'meals'}`} note={meals.map((m) => m.name).slice(-2).join(', ')} />
}

function WeightRow() {
  const w = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])
  if (!w || w.length === 0) return null
  const t = today()
  const cur = averageAt(w, t) ?? w[w.length - 1].weight
  const prev = averageAt(w, addDays(t, -7))
  const d = prev != null ? cur - prev : null
  return <Row to="/body" label="Weight" value={`${cur.toFixed(1)} lb`} note={d != null ? `${d > 0 ? '+' : d < 0 ? '-' : ''}${Math.abs(d).toFixed(1)} lb over 7 days` : `Last ${w[w.length - 1].weight} lb`} />
}

function LearningRow() {
  const mins = useLiveQuery(async () => {
    const s = await db.studySessions.where('date').between(startOfWeek(), today(), true, true).toArray()
    return s.reduce((n, x) => n + x.minutes, 0)
  }, [])
  if (!mins) return null
  const h = Math.floor(mins / 60)
  return <Row to="/learning" label="Learning this week" value={`${h > 0 ? `${h}h ` : ''}${mins % 60}m`} note="Since Monday" />
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtBday = (b: string) => `${MONTHS[Number(b.slice(0, 2)) - 1] ?? ''} ${Number(b.slice(3))}`

function PeopleRow() {
  const data = useLiveQuery(async () => {
    const d = today()
    const people = await db.people.toArray()
    const due = people.filter((p) => p.cadenceDays > 0 && (!p.lastContact || addDays(p.lastContact, p.cadenceDays) <= d))
    const soon = new Set(Array.from({ length: 14 }, (_, i) => addDays(d, i).slice(5)))
    const bdays = people.filter((p) => p.birthday && soon.has(p.birthday))
    return { total: people.length, due, bdays }
  }, [])
  if (!data || data.total === 0) return null
  const note = [
    data.due.slice(0, 2).map((p) => p.name).join(', '),
    data.bdays.length ? `Birthday: ${data.bdays.slice(0, 2).map((p) => `${p.name} ${fmtBday(p.birthday!)}`).join(', ')}` : '',
  ].filter(Boolean).join(' · ')
  return <Row to="/people" label="People to reach out to" value={data.due.length} note={note || 'Everyone is up to date'} />
}

export function GlanceTiles() {
  return (
    <section className="card glance">
      <div className="card-title"><span>Across your life</span></div>
      <MoneyRow />
      <FoodRow />
      <WeightRow />
      <LearningRow />
      <PeopleRow />
    </section>
  )
}
