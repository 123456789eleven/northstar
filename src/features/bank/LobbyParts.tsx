// Bank Lobby: the net worth hero (count-up, path with a flag every step, one-line balance update) and the safe-to-spend card.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useNumberRoll } from '../../components/motion'
import { useToast } from '../../components/toastContext'
import type { BalanceSnapshot, Budget, Transaction } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { FloorCard } from '../buildings/Floor'
import { Ring } from '../game/ui/Ring'
import { celebrate } from '../game/ui/feedback'
import { BossBar } from '../goals/BossBar'
import type { Checkpoint } from '../goals/boss'
import type { Bill } from '../finance/bills'
import { compactMoney, netWorthSeries } from '../finance/model'
import { netWorthMilestones } from '../finance/moneyGame'
import { addBalanceSnapshot } from '../finance/NetWorth'
import { NetWorthPath } from '../finance/NetWorthHero'
import { dueText, paceLine, safeToSpend } from '../finance/safeToSpend'
import { autoStep, changeOver, isNewHigh, paceText, paceToNext } from '../finance/wealth'
import { MonthStepper } from './bankNav'
import '../goals/quest.css'

const whole = (n: number) => `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`
const num = (s: string) => Number(s.replace(/[$,\s]/g, ''))

/** Latest balance per account, newest first. */
function latestAccounts(snaps: BalanceSnapshot[]): BalanceSnapshot[] {
  const m = new Map<string, BalanceSnapshot>()
  for (const s of [...snaps].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))) m.set(s.name, s)
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date) || b.balance - a.balance)
}

/** One line: account, new balance, Save. A new account name shows Asset / Owed. */
function UpdateBalance({ snaps }: { snaps: BalanceSnapshot[] }) {
  const toast = useToast()
  const accounts = latestAccounts(snaps)
  const [name, setName] = useState(accounts[0]?.name ?? '')
  const [amount, setAmount] = useState('')
  const [owed, setOwed] = useState(false)
  const known = accounts.find((a) => a.name === name.trim())
  const ok = name.trim() !== '' && amount.trim() !== '' && Number.isFinite(num(amount))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!ok) return
    const kind = known ? known.kind : owed ? 'liability' : 'asset'
    const high = await addBalanceSnapshot({ date: today(), name: name.trim(), kind, balance: Math.abs(num(amount)) })
    setAmount('')
    celebrate('tick')
    toast({ message: high != null ? `New all-time high: ${whole(high)}.` : `${name.trim()} updated.` })
  }

  return (
    <form className="bk-update" onSubmit={save} aria-label="Update a balance">
      <input className="input bk-update-name" list="bk-accounts" value={name} onChange={(e) => setName(e.target.value)} placeholder="Account" aria-label="Account" />
      <datalist id="bk-accounts">{accounts.map((a) => <option key={a.name} value={a.name} />)}</datalist>
      <input className="input mono bk-update-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={known ? String(known.balance) : 'Balance'} aria-label="New balance" />
      {!known && name.trim() !== '' && (
        <label className="bk-owed small"><input type="checkbox" className="check" checked={owed} onChange={(e) => setOwed(e.target.checked)} /> Owed</label>
      )}
      <button className="btn btn-primary" disabled={!ok}>{accounts.length ? 'Update' : 'Add'}</button>
    </form>
  )
}

