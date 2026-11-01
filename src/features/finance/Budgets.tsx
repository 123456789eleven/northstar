import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Card, Empty, Progress } from '../../components/ui'
import { db, logEvent } from '../../db'
import { money } from '../../lib/dates'
import { EXPENSE_CATEGORIES } from './categories'
import { monthLabel, monthRange, moneyExact, shiftMonth, useMonthTx } from './model'
import { budgetStatus } from './quickAdd'
import BillsSection from './BillsSection'
import { budgetSpend, cadenceText, type BillInfo } from './bills'
import { useBills } from './billsData'

async function saveBudget(category: string, limit: number) {
  const before = await db.budgets.count()
  const existing = await db.budgets.where('category').equals(category).first()
  if (limit <= 0) {
    if (existing) await db.budgets.delete(existing.id!)
    return
  }
  const id = existing ? (await db.budgets.update(existing.id!, { monthlyLimit: limit }), existing.id!) : await db.budgets.add({ category, monthlyLimit: limit })
  if (before === 0) await logEvent({ area: 'finance', kind: 'finance.budget', title: `Set first budget: ${category} ${money(limit)}/mo`, refTable: 'budgets', refId: id })
}

export default function Budgets({ month }: { month: string }) {
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const txs = useMonthTx(month)
  const prev = shiftMonth(month, -1)
  const [pa, pb] = monthRange(prev)
  const prevTx = useLiveQuery(() => db.transactions.where('date').between(pa, pb, true, true).toArray(), [pa, pb])
  const bills = useBills()
  const [msg, setMsg] = useState('')

  if (!budgets || !txs || !prevTx || !bills) return null

  const { spent, billInfo } = budgetSpend(txs, bills)
  const prevSpent = budgetSpend(prevTx, bills).spent
  const limitOf = new Map(budgets.map((b) => [b.category, b.monthlyLimit]))
  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0)
  const totalSpent = budgets.reduce((s, b) => s + Math.max(0, spent.get(b.category) ?? 0), 0)
  const unbudgetedSpend = [...spent.entries()].filter(([c, v]) => !limitOf.has(c) && v > 0).reduce((s, [, v]) => s + v, 0)
  const copyable = EXPENSE_CATEGORIES.filter((c) => !limitOf.has(c) && (prevSpent.get(c) ?? 0) > 0)

  async function copyLastMonth() {
    for (const c of copyable) await saveBudget(c, Math.ceil((prevSpent.get(c) ?? 0) / 10) * 10)
    setMsg(`Added ${copyable.length} budget${copyable.length === 1 ? '' : 's'} from ${monthLabel(prev)} spending, rounded up to the nearest $10. Adjust any below.`)
  }

  const ordered = [...EXPENSE_CATEGORIES].sort((a, b) => Number(limitOf.has(b)) - Number(limitOf.has(a)))

  return (
    <div className="stack" style={{ gap: 16 }}>
      {budgets.length > 0 ? (
        <Card title={`Total · ${monthLabel(month)}`}>
          <div className="row-between" style={{ alignItems: 'baseline' }}>
            <span className="stat-value" style={{ marginTop: 0 }}>
              {money(totalSpent)}
              
            </span>
            <LeftLabel spent={totalSpent} limit={totalLimit} />
          </div>
          <div style={{ marginTop: 10 }}>
            <BudgetBar spent={totalSpent} limit={totalLimit} />
          </div>
          {unbudgetedSpend > 0 && <div className="tiny faint" style={{ marginTop: 8 }}>Plus {money(unbudgetedSpend)} in categories without a budget.</div>}
        </Card>
      ) : (
        <Card>
          <Empty>
            <p style={{ margin: '0 0 12px' }}>No budgets yet. Type a monthly limit next to any category below{copyable.length > 0 ? `, or start from what you actually spent in ${monthLabel(prev)}` : ''}.</p>
            {copyable.length > 0 && (
              <button className="btn btn-primary" onClick={copyLastMonth}>
                Use {monthLabel(prev, true)} spending as budgets
              </button>
            )}
          </Empty>
        </Card>
      )}

      {msg && <div className="small muted">{msg}</div>}

      <Card
        title="Monthly limits"
        action={
          budgets.length > 0 && copyable.length > 0 ? (
            <button className="btn btn-sm" onClick={copyLastMonth} title={`Fill ${copyable.length} empty categories from ${monthLabel(prev)}`}>
              Fill empty from {monthLabel(prev, true)}
            </button>
          ) : undefined
        }
      >
        <div className="list">
          {ordered.map((c) => (
            <BudgetRow key={c} category={c} limit={limitOf.get(c)} spent={Math.max(0, spent.get(c) ?? 0)} lastMonth={prevSpent.get(c) ?? 0} bill={billInfo.get(c)} />
          ))}
        </div>
      </Card>

      <BillsSection bills={bills} />
    </div>
  )
}

/** "$120.00 left" / "$30.00 over", with the spent-of-limit pair beside it. */
function LeftLabel({ spent, limit }: { spent: number; limit: number }) {
  const st = budgetStatus(spent, limit)
  return (
    <span className="mono small fin-left">
      <span className="muted">{moneyExact(spent)} of {moneyExact(limit)}</span>
      <span className={st.state === 'over' ? 'warn' : st.state === 'near' ? 'fin-near-text' : ''}>
        {st.left >= 0 ? `${moneyExact(st.left)} left` : `${moneyExact(-st.left)} over`}
      </span>
    </span>
  )
}

function BudgetBar({ spent, limit }: { spent: number; limit: number }) {
  const ratio = limit > 0 ? spent / limit : 0
  return (
    <div className={ratio > 1 ? 'fin-over' : ratio > 0.9 ? 'fin-near' : ''}>
      <Progress value={ratio * 100} label="Budget used" />
    </div>
  )
}

function BudgetRow({ category, limit, spent, lastMonth, bill }: { category: string; limit?: number; spent: number; lastMonth: number; bill?: BillInfo }) {
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? (limit ? String(limit) : '')

  async function commit() {
    if (draft === null) return
    const n = Number(draft.replace(/[$,\s]/g, ''))
    setDraft(null)
    if (!Number.isFinite(n)) return
    if ((limit ?? 0) === n) return
    await saveBudget(category, Math.round(n * 100) / 100)
  }

  return (
    <div className="list-item fin-budget-row">
      <div className="grow">
        <div className="row-between small">
          <span>{category}</span>
          {limit ? (
            <LeftLabel spent={spent} limit={limit} />
          ) : (
            <span className="mono muted">{moneyExact(spent)}</span>
          )}
        </div>
        {limit ? (
          <div style={{ marginTop: 6 }}>
            <BudgetBar spent={spent} limit={limit} />
            {bill && (
              <div className="tiny muted" style={{ marginTop: 4 }}>
                Bill: {money(bill.monthly)}/mo set aside (paid {bill.bills.map((b) => cadenceText(b, money)).join(' + ')})
              </div>
            )}
          </div>
        ) : (
          <div className="tiny faint">{lastMonth > 0 ? `Last month ${money(lastMonth)}` : 'No budget'}</div>
        )}
      </div>
      <input
        className="input fin-budget-input mono"
        inputMode="decimal"
        placeholder="Limit"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label={`${category} monthly limit`}
      />
    </div>
  )
}
