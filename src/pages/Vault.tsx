// Bank, Vault floor: budgets as envelopes that fill as you spend (one line logs a purchase and its envelope sweeps), bills
// due with a one-tap Paid (the row slides out and the next due date moves on), set-asides and no-spend days.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { PageSkeleton } from '../components/ui'
import { useNumberRoll } from '../components/motion'
import { useToast } from '../components/toastContext'
import { db, type Budget, type Transaction } from '../db'
import { formatDate, money, today } from '../lib/dates'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { BankView, MonthStepper, useBankMonth, useView, useViewHref } from '../features/bank/bankNav'
import { celebrate } from '../features/game/ui/feedback'
import Budgets from '../features/finance/Budgets'
import { BillModal, blankBill, upsertBill } from '../features/finance/BillsSection'
import { accrued, budgetSpend, daysToDue, monthlySetAside, nextDue, type Bill } from '../features/finance/bills'
import { saveBills, useBills } from '../features/finance/billsData'
import { CATEGORIES, categorize, INCOME, UNCATEGORIZED } from '../features/finance/categories'
import { moneyExact, useMonthTx, useRules } from '../features/finance/model'
import { budgetPace, dayOfMonthFor, daysInMonthOf, noSpendCount, noSpendDays } from '../features/finance/moneyGame'
import { BillsCard, SubscriptionsCard } from '../features/finance/OverviewCards'
import { parseQuickAdd } from '../features/finance/quickAdd'
import { dueText } from '../features/finance/safeToSpend'
import '../features/finance/finance.css'
import '../features/finance/money.css'
import '../features/bank/bank.css'

