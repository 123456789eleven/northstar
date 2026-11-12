// Bank, Archive floor: the ledger. This month's transactions with search and categorize, import with a clear before and
// after, net worth history and your records. Search deep links (`?focus=<id>&month=`) land on the transaction and ring it.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageSkeleton } from '../components/ui'
import { db } from '../db'
import { formatDate, money } from '../lib/dates'
import { useFocusParam, useFocusTarget } from '../lib/useFocusParam'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { BankView, MonthStepper, useBankMonth, useView, useViewHref } from '../features/bank/bankNav'
import { SpendingDetail } from '../features/bank/SpendingDetail'
import { UNCATEGORIZED } from '../features/finance/categories'
import Import from '../features/finance/Import'
import NetWorth from '../features/finance/NetWorth'
import { monthLabel, netWorthSeries, useImports, useMonthTx } from '../features/finance/model'
import Transactions from '../features/finance/Transactions'
import { RecordsStrip, SavingsEngine } from '../features/finance/WealthPanels'
import '../features/finance/finance.css'
import '../features/finance/money.css'
import '../features/bank/bank.css'

function NetWorthMini({ href }: { href: string }) {
  const snaps = useLiveQuery(() => db.balances.toArray(), [])
  if (!snaps) return null
  const series = netWorthSeries(snaps)
  const months = new Set(snaps.map((s) => s.date.slice(0, 7))).size
  const latest = new Map<string, (typeof snaps)[number]>()
  for (const s of [...snaps].sort((a, b) => a.date.localeCompare(b.date))) latest.set(s.name, s)
  const accounts = [...latest.values()].sort((a, b) => b.balance - a.balance).slice(0, 4)
  return (
    <FloorCard title="Net worth history" action={<Link className="btn btn-ghost btn-sm" to={href}>Accounts</Link>}>
      {!series.length ? <p className="bk-empty">No balances yet. Add one in the Lobby.</p> : (
        <>
          <p className="vt-big-line mn-num"><strong>{series.length}</strong> <span className="muted small">updates over {months} {months === 1 ? 'month' : 'months'}</span></p>
          <ul className="bk-list">
            {accounts.map((a) => (
              <li key={a.name} className="bk-li">
                <span className="bk-li-main"><span>{a.name}</span><span className="bk-li-sub">{formatDate(a.date, { month: 'short', day: 'numeric' })}</span></span>
                <span className="bk-li-end mono">{a.kind === 'liability' ? '-' : ''}{money(a.balance)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </FloorCard>
  )
}

export default function Archive() {
  const [params] = useSearchParams()
  const view = useView()
  const href = useViewHref()
  const navigate = useNavigate()
  const [urlMonth, setMonth] = useBankMonth()
  const [focusMonth, setFocusMonth] = useState<string | null>(null)
  const month = focusMonth ?? urlMonth
  const changeMonth = (m: string) => { setFocusMonth(null); setMonth(m) }
  const [category, setCategory] = useState(params.get('category') ?? '')
  const txs = useMonthTx(month)
  const uncategorized = useLiveQuery(() => db.transactions.where('category').equals(UNCATEGORIZED).count(), [])
  const imports = useImports()

  const focusId = useFocusParam().focus
  const focusTx = useLiveQuery(async () => (focusId ? ((await db.transactions.get(Number(focusId))) ?? null) : undefined), [focusId])
  useFocusTarget({
    ready: !focusId || focusTx !== undefined,
    exists: () => !!focusTx,
    reveal: () => { setCategory(''); setFocusMonth(focusTx!.date.slice(0, 7)) },
  })

  if (view === 'import') {
    return (
      <BankView title="Import">
        <Import onDone={(c, m) => navigate(`/finance/archive?${new URLSearchParams({ ...(m ? { month: m } : {}), ...(c ? { category: c } : {}) })}`)} />
      </BankView>
    )
  }
  if (view === 'networth') return <BankView title="Net worth history"><NetWorth /></BankView>
  if (!txs || uncategorized === undefined) return <PageSkeleton rows={4} />

  const last = imports.at(-1)

  const hero = (
    <section className="card floor-hero ar-hero" aria-label="Ledger">
      <div className="ar-head">
        <h2 className="mn-num">{monthLabel(month)}</h2>
        <div className="ar-actions">
          {uncategorized > 0 && (
            <button className="btn" onClick={() => setCategory(category === UNCATEGORIZED ? '' : UNCATEGORIZED)} aria-pressed={category === UNCATEGORIZED}>
              Categorize {uncategorized}
            </button>
          )}
          <Link className="btn btn-primary" to={href('import')}>Import a file</Link>
          <MonthStepper month={month} onChange={changeMonth} />
        </div>
      </div>
      {last && <p className="bk-fine">Last import: {last.file}, +{last.added} on {formatDate(last.at.slice(0, 10), { month: 'short', day: 'numeric' })}</p>}
    </section>
  )

  return (
    <FloorView
      label="Archive"
      className="bk bk-archive"
      hero={hero}
      support={[
        <div key="ledger" className="ar-ledger">
          <Transactions month={month} category={category} setCategory={setCategory} onImport={() => navigate(href('import'))} add={false} />
        </div>,
        <div key="side" className="bk-side">
          <FloorCard title="Records" className="ar-records"><RecordsStrip /></FloorCard>
          <NetWorthMini href={href('networth')} />
        </div>,
      ]}
      more={
        <FloorMore
          floor="Archive"
          items={[
            { id: 'detail', label: 'Spending detail', panel: (close) => <SpendingDetail month={month} onPick={(c) => { setCategory(c); close() }} /> },
            { id: 'engine', label: 'Savings engine', panel: <SavingsEngine /> },
            { id: 'networth', label: 'Net worth history', to: href('networth') },
            { id: 'import', label: 'Import', to: href('import') },
          ]}
        />
      }
    />
  )
}
