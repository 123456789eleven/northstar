import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { PageHeader, Tabs } from '../components/ui'
import { db } from '../db'
import { monthKey } from '../lib/dates'
import Budgets from '../features/finance/Budgets'
import Import from '../features/finance/Import'
import NetWorth from '../features/finance/NetWorth'
import Overview from '../features/finance/Overview'
import Transactions from '../features/finance/Transactions'
import { UNCATEGORIZED } from '../features/finance/categories'
import { monthLabel, shiftMonth } from '../features/finance/model'
import '../features/finance/finance.css'

type Tab = 'overview' | 'transactions' | 'budgets' | 'networth' | 'import'

export default function Finance() {
  const [tab, setTab] = useState<Tab>('overview')
  const [month, setMonth] = useState(monthKey())
  const [category, setCategory] = useState('')
  const [jumped, setJumped] = useState(false)
  const latest = useLiveQuery(() => db.transactions.orderBy('date').last(), [])
  const uncategorized = useLiveQuery(() => db.transactions.where('category').equals(UNCATEGORIZED).count(), []) ?? 0

  // If this month is empty but older data exists (e.g. just imported last month's CSV), open on the latest month with data.
  if (!jumped && latest !== undefined) {
    setJumped(true)
    if (latest && latest.date.slice(0, 7) < monthKey()) setMonth(latest.date.slice(0, 7))
  }

  const go = (t: 'transactions' | 'import' | 'budgets', c?: string) => {
    if (t === 'transactions') setCategory(c ?? '')
    setTab(t)
  }

  const showMonth = tab === 'overview' || tab === 'transactions' || tab === 'budgets'

  return (
    <>
      <PageHeader
        title="Finance"
        sub="Stays on this device. Import OFX or CSV files from your bank. No logins, no syncing."
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
            </div>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'transactions', label: uncategorized > 0 ? `Transactions · ${uncategorized}` : 'Transactions' },
          { value: 'budgets', label: 'Budgets' },
          { value: 'networth', label: 'Net worth' },
          { value: 'import', label: 'Import' },
        ]}
      />
      {tab === 'overview' && <Overview month={month} goTo={go} />}
      {tab === 'transactions' && <Transactions month={month} category={category} setCategory={setCategory} onImport={() => setTab('import')} />}
      {tab === 'budgets' && <Budgets month={month} />}
      {tab === 'networth' && <NetWorth />}
      {tab === 'import' && <Import
          onDone={(c, m) => {
            if (m) setMonth(m)
            go('transactions', c)
          }}
        />}
    </>
  )
}
