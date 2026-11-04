// Money overview hero: month status + the monthly boss (stay within the total budget), savings-rate ring,
// no-spend-day calendar and the bills set-aside strip. Everything is derived from transactions, budgets and bills.
import { useEffect, useState, type CSSProperties } from 'react'
import { useNumberRoll } from '../../components/motion'
import type { Budget, Transaction } from '../../db'
import { money, today } from '../../lib/dates'
import { Ring } from '../game/ui/Ring'
import '../g3/g3.css'
import { daysToDue, monthlySetAside, nextDue, type Bill } from './bills'
import { bossState, noSpendCount, noSpendDays } from './moneyGame'
import { moneyExact, monthLabel, pct } from './model'

function BossBar({ hp, marker, status, show }: { hp: number; marker: number; status: string; show: boolean }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(hp))
    return () => cancelAnimationFrame(id)
  }, [hp])
  return (
    <div className={`boss-hp is-${status}`}>
      <div className="boss-fill" style={{ '--p': shown } as CSSProperties} />
      {show && <span className="boss-tick" style={{ left: `${(1 - marker) * 100}%` }} aria-hidden />}
    </div>
  )
}

export default function MoneyHero({ month, spent, totalSpent, budgets, savingsRate, txs, bills, onBudgets }: {
  month: string
  spent: Map<string, number>
  totalSpent: number
  budgets: Budget[]
  savingsRate: number | null
  txs: Transaction[]
  bills: Bill[]
  onBudgets: () => void
}) {
  const t = today()
  const limits = budgets.filter((b) => b.monthlyLimit > 0)
  const totalLimit = limits.reduce((s, b) => s + b.monthlyLimit, 0)
  const budgetSpent = limits.reduce((s, b) => s + Math.max(0, spent.get(b.category) ?? 0), 0)
  const boss = bossState(totalLimit, budgetSpent, month, t)
  const days = noSpendDays(txs, month, t)
  const nsCount = noSpendCount(days)
  const lead = (new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).getDay() + 6) % 7
  const hpNum = useNumberRoll(Math.round(boss?.remaining ?? 0))
  const setAside = monthlySetAside(bills)
  const upcoming = [...bills].sort((a, b) => daysToDue(a, t) - daysToDue(b, t)).slice(0, 4)
  const current = month === t.slice(0, 7)

  const status = boss ? (boss.over > 0 ? 'Over budget' : boss.status === 'won' ? 'Boss cleared' : boss.status === 'watch' ? 'Ahead of pace' : 'On budget') : 'No budget set'

  return (
    <section className="card mhero" aria-label={`${monthLabel(month)} status`}>
      <div className="mhero-main">
        <span className="stat-label">{monthLabel(month)}</span>
        <div className={`mhero-status ${boss && boss.over > 0 ? 'is-over' : ''}`} data-testid="month-status">
          {boss ? (boss.over > 0 ? `${money(boss.over)} over` : 'On budget') : 'No budget yet'}
        </div>
        {boss ? (
          <div className="boss" data-testid="boss-card">
            <div className="boss-head">
              <span className="boss-title">Monthly boss: stay within your budget</span>
              <span className="boss-state">{status}</span>
            </div>
            <BossBar hp={boss.hp} marker={boss.marker} status={boss.status} show={current && boss.marker > 0 && boss.marker < 1} />
            <div className="boss-words">
              <span><strong className="mono" data-testid="boss-hp">{hpNum.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</strong> of {money(totalLimit)} left</span>
              <span>{current ? `${boss.daysLeft} day${boss.daysLeft === 1 ? '' : 's'} left` : 'Month closed'}</span>
            </div>
            <div className="faint tiny">Spent {moneyExact(budgetSpent)} against your budgets{totalSpent - budgetSpent > 0.5 ? `, plus ${money(totalSpent - budgetSpent)} outside them` : ''}. The tick marks how much of the month has passed.</div>
          </div>
        ) : (
          <div className="boss" data-testid="boss-empty">
            <div className="boss-title">Set a budget to start a monthly boss</div>
            <p className="small muted" style={{ margin: 0 }}>Its health is the budget you have left. Stay within it until the month ends.</p>
            <div><button className="btn btn-primary btn-sm" onClick={onBudgets}>Set budgets</button></div>
          </div>
        )}
      </div>

      <div className="mhero-side">
        <div className="mhero-ring">
          <Ring value={savingsRate == null ? 0 : Math.max(0, Math.min(1, savingsRate))} size={96} stroke={9} tone="money" label={savingsRate == null ? 'Savings rate: no income this month' : `Savings rate ${pct(savingsRate)}`}>
            <span className="mhero-ring-num mono">{savingsRate == null ? '--' : pct(savingsRate)}</span>
          </Ring>
          <div>
            <div className="stat-label">Savings rate</div>
            <div className="small muted">{savingsRate == null ? 'No income yet' : savingsRate >= 0 ? 'of income kept' : 'spending is above income'}</div>
          </div>
        </div>
        <div className="nsd">
          <div className="nsd-head"><span className="stat-label">No-spend days</span><span className="mono small" data-testid="nospend-count">{nsCount}</span></div>
          <ol className="nsd-grid" aria-label={`${nsCount} no-spend days so far this month`}>
            {Array.from({ length: lead }, (_, i) => <li key={`l${i}`} className="nsd-pad" aria-hidden />)}
            {days.map((d) => (
              <li key={d.date} className={`nsd-day is-${d.state}`}>
                <span aria-hidden>{d.day}</span>
                <span className="sr-only">{`${d.date}: ${d.state === 'nospend' ? 'no spending' : d.state === 'spent' ? 'spent' : 'upcoming'}`}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {bills.length > 0 && (
        <div className="mhero-bills">
          <span className="stat-label">Bills set aside</span>
          <span className="mono small">{money(setAside)} / month</span>
          <ul className="mhero-bill-list">
            {upcoming.map((b) => (
              <li key={b.id} className="chip">{b.name} <span className="mono faint">{daysToDue(b, t) < 0 ? 'due' : `${daysToDue(b, t)}d`}</span><span className="sr-only"> next due {nextDue(b)}</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
