import { useLiveQuery } from 'dexie-react-hooks'
import { type FormEvent, useMemo, useRef, useState } from 'react'
import { Card, Empty, Modal } from '../../components/ui'
import DataTable from '../../components/DataTable'
import { db, type Transaction } from '../../db'
import { formatDate, today } from '../../lib/dates'
import { addMerchantRule, CATEGORIES, categorize, INCOME, merchantKey, merchantLabel, UNCATEGORIZED } from './categories'
import { monthLabel, monthRange, moneyExact, useRules } from './model'
import { parseQuickAdd } from './quickAdd'

interface Offer {
  merchant: string
  category: string
  matches: number
}

export default function Transactions({ month, category, setCategory, onImport }: { month: string; category: string; setCategory: (c: string) => void; onImport: () => void }) {
  const [q, setQ] = useState('')
  const [allTime, setAllTime] = useState(false)
  const [offer, setOffer] = useState<Offer | null>(null)
  const [flash, setFlash] = useState('')
  const [deleted, setDeleted] = useState<Transaction | null>(null)
  const [triage, setTriage] = useState(false)
  const rules = useRules()

  const [a, b] = monthRange(month)
  const txs = useLiveQuery(
    () => (allTime ? db.transactions.orderBy('date').reverse().toArray() : db.transactions.where('date').between(a, b, true, true).reverse().sortBy('date')),
    [a, b, allTime],
  )
  const uncategorizedAll = useLiveQuery(() => db.transactions.where('category').equals(UNCATEGORIZED).count(), []) ?? 0
  const total = useLiveQuery(() => db.transactions.count(), [])

  const shown = useMemo(() => {
    if (!txs) return []
    const needle = q.trim().toLowerCase()
    return txs.filter((t) => (!category || t.category === category) && (!needle || t.description.toLowerCase().includes(needle) || (t.account ?? '').toLowerCase().includes(needle) || t.amount.toFixed(2).includes(needle)))
  }, [txs, q, category])

  async function recategorize(t: Transaction, next: string) {
    await db.transactions.update(t.id!, { category: next })
    if (next === UNCATEGORIZED) return
    const merchant = merchantKey(t.description)
    const re = new RegExp(merchant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const matches = await db.transactions.filter((x) => x.id !== t.id && re.test(x.description) && x.category !== next).count()
    setOffer({ merchant, category: next, matches })
  }

  async function acceptOffer() {
    if (!offer) return
    const n = await addMerchantRule(offer.merchant, offer.category)
    setOffer(null)
    setFlash(`Rule saved. ${n} other transaction${n === 1 ? '' : 's'} updated.`)
    setTimeout(() => setFlash(''), 4000)
  }

  async function remove(t: Transaction) {
    await db.transactions.delete(t.id!)
    setDeleted(t)
  }

  async function undoDelete() {
    if (!deleted) return
    await db.transactions.add(deleted)
    setDeleted(null)
  }

  if (!txs || total === undefined) return null

  return (
    <div className="stack" style={{ gap: 16 }}>
      <AddRow month={month} rules={rules.all} />

      <div className="row wrap fin-filters">
        <input className="input grow" style={{ minWidth: 160 }} placeholder="Search description, account, amount" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="row small muted" style={{ gap: 6 }}>
          <input type="checkbox" className="check" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} />
          All months
        </label>
        {uncategorizedAll > 0 && (
          <button className="btn btn-sm" onClick={() => setTriage(true)}>
            <span className="chip chip-accent">{uncategorizedAll}</span> Categorize next
          </button>
        )}
      </div>

      {offer && (
        <div className="card fin-offer row-between wrap">
          <span className="small">
            Always categorize <strong>{merchantLabel(offer.merchant)}</strong> as <strong>{offer.category}</strong>?
            {offer.matches > 0 && <span className="muted"> Updates {offer.matches} other transaction{offer.matches === 1 ? '' : 's'}.</span>}
          </span>
          <span className="row">
            <button className="btn btn-sm btn-primary" onClick={acceptOffer}>
              Always
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setOffer(null)}>
              Just this one
            </button>
          </span>
        </div>
      )}
      {flash && <div className="small good">{flash}</div>}
      {deleted && (
        <div className="row small">
          <span className="muted">Deleted “{deleted.description}”.</span>
          <button className="btn btn-sm btn-ghost" onClick={undoDelete}>
            Undo
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setDeleted(null)} aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}

      <Card
        flush={shown.length > 0}
        title={`${shown.length} transaction${shown.length === 1 ? '' : 's'}${allTime ? '' : ` · ${monthLabel(month)}`}`}
        action={
          shown.length > 0 ? (
            <span className="mono small muted fin-sums">
              <span>{moneyExact(-shown.reduce((s, t) => s + Math.min(0, t.amount), 0))} out</span>
              <span className="good">+{moneyExact(shown.reduce((s, t) => s + Math.max(0, t.amount), 0))} in</span>
            </span>
          ) : undefined
        }
      >
        {total === 0 ? (
          <Empty>
            <p style={{ margin: '0 0 12px' }}>Nothing here yet. Add one with the row above, or download an OFX or CSV file from your bank's website and import it.</p>
            <button className="btn btn-primary" onClick={onImport}>
              Import a file
            </button>
          </Empty>
        ) : shown.length === 0 ? (
          <Empty>No transactions match{allTime ? '' : ` in ${monthLabel(month)}`}. Try another month, clear the filters, or tick “All months”.</Empty>
        ) : (
          <DataTable
            label="Transactions"
            rows={shown}
            rowKey={(t) => t.id!}
            columns={[
              { key: 'desc', header: 'Description', primary: true, render: (t) => (
                <span className="fin-desc"><span>{t.description}</span>{t.account && <span className="tiny faint"> · {t.account}</span>}</span>
              ) },
              { key: 'date', header: 'Date', render: (t) => <span className="mono muted nowrap">{formatDate(t.date, allTime ? { month: 'short', day: 'numeric', year: '2-digit' } : undefined)}</span> },
              { key: 'cat', header: 'Category', render: (t) => (
                <select className={`select fin-cat ${t.category === UNCATEGORIZED ? 'fin-cat-un' : ''}`} value={t.category} onChange={(e) => recategorize(t, e.target.value)} onClick={(e) => e.stopPropagation()} aria-label="Category">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  {!CATEGORIES.includes(t.category as (typeof CATEGORIES)[number]) && <option value={t.category}>{t.category}</option>}
                </select>
              ) },
              { key: 'amt', header: 'Amount', align: 'right', value: true, render: (t) => <span className={`mono nowrap ${t.amount > 0 ? 'good' : ''}`}>{t.amount > 0 ? '+' : ''}{moneyExact(t.amount)}</span> },
              { key: 'x', header: '', render: (t) => (
                <button className="btn btn-ghost btn-sm fin-x" onClick={(e) => { e.stopPropagation(); remove(t) }} aria-label={`Delete ${t.description}`} title="Delete">×</button>
              ) },
            ]}
          />
        )}
      </Card>

      {triage && <Triage onClose={() => setTriage(false)} />}
    </div>
  )
}

