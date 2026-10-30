// Read-only glance tiles over other modules' tables. Any of them may be empty.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { Progress } from '../../components/ui'
import { addDays, monthKey, money, startOfWeek, today } from '../../lib/dates'

function Tile({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link to={to} className="tile">
      <span className="stat-label">{label}</span>
      {children}
    </Link>
  )
}

function MoneyTile() {
  const data = useLiveQuery(async () => {
    const m = monthKey()
    const tx = await db.transactions.where('date').between(`${m}-01`, `${m}-31`, true, true).toArray()
    const budgets = await db.budgets.toArray()
    const spent = tx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0)
    const limit = budgets.reduce((s, b) => s + b.monthlyLimit, 0)
    return { spent, limit, count: tx.length }
  }, [])
  return (
    <Tile to="/finance" label="Spent this month">
      {data && (data.count > 0 || data.limit > 0) ? (
        <>
          <span className="tile-value">
            {money(data.spent)}
            {data.limit > 0 && <span className="of"> of {money(data.limit)}</span>}
          </span>
          {data.limit > 0 && <Progress value={(data.spent / data.limit) * 100} />}
          <span className={`tile-note ${data.limit > 0 && data.spent > data.limit ? 'warn' : ''}`}>
            {data.limit > 0 ? (data.spent > data.limit ? `${money(data.spent - data.limit)} over budget` : `${money(data.limit - data.spent)} left`) : 'Set budgets on Finance'}
          </span>
        </>
      ) : (
        <span className="tile-empty">Import a bank CSV, or type "$12 lunch" above.</span>
      )}
    </Tile>
  )
}

function FoodTile() {
  const meals = useLiveQuery(() => db.meals.where('date').equals(today()).toArray(), [])
  const cal = (meals ?? []).reduce((s, m) => s + (m.calories ?? 0), 0)
  return (
    <Tile to="/food" label="Food today">
      {meals && meals.length > 0 ? (
        <>
          <span className="tile-value">
            {cal > 0 ? cal.toLocaleString() : meals.length}
            <span className="of"> {cal > 0 ? 'cal' : meals.length === 1 ? 'meal' : 'meals'}</span>
          </span>
          <span className="tile-note">
            {meals.length} meal{meals.length === 1 ? '' : 's'} · {meals.map((m) => m.name).slice(-2).join(', ')}
          </span>
        </>
      ) : (
        <span className="tile-empty">Nothing logged. Type "ate oatmeal 350cal" above.</span>
      )}
    </Tile>
  )
}

function LearningTile() {
  const mins = useLiveQuery(async () => {
    const s = await db.studySessions.where('date').between(startOfWeek(), today(), true, true).toArray()
    return s.reduce((n, x) => n + x.minutes, 0)
  }, [])
  const h = Math.floor((mins ?? 0) / 60)
  const m = (mins ?? 0) % 60
  return (
    <Tile to="/learning" label="Learning this week">
      {mins ? (
        <>
          <span className="tile-value">
            {h > 0 && (
              <>
                {h}
                <span className="of">h </span>
              </>
            )}
            {m}
            <span className="of">m</span>
          </span>
          <span className="tile-note">Since Monday</span>
        </>
      ) : (
        <span className="tile-empty">No study time yet this week. Log a session on Learning.</span>
      )}
    </Tile>
  )
}

function PeopleTile() {
  const data = useLiveQuery(async () => {
    const d = today()
    const people = await db.people.toArray()
    const due = people.filter((p) => p.cadenceDays > 0 && (!p.lastContact || addDays(p.lastContact, p.cadenceDays) <= d))
    const soon = new Set(Array.from({ length: 14 }, (_, i) => addDays(d, i).slice(5)))
    const bdays = people.filter((p) => p.birthday && soon.has(p.birthday))
    return { total: people.length, due, bdays }
  }, [])
  return (
    <Tile to="/people" label="People">
      {data && data.total > 0 ? (
        data.due.length || data.bdays.length ? (
          <>
            <span className="tile-value">
              {data.due.length}
              <span className="of"> to reach out to</span>
            </span>
            <span className="tile-note">
              {[
                data.due.slice(0, 2).map((p) => p.name).join(', '),
                data.bdays.length ? `Birthday: ${data.bdays.slice(0, 2).map((p) => `${p.name} ${p.birthday}`).join(', ')}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </>
        ) : (
          <>
            <span className="tile-value">
              0<span className="of"> due</span>
            </span>
            <span className="tile-note">Everyone is up to date.</span>
          </>
        )
      ) : (
        <span className="tile-empty">Add the people you want to stay close to.</span>
      )}
    </Tile>
  )
}

export function GlanceTiles() {
  return (
    <div className="glance">
      <MoneyTile />
      <FoodTile />
      <LearningTile />
      <PeopleTile />
    </div>
  )
}
