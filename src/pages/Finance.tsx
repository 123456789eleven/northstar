import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef, useEffect, lazy, Suspense } from 'react'
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
type Group = 'overview' | 'markets' | 'cash' | 'wealth' | 'academy'

// Five top-level groups; every old tab id lives under exactly one of them. Deep links (?tab=<old id>) keep working.
const GROUPS: { id: Group; label: string; subs: { id: Tab; label: string }[] }[] = [
  { id: 'overview', label: 'Overview', subs: [{ id: 'overview', label: 'Overview' }] },
  { id: 'markets', label: 'Markets', subs: [{ id: 'markets', label: 'Markets' }] },
  { id: 'cash', label: 'Cash', subs: [{ id: 'transactions', label: 'Transactions' }, { id: 'budgets', label: 'Budgets' }, { id: 'import', label: 'Import' }] },
  { id: 'wealth', label: 'Wealth', subs: [{ id: 'networth', label: 'Net worth' }, { id: 'investments', label: 'Investments' }] },
  { id: 'academy', label: 'Academy', subs: [{ id: 'practice', label: 'Practice' }, { id: 'learn', label: 'Learn' }] },
]
const groupOf = (t: Tab): Group => GROUPS.find((g) => g.subs.some((s) => s.id === t))!.id
const SUB_KEY = 'money.sub'
const readSubs = (): Partial<Record<Group, Tab>> => {
  try { return JSON.parse(localStorage.getItem(SUB_KEY) ?? '{}') } catch { return {} }
}

export default function Finance() {
  // Search deep link: ?tab=transactions&focus=<txId>&month=YYYY-MM (read once here, and again by useFocusTarget for in-page jumps).
  const [params] = useSearchParams()
  const linkMonth = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : null
  const linked = params.get('focus') != null && params.get('tab') === 'transactions'
  const asked = params.get('tab')
  const deepTab: Tab | null = asked === 'markets' || asked === 'practice' || asked === 'learn' || asked === 'investments' || asked === 'networth' || asked === 'budgets' ? asked : null
  const [tab, setTabRaw] = useState<Tab>(linked ? 'transactions' : deepTab ?? 'overview')
  const lastSub = useRef<Partial<Record<Group, Tab>>>(readSubs())
  const setTab = (t: Tab) => {
    setTabRaw(t)
    lastSub.current = { ...lastSub.current, [groupOf(t)]: t }
    try { localStorage.setItem(SUB_KEY, JSON.stringify(lastSub.current)) } catch { /* ignore */ }
  }
  const group = groupOf(tab)
  const openGroup = (g: Group) => {
    const def = GROUPS.find((x) => x.id === g)!
    const back = lastSub.current[g]
    setTab(def.subs.find((x) => x.id === back)?.id ?? def.subs[0].id)
  }
  const subs = GROUPS.find((g) => g.id === group)!.subs
  useEffect(() => { /* deep-linked tab is remembered for its group too */ lastSub.current = { ...lastSub.current, [group]: tab } }, [group, tab])
  const [month, setMonth] = useState(linkMonth ?? monthKey())
  const [category, setCategory] = useState('')
  const [jumped, setJumped] = useState(linkMonth != null)
  const latest = useLiveQuery(() => db.transactions.orderBy('date').last(), [])
  const uncategorized = useLiveQuery(() => db.transactions.where('category').equals(UNCATEGORIZED).count(), []) ?? 0

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
      <div className={`fin-groups${subs.length > 1 ? ' has-subs' : ''}`}>
        <Tabs
          value={group}
          onChange={openGroup}
          options={GROUPS.map((g) => ({ value: g.id, label: g.id === 'cash' && uncategorized > 0 ? `Cash · ${uncategorized}` : g.label }))}
        />
      </div>
      {subs.length > 1 && (
        <div className="fin-subwrap">
          <div className="fin-subs" role="group" aria-label={`${GROUPS.find((g) => g.id === group)!.label} sections`}>
            {subs.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={tab === s.id} className={`fin-sub${tab === s.id ? ' active' : ''}`} onClick={() => setTab(s.id)}>
                {s.id === 'transactions' && uncategorized > 0 ? `Transactions · ${uncategorized}` : s.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
