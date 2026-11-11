import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Tabs } from '../components/ui'
import { db } from '../db'
import { monthKey } from '../lib/dates'
import { useFocusParam, useFocusTarget } from '../lib/useFocusParam'
import Budgets from '../features/finance/Budgets'
import Import from '../features/finance/Import'
import NetWorth from '../features/finance/NetWorth'
import Investments from '../features/investments/Investments'
const MarketsTab = lazy(() => import('../features/markets/MarketsTab'))
const PracticeTab = lazy(() => import('../features/practice/PracticeTab'))
const LearnTab = lazy(() => import('../features/learn/LearnTab'))
import Overview from '../features/finance/Overview'
import Transactions from '../features/finance/Transactions'
import { UNCATEGORIZED } from '../features/finance/categories'
import { monthLabel, shiftMonth } from '../features/finance/model'
import '../features/finance/finance.css'
import '../features/finance/money.css'

type Tab = 'overview' | 'markets' | 'practice' | 'learn' | 'transactions' | 'budgets' | 'networth' | 'investments' | 'import'

export default function Finance() {
  // Search deep link: ?tab=transactions&focus=<txId>&month=YYYY-MM (read once here, and again by useFocusTarget for in-page jumps).
  const [params, setParams] = useSearchParams()
  const linkMonth = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : null
  const linked = params.get('focus') != null && params.get('tab') === 'transactions'
  const asked = params.get('tab')
  const deepTab: Tab | null = asked === 'markets' || asked === 'practice' || asked === 'learn' || asked === 'investments' || asked === 'networth' || asked === 'budgets' || asked === 'transactions' || asked === 'import' ? asked : null
  const [tab, setTab] = useState<Tab>(linked ? 'transactions' : deepTab ?? 'overview')
  const [month, setMonth] = useState(linkMonth ?? monthKey())
  const [category, setCategory] = useState('')
  const [jumped, setJumped] = useState(linkMonth != null)
  const latest = useLiveQuery(() => db.transactions.orderBy('date').last(), [])
  const uncategorized = useLiveQuery(() => db.transactions.where('category').equals(UNCATEGORIZED).count(), []) ?? 0

  // The open tab lives in the URL (?tab=), so the district head reads "Money / Markets" and the strip returns here.
  // Left alone while a ?focus= deep link is being resolved (useFocusTarget clears it).
  useEffect(() => {
    if (params.get('focus') != null || (params.get('tab') ?? 'overview') === tab) return
    setParams((p) => { const n = new URLSearchParams(p); if (tab === 'overview') n.delete('tab'); else n.set('tab', tab); return n }, { replace: true })
  }, [tab, params, setParams])

  const focusId = useFocusParam().focus
  const focusTx = useLiveQuery(async () => (focusId ? ((await db.transactions.get(Number(focusId))) ?? null) : undefined), [focusId])
  useFocusTarget({
    ready: !focusId || focusTx !== undefined,
    exists: () => !!focusTx,
    reveal: () => { setJumped(true); setTab('transactions'); setCategory(''); setMonth(linkMonth ?? focusTx!.date.slice(0, 7)) },
    alsoClear: ['tab', 'month'],
  })

  // If this month is empty but older data exists (e.g. just imported last month's CSV), open on the latest month with data.
  if (!jumped && latest !== undefined) {
    setJumped(true)
    if (latest && latest.date.slice(0, 7) < monthKey()) setMonth(latest.date.slice(0, 7))
  }

  const go = (t: 'transactions' | 'import' | 'budgets' | 'networth' | 'investments', c?: string) => {
    if (t === 'transactions') setCategory(c ?? '')
    setTab(t)
  }

  const showMonth = tab === 'overview' || tab === 'transactions' || tab === 'budgets'

  return (
    <div className="mn-scope">
      <PageHeader
        title="Money"
        sub="What is safe to spend, what is coming, and whether net worth is growing. Data stays on this device."
        actions={
          showMonth && (
            <div className="row fin-month" role="group" aria-label="Month">
              <button className="btn btn-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
                ‹
              </button>
              <span className="fin-month-label">{monthLabel(month)}</span>
              <button className="btn btn-sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
                ›
              </button>
              {month !== monthKey() && (
                <button className="btn btn-sm btn-ghost" onClick={() => setMonth(monthKey())}>
                  This month
                </button>
              )}
              {tab === 'overview' && <button className="btn btn-sm btn-ghost no-print" onClick={() => window.print()}>Print</button>}
            </div>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'markets', label: 'Markets' },
          { value: 'practice', label: 'Practice' },
          { value: 'learn', label: 'Learn' },
          { value: 'transactions', label: uncategorized > 0 ? `Transactions · ${uncategorized}` : 'Transactions' },
          { value: 'budgets', label: 'Budgets' },
          { value: 'networth', label: 'Net worth' },
          { value: 'investments', label: 'Investments' },
          { value: 'import', label: 'Import' },
        ]}
      />
      {tab === 'overview' && <Overview month={month} goTo={go} />}
      <Suspense fallback={null}>
        {tab === 'markets' && <MarketsTab />}
        {tab === 'practice' && <PracticeTab />}
        {tab === 'learn' && <LearnTab />}
      </Suspense>
      {tab === 'transactions' && <Transactions month={month} category={category} setCategory={setCategory} onImport={() => setTab('import')} />}
      {tab === 'budgets' && <Budgets month={month} />}
      {tab === 'networth' && <NetWorth />}
      {tab === 'investments' && <Investments />}
      {tab === 'import' && <Import
          onDone={(c, m) => {
            if (m) setMonth(m)
            go('transactions', c)
          }}
        />}
    </div>
  )
}