function AddRow({ month, rules }: { month: string; rules: ReturnType<typeof useRules>['all'] }) {
  const defaultDate = () => (today().startsWith(month) ? today() : `${month}-01`)
  const [date, setDate] = useState(defaultDate)
  const [desc, setDesc] = useState('')
  const [amt, setAmt] = useState('')
  const [dir, setDir] = useState<'out' | 'in'>('out')
  const [cat, setCat] = useState('')
  const [lastMonth, setLastMonth] = useState(month)
  if (lastMonth !== month) {
    setLastMonth(month)
    setDate(defaultDate())
  }

  const descRef = useRef<HTMLInputElement>(null)
  // One-line entry: "Kroger 42.50" or "Paycheck +1200" in the description box while the amount box is empty.
  const quick = !amt.trim() ? parseQuickAdd(desc) : null
  const n = quick ? quick.amount : Number(amt.replace(/[$,\s]/g, ''))
  const direction = quick ? quick.dir : dir
  const text = quick ? quick.description : desc.trim()
  const ok = Boolean(text) && Number.isFinite(n) && n !== 0 && (quick !== null || amt.trim() !== '')
  const signed = direction === 'out' ? -Math.abs(n) : Math.abs(n)
  const suggested = text ? categorize(text, signed, rules) : ''

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!ok) return
    const category = cat || (suggested === UNCATEGORIZED && direction === 'in' ? INCOME : suggested) || UNCATEGORIZED
    await db.transactions.add({ date: date || today(), description: text, amount: Math.round(signed * 100) / 100, category })
    setDesc('')
    setAmt('')
    setCat('')
    descRef.current?.focus()
  }

  return (
    <form className="card fin-add" onSubmit={add}>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
      <input ref={descRef} className="input fin-add-desc" placeholder="Type “Kroger 42.50” or “Paycheck +1200”" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Description" />
      <div className="row fin-add-amt" style={{ gap: 4 }}>
        <select className="select" style={{ width: 'auto' }} value={dir} onChange={(e) => setDir(e.target.value as 'out' | 'in')} aria-label="Direction">
          <option value="out">Spent</option>
          <option value="in">Received</option>
        </select>
        <input className="input" inputMode="decimal" placeholder="0.00" value={amt} onChange={(e) => setAmt(e.target.value)} aria-label="Amount" />
      </div>
      <select className="select fin-add-cat" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
        <option value="">{suggested && suggested !== UNCATEGORIZED ? `Auto: ${suggested}` : 'Category (auto)'}</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button className="btn btn-primary" disabled={!ok}>
        Add
      </button>
    </form>
  )
}