export function LobbyHero({ snaps }: { snaps: BalanceSnapshot[] }) {
  const series = netWorthSeries(snaps)
  const now = series.at(-1)?.net ?? 0
  const shown = useNumberRoll(Math.round(now), 900)
  const [seen, setSeen] = useState(now)
  const [pop, setPop] = useState(0)
  if (seen !== now) { setPop(pop + 1); setSeen(now) }

  if (!series.length) {
    return (
      <section className="card floor-hero bk-hero" aria-label="Net worth">
        <div className="bk-hero-main">
          <span className="stat-label">Net worth</span>
          <p className="bk-first">Add your first balance. The path starts here.</p>
          <UpdateBalance snaps={snaps} />
        </div>
      </section>
    )
  }

  const t = today()
  const step = autoStep(Math.max(...series.map((p) => p.net), 0))
  const ms = netWorthMilestones(series, step)
  const next = ms.flags.find((f) => f.next)
  const earned = isNewHigh(series)
  const month = changeOver(series, 30, t)
  const prev = series.length > 1 ? series.at(-2)!.net : null
  const delta = month ?? (prev != null ? now - prev : null)
  // The path: from one step below the first flag to the next flag, a flag at every step.
  const lo = Math.min(series[0].net, (ms.flags[0]?.target ?? step) - step)
  const hi = next?.target ?? Math.max(now, lo + step)
  const span = Math.max(1, hi - lo)
  const progress = Math.min(1, Math.max(0, (now - lo) / span))
  const marks: Checkpoint[] = ms.flags.map((f) => ({ pos: Math.min(100, Math.max(0, ((f.target - lo) / span) * 100)), label: compactMoney(f.target), reached: f.reached }))

  return (
    <section className="card floor-hero bk-hero" aria-label="Net worth">
      <div className="bk-hero-top">
        <div className="bk-hero-main">
          <span className="stat-label">Net worth{earned && <span className="bk-high" data-testid="nw-high"> All-time high</span>}</span>
          <div className="bk-big-row">
            <span key={pop} className={`bk-big mono${pop ? ' tick-pop' : ''}`} data-testid="networth-hero">{whole(shown)}</span>
          </div>
          <p className="bk-sub mn-num">
            {delta != null && <span className={delta < 0 ? 'warn' : ''}>{delta >= 0 ? '+' : '-'}{whole(Math.abs(delta)).replace('-', '')} {month != null ? 'in 30 days' : 'since last update'}</span>}
            <span className="faint">as of {formatDate(series.at(-1)!.date, { month: 'short', day: 'numeric' })}</span>
          </p>
          <UpdateBalance snaps={snaps} />
        </div>
        {series.length > 1 && <div className="bk-hero-chart"><NetWorthPath data={series} /></div>}
      </div>
      <div className="bk-path">
        <BossBar hp={{ basis: 'metric', progress, hp: 1 - progress }} flags={marks} label="Net worth path to the next flag" showLabels />
        <p className="bk-pace small mn-num" data-testid="nw-next">{next && ms.toNext != null ? paceText(paceToNext(series, ms.toNext), ms.toNext, whole(next.target), whole) : 'Every flag crossed. New ones appear as you climb.'}</p>
      </div>
    </section>
  )
}

export function SafeCard({ month, setMonth, budgets, txs, bills, vaultHref }: { month: string; setMonth: (m: string) => void; budgets: Budget[]; txs: Transaction[]; bills: Bill[]; vaultHref: string }) {
  const t = today()
  const safe = safeToSpend(budgets, txs, bills, month, t)
  const shown = useNumberRoll(Math.round(safe?.left ?? 0))
  const closed = month < t.slice(0, 7)
  const stepper = <MonthStepper month={month} onChange={setMonth} />
  if (!safe) {
    return (
      <FloorCard title="Safe to spend" action={stepper} className="bk-safe">
        <div data-testid="safe-empty">
          <p className="bk-safe-empty" data-testid="month-status">No budget yet</p>
          <Link className="btn btn-primary btn-sm" to={vaultHref}>Set budgets</Link>
        </div>
      </FloorCard>
    )
  }
  const over = safe.left < 0
  const used = safe.budget > 0 ? safe.spent / safe.budget : 0
  const pace = paceLine(safe.budget, safe.spent, month, t)
  const nextBill = safe.billsDueList[0]
  return (
    <FloorCard title={closed ? 'Month closed' : 'Safe to spend'} action={stepper} className="bk-safe">
      <div className="bk-safe-body" data-testid="safe-hero">
        <div className="bk-safe-main">
          <div className={`bk-safe-num mono ${over ? 'is-bad' : ''}`} data-testid="safe-left">{shown < 0 ? '-' : ''}{whole(Math.abs(shown))}</div>
          <span className="sr-only" data-testid="month-status">{over ? `${whole(-safe.left)} over` : 'On budget'}</span>
          <div className="bk-inputs mn-num" data-testid="safe-inputs">
            <span>{whole(safe.budget)} budgeted</span><span>{whole(safe.spent)} spent</span><span>{whole(safe.billsDue)} bills</span>
          </div>
        </div>
        <Ring value={used} size={64} stroke={6} className={over || used > 1 ? 'mn-ring-hot' : ''} label={`${Math.round(used * 100)} percent of budget used`}>
          <span className="mn-ring-pct mn-num">{Math.round(used * 100)}%</span>
        </Ring>
      </div>
      {pace && <p className={`bk-line mn-pace is-${pace.status}`} data-testid="budget-pace">{pace.label}{!closed && `, ${safe.daysLeft} ${safe.daysLeft === 1 ? 'day' : 'days'} left`}</p>}
      {nextBill && !closed && <p className="bk-line faint mn-num">Next bill: {nextBill.name}, {money(nextBill.amount)}, {dueText(nextBill.due, t)}</p>}
    </FloorCard>
  )
}