const whole = (n: number) => Math.round(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** One line: "Coffee 4.50" spends, "Refund +20" receives. The category is guessed; pick one to override. */
function QuickSpend({ month, onLogged }: { month: string; onLogged: (category: string) => void }) {
  const toast = useToast()
  const rules = useRules()
  const [text, setText] = useState('')
  const [cat, setCat] = useState('')
  const q = parseQuickAdd(text)
  const signed = q ? (q.dir === 'out' ? -q.amount : q.amount) : 0
  const guess = q ? categorize(q.description, signed, rules.all) : ''
  const category = cat || (guess === UNCATEGORIZED && q?.dir === 'in' ? INCOME : guess) || UNCATEGORIZED

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!q) return
    const t = today()
    const date = t.startsWith(month) ? t : `${month}-01`
    const id = await db.transactions.add({ date, description: q.description, amount: Math.round(signed * 100) / 100, category })
    setText('')
    setCat('')
    celebrate('tick')
    onLogged(category)
    toast({ message: `${q.dir === 'out' ? 'Spent' : 'Received'} ${moneyExact(q.amount)}, ${category}.`, undo: async () => { await db.transactions.delete(id) } })
  }

  return (
    <>
      <form className="vt-quick" onSubmit={add}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Coffee 4.50" aria-label="Log spending" autoComplete="off" />
        <select className="select" style={{ width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">{q && guess !== UNCATEGORIZED ? guess : 'Auto'}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!q}>Log</button>
      </form>
      <p className="vt-quick-hint mn-num" aria-live="polite">{q ? `${q.dir === 'out' ? '-' : '+'}${moneyExact(q.amount)} to ${category}` : ''}</p>
    </>
  )
}

function Envelopes({ month, setMonth, budgets, txs, bills, hit, onLogged }: { month: string; setMonth: (m: string) => void; budgets: Budget[]; txs: Transaction[]; bills: Bill[]; hit: string | null; onLogged: (c: string) => void }) {
  const t = today()
  const { spent } = budgetSpend(txs, bills)
  const dim = daysInMonthOf(month)
  const marker = month === t.slice(0, 7) ? dayOfMonthFor(month, t) / dim : month < t.slice(0, 7) ? 1 : 0
  const rows = budgets.filter((b) => b.monthlyLimit > 0).map((b) => {
    const sp = Math.max(0, spent.get(b.category) ?? 0)
    return { ...b, spent: sp, ratio: sp / b.monthlyLimit, left: b.monthlyLimit - sp }
  }).sort((a, b) => a.category.localeCompare(b.category))
  const limit = rows.reduce((s, r) => s + r.monthlyLimit, 0)
  const used = rows.reduce((s, r) => s + r.spent, 0)
  const left = limit - used
  const shown = useNumberRoll(Math.round(left), 700)
  const pace = budgetPace(used, limit, dayOfMonthFor(month, t), dim)
  // The fills sweep in from empty on arrival, then spring to each new value.
  const [ready, setReady] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id) }, [])
  const href = useViewHref()

  return (
    <section className="card floor-hero vt-hero" aria-label="Envelopes">
      <div className="vt-head">
        <div className="vt-left">
          <span className="stat-label">{rows.length ? 'Left in envelopes' : 'Envelopes'}</span>
          {rows.length > 0 && <span className={`bk-big mono${left < 0 ? ' is-bad' : ''}`} data-testid="vault-left">{shown < 0 ? '-' : ''}{whole(Math.abs(shown))}</span>}
          {rows.length > 0 && <span className="small muted mn-num">of {whole(limit)} · <span className={pace.status === 'over' ? 'warn' : ''}>{pace.label}</span></span>}
        </div>
        <MonthStepper month={month} onChange={setMonth} />
      </div>
      <QuickSpend month={month} onLogged={onLogged} />
      {rows.length === 0 ? (
        <div>
          <p className="bk-empty">No envelopes yet. Give a category a monthly limit.</p>
          <Link className="btn btn-primary btn-sm" to={href('limits')}>Set limits</Link>
        </div>
      ) : (
        <ul className="vt-envs" aria-label="Budget envelopes">
          {rows.map((r) => {
            const over = r.ratio > 1
            return (
              <li key={r.category}>
                <Link
                  to={`/finance/archive?category=${encodeURIComponent(r.category)}&month=${month}`}
                  className={`vt-env${over ? ' is-over' : ''}${hit === r.category ? ' is-hit' : ''}`}
                  aria-label={`${r.category}: ${moneyExact(r.spent)} of ${moneyExact(r.monthlyLimit)}, ${over ? `${moneyExact(-r.left)} over` : `${moneyExact(r.left)} left`}`}
                >
                  <i className="vt-fill" style={{ '--fill': ready ? Math.min(1, r.ratio) : 0 } as CSSProperties} aria-hidden="true" />
                  {marker > 0 && marker < 1 && <i className="vt-tick" style={{ left: `${marker * 100}%` }} aria-hidden="true" />}
                  <span className="vt-env-name">{r.category}</span>
                  <span className="vt-env-left">{over ? `${whole(-r.left)} over` : whole(r.left)}</span>
                  <span className="vt-env-of">{whole(r.spent)} of {whole(r.monthlyLimit)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function BillsDue({ bills }: { bills: Bill[] }) {
  const toast = useToast()
  const t = today()
  const [leaving, setLeaving] = useState<string | null>(null)
  const [adding, setAdding] = useState<Bill | null>(null)
  const due = [...bills].sort((a, b) => daysToDue(a, t) - daysToDue(b, t)).slice(0, 4)

  function paid(b: Bill) {
    setLeaving(b.id)
    window.setTimeout(async () => {
      const before = bills
      await saveBills(bills.map((x) => (x.id === b.id ? { ...x, lastPaid: t } : x)))
      setLeaving(null)
      celebrate('tick')
      toast({ message: `${b.name} paid. Next due ${formatDate(nextDue({ ...b, lastPaid: t }))}.`, undo: () => saveBills(before) })
    }, 320)
  }

  return (
    <FloorCard title="Bills due" action={<button className="btn btn-ghost btn-sm" onClick={() => setAdding(blankBill())}>Add bill</button>}>
      {due.length === 0 ? (
        <p className="bk-empty">No bills yet. Add insurance or anything not monthly.</p>
      ) : (
        <ul className="bk-list">
          {due.map((b) => {
            const d = daysToDue(b, t)
            return (
              <li key={b.id} className={`bk-li vt-bill${leaving === b.id ? ' is-paid' : ''}`}>
                <span className="bk-li-main">
                  <span>{b.name}</span>
                  <span className={`bk-li-sub${d < 0 ? ' is-late' : ''}`}>{formatDate(nextDue(b), { month: 'short', day: 'numeric' })}, {dueText(nextDue(b), t)}</span>
                </span>
                <span className="bk-li-end mono">{money(b.amount)}</span>
                <button className="btn btn-sm" disabled={leaving != null} onClick={() => paid(b)} aria-label={`Mark ${b.name} paid`}>Paid</button>
              </li>
            )
          })}
        </ul>
      )}
      {adding && createPortal(<BillModal bill={adding} isNew onClose={() => setAdding(null)} onSave={upsertBill} onDelete={() => setAdding(null)} />, document.body)}
    </FloorCard>
  )
}

function SetAsides({ bills }: { bills: Bill[] }) {
  const t = today()
  const total = bills.reduce((s, b) => s + accrued(b, t), 0)
  return (
    <FloorCard title="Set-asides">
      {bills.length === 0 ? <p className="bk-empty">Bills you add get a monthly share set aside here.</p> : (
        <>
          <p className="vt-big-line mn-num"><strong>{whole(total)}</strong> <span className="muted small">saved, {whole(monthlySetAside(bills))} a month</span></p>
          <div className="vt-aside">
            {bills.slice(0, 4).map((b) => {
              const got = accrued(b, t)
              return (
                <div key={b.id} className="vt-aside-row">
                  <div className="vt-aside-top"><span>{b.name}</span><span className="mono muted">{whole(got)} of {whole(b.amount)}</span></div>
                  <div className="vt-bar" role="progressbar" aria-label={`${b.name} set aside`} aria-valuenow={Math.round((got / b.amount) * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ '--p': Math.min(1, got / b.amount) } as CSSProperties} />
                  </div>
                </div>
              )
            })}
            {bills.length > 4 && <span className="bk-fine">and {bills.length - 4} more</span>}
          </div>
        </>
      )}
    </FloorCard>
  )
}

function NoSpend({ month, txs }: { month: string; txs: Transaction[] }) {
  const t = today()
  const days = noSpendDays(txs, month, t)
  const n = noSpendCount(days)
  const lead = (new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).getDay() + 6) % 7
  return (
    <FloorCard title="No-spend days">
      <p className="vt-big-line mn-num"><strong data-testid="nospend-count">{n}</strong> <span className="muted small">{n === 1 ? 'day' : 'days'} clear this month</span></p>
      <ol className="vt-days" aria-label="No-spend days this month">
        {Array.from({ length: lead }, (_, i) => <li key={`p${i}`} aria-hidden="true" />)}
        {days.map((d) => (
          <li key={d.date} className={`vt-day is-${d.state}${d.date === t ? ' is-today' : ''}`} aria-label={`${d.day}: ${d.state === 'nospend' ? 'no spending' : d.state === 'spent' ? 'spent' : 'ahead'}`}>
            <span aria-hidden="true">{d.day}</span>
          </li>
        ))}
      </ol>
    </FloorCard>
  )
}

export default function Vault() {
  const [month, setMonth] = useBankMonth()
  const view = useView()
  const navigate = useNavigate()
  const href = useViewHref()
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const allTx = useLiveQuery(() => db.transactions.toArray(), [])
  const txs = useMonthTx(month)
  const bills = useBills()
  const [hit, setHit] = useState<string | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const logged = (c: string) => { setHit(c); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setHit(null), 900) }

  if (view === 'limits') return <BankView title="Limits and bills"><Budgets month={month} /></BankView>
  if (!budgets || !txs || !bills || !allTx) return <PageSkeleton rows={4} />

  return (
    <FloorView
      label="Vault"
      className="bk bk-vault"
      hero={<Envelopes month={month} setMonth={setMonth} budgets={budgets} txs={txs} bills={bills} hit={hit} onLogged={logged} />}
      support={[<BillsDue key="bills" bills={bills} />, bills.length > 0 && <SetAsides key="aside" bills={bills} />, <NoSpend key="nospend" month={month} txs={txs} />]}
      more={
        <FloorMore
          floor="Vault"
          items={[
            { id: 'limits', label: 'Limits and bills', to: href('limits') },
            { id: 'calendar', label: 'Bills calendar', panel: <BillsCard month={month} bills={bills} go={() => navigate(href('limits'))} /> },
            { id: 'subs', label: 'Subscriptions', panel: <SubscriptionsCard allTx={allTx} /> },
          ]}
        />
      }
    />
  )
}