/** One-at-a-time categorization of every Uncategorized transaction: one tap per transaction. */
function Triage({ onClose }: { onClose: () => void }) {
  const [always, setAlways] = useState(true)
  const [skipped, setSkipped] = useState<number[]>([])
  const [done, setDone] = useState(0)
  const queue = useLiveQuery(() => db.transactions.where('category').equals(UNCATEGORIZED).reverse().sortBy('date'), [])
  const current = queue?.find((t) => !skipped.includes(t.id!))
  const remaining = queue ? queue.filter((t) => !skipped.includes(t.id!)).length : 0

  async function pick(c: string) {
    if (!current) return
    await db.transactions.update(current.id!, { category: c })
    if (always) await addMerchantRule(merchantKey(current.description), c)
    setDone((d) => d + 1)
  }

  return (
    <Modal title="Categorize" onClose={onClose}>
      {!queue ? null : !current ? (
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            {done > 0 ? `Done — ${done} categorized.` : 'Nothing left to categorize.'}
            {skipped.length > 0 && ` ${skipped.length} skipped.`}
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row-between small faint">
            <span>{remaining} left</span>
            <span>{formatDate(current.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div>
            <div style={{ fontSize: 17 }}>{current.description}</div>
            <div className={`mono ${current.amount > 0 ? 'good' : ''}`} style={{ fontFamily: 'var(--serif)', fontSize: 26 }}>
              {current.amount > 0 ? '+' : ''}
              {moneyExact(current.amount)}
            </div>
            {current.account && <div className="tiny faint">{current.account}</div>}
          </div>
          <div className="fin-pick">
            {CATEGORIES.filter((c) => c !== UNCATEGORIZED).map((c) => (
              <button key={c} className="btn btn-sm" onClick={() => pick(c)}>
                {c}
              </button>
            ))}
          </div>
          <label className="row small muted" style={{ gap: 8 }}>
            <input type="checkbox" className="check" checked={always} onChange={(e) => setAlways(e.target.checked)} />
            Always use this category for “{merchantLabel(merchantKey(current.description))}”
          </label>
          <div className="row-between">
            <button className="btn btn-ghost btn-sm" onClick={() => setSkipped((s) => [...s, current.id!])}>
              Skip
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Done for now
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
