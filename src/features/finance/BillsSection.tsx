import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Card, Empty, Field, Modal, Progress } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { db, logEvent } from '../../db'
import { addDays, formatDate, money, today } from '../../lib/dates'
import { accrued, cadenceText, daysToDue, detectBillSuggestions, MAX_BILLS, monthlyEquivalent, monthlySetAside, nextDue, PRESET_CADENCES, type Bill, type BillSuggestion } from './bills'
import { readBills, saveBills } from './billsData'
import { EXPENSE_CATEGORIES } from './categories'
import { moneyExact } from './model'

const nowISO = () => new Date().toISOString()
const dueText = (d: number) => (d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'due today' : `in ${d} day${d === 1 ? '' : 's'}`)

export default function BillsSection({ bills }: { bills: Bill[] }) {
  const toast = useToast()
  const allTx = useLiveQuery(() => db.transactions.toArray(), [])
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const openTasks = useLiveQuery(() => db.tasks.where('status').equals('open').toArray(), [])
  const [editing, setEditing] = useState<Bill | null>(null)
  const now = today()

  const suggestions = useMemo(() => (allTx && budgets ? detectBillSuggestions(allTx, budgets, bills, now) : []), [allTx, budgets, bills, now])
  const full = bills.length >= MAX_BILLS

  async function upsert(b: Bill, isNew: boolean) {
    const cur = await readBills()
    const next = cur.some((x) => x.id === b.id) ? cur.map((x) => (x.id === b.id ? b : x)) : [...cur, b]
    await saveBills(next)
    if (isNew) await logEvent({ area: 'finance', kind: 'finance.bill', title: `Added bill: ${b.name} ${money(b.amount)} every ${b.everyMonths} mo` })
  }
  async function remove(b: Bill) {
    const before = await readBills()
    await saveBills(before.filter((x) => x.id !== b.id))
    setEditing(null)
    toast({ message: `Deleted bill "${b.name}"`, undo: () => saveBills(before) })
  }
  const fromSuggestion = (s: BillSuggestion): Bill => ({ id: crypto.randomUUID(), name: s.name, amount: s.amount, everyMonths: s.everyMonths, lastPaid: s.lastPaid, category: s.category, matchText: s.matchText })
  async function addReminder(b: Bill) {
    const due = addDays(nextDue(b), -7)
    const id = await db.tasks.add({ title: `Pay ${b.name}`, notes: `${moneyExact(b.amount)} due ${formatDate(nextDue(b))}`, due, priority: 2, status: 'open', recurrence: 'none', createdAt: nowISO() })
    toast({ message: `Reminder added for ${formatDate(due)}`, undo: async () => { await db.tasks.delete(id) } })
  }

  return (
    <Card
      title="Bills"
      action={
        <button className="btn btn-sm" disabled={full} onClick={() => setEditing({ id: crypto.randomUUID(), name: '', amount: 0, everyMonths: 6, lastPaid: now, category: 'Insurance' })}>
          Add bill
        </button>
      }
    >
      {bills.length === 0 ? (
        <Empty>A bill is a payment that is not monthly, like car insurance every 6 months or an annual subscription; its monthly share is set aside in your budget instead of landing as one big overspend.</Empty>
      ) : (
        <>
          <div className="list">
            {bills.map((b) => {
              const d = daysToDue(b, now)
              const got = accrued(b, now)
              const needsReminder = d <= 21 && !(openTasks ?? []).some((t) => t.title.toLowerCase().includes(b.name.toLowerCase()))
              return (
                <div key={b.id} className="list-item fin-bill">
                  <div className="grow">
                    <div className="row-between small">
                      <button className="fin-bill-name" onClick={() => setEditing(b)} aria-label={`Edit ${b.name}`}>{b.name}</button>
                      <span className="mono">{moneyExact(monthlyEquivalent(b))}/mo</span>
                    </div>
                    <div className="tiny faint">
                      {b.category} · {cadenceText(b, moneyExact)} · next {formatDate(nextDue(b))} ({dueText(d)})
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Progress value={(got / b.amount) * 100} label={`${b.name} set aside`} />
                    </div>
                    <div className="tiny muted" style={{ marginTop: 4 }}>
                      {moneyExact(got)} set aside of {moneyExact(b.amount)}
                    </div>
                    {needsReminder && openTasks && (
                      <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => addReminder(b)}>
                        Add reminder task
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="small" style={{ marginTop: 10 }}>
            <span className="muted">Monthly set-aside across bills: </span>
            <strong className="mono">{moneyExact(monthlySetAside(bills))}</strong>
          </div>
        </>
      )}

      {suggestions.length > 0 && !full && (
        <div style={{ marginTop: 14 }}>
          <div className="tiny faint" style={{ marginBottom: 6 }}>Looks like a bill</div>
          <div className="list">
            {suggestions.map((s) => (
              <div key={s.key} className="list-item small">
                <span className="grow">
                  {s.name} <span className="mono">{moneyExact(s.amount)}</span>
                  <span className="tiny faint"> · {s.category} · {s.reason}</span>
                </span>
                {s.confirm ? (
                  <button className="btn btn-sm" onClick={() => setEditing(fromSuggestion(s))}>Add as a bill</button>
                ) : (
                  <button className="btn btn-sm" onClick={() => upsert(fromSuggestion(s), true)}>Add as a bill</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && <BillModal bill={editing} isNew={!bills.some((b) => b.id === editing.id)} onClose={() => setEditing(null)} onSave={upsert} onDelete={remove} />}
    </Card>
  )
}

function BillModal({ bill, isNew, onClose, onSave, onDelete }: { bill: Bill; isNew: boolean; onClose: () => void; onSave: (b: Bill, isNew: boolean) => Promise<void>; onDelete: (b: Bill) => void }) {
  const [name, setName] = useState(bill.name)
  const [amount, setAmount] = useState(bill.amount ? String(bill.amount) : '')
  const [every, setEvery] = useState(PRESET_CADENCES.includes(bill.everyMonths) ? String(bill.everyMonths) : 'custom')
  const [custom, setCustom] = useState(String(bill.everyMonths))
  const [lastPaid, setLastPaid] = useState(bill.lastPaid)
  const [category, setCategory] = useState(bill.category)
  const [matchText, setMatchText] = useState(bill.matchText ?? '')
  const [account, setAccount] = useState(bill.account ?? '')

  const amt = Number(amount.replace(/[$,\s]/g, ''))
  const months = every === 'custom' ? Math.round(Number(custom)) : Number(every)
  const ok = name.trim() !== '' && amt > 0 && months >= 1 && months <= 24 && /^\d{4}-\d{2}-\d{2}$/.test(lastPaid)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ok) return
    await onSave({ id: bill.id, name: name.trim(), amount: Math.round(amt * 100) / 100, everyMonths: months, lastPaid, category, matchText: matchText.trim().toLowerCase() || undefined, account: account.trim() || undefined }, isNew)
    onClose()
  }

  return (
    <Modal title={isNew ? 'Add bill' : 'Edit bill'} onClose={onClose}>
      <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="grid grid-2">
          <Field label="Amount per payment"><input className="input mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Paid every">
            <select className="select" value={every} onChange={(e) => setEvery(e.target.value)}>
              {PRESET_CADENCES.map((n) => <option key={n} value={n}>{n === 1 ? 'Month' : n === 12 ? 'Year' : `${n} months`}</option>)}
              <option value="custom">Custom</option>
            </select>
          </Field>
        </div>
        {every === 'custom' && <Field label="Months between payments (1-24)"><input className="input mono" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} /></Field>}
        <div className="grid grid-2">
          <Field label="Last paid"><input className="input" type="date" value={lastPaid} onChange={(e) => setLastPaid(e.target.value)} /></Field>
          <Field label="Category">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Match text in bank description (optional)"><input className="input" value={matchText} onChange={(e) => setMatchText(e.target.value)} placeholder="state farm" /></Field>
        <Field label="Account note (optional)"><input className="input" value={account} onChange={(e) => setAccount(e.target.value)} /></Field>
        <div className="row-between">
          {!isNew ? <button type="button" className="btn btn-ghost" onClick={() => onDelete(bill)}>Delete</button> : <span />}
          <span className="row" style={{ gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!ok}>Save</button>
          </span>
        </div>
      </form>
    </Modal>
  )
}
