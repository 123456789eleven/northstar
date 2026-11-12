// Bank, Lobby floor: net worth (counts up, the path flag advances when you update a balance), safe to spend this month,
// the form guide and the highlights reel. Old `/finance?tab=x` links (and search deep links) land on their new floor.
import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, useLocation } from 'react-router-dom'
import { PageSkeleton } from '../components/ui'
import { moneyTabTarget } from '../components/districts'
import { db } from '../db'
import { FloorMore, FloorView } from '../features/buildings/Floor'
import { useBankMonth } from '../features/bank/bankNav'
import { LobbyHero, SafeCard } from '../features/bank/LobbyParts'
import { MonthNumbers } from '../features/bank/MonthNumbers'
import { useBills } from '../features/finance/billsData'
import FormGuide from '../features/finance/FormGuide'
import { useMonthTx } from '../features/finance/model'
import { GoalsCard } from '../features/finance/OverviewCards'
import { WinsFeed } from '../features/finance/WealthPanels'
import '../features/finance/finance.css'
import '../features/finance/money.css'
import '../features/bank/bank.css'

export default function Finance() {
  const { search } = useLocation()
  const legacy = moneyTabTarget(search)
  if (legacy) return <Navigate to={legacy} replace />
  return <Lobby />
}

function Lobby() {
  const [month, setMonth] = useBankMonth()
  const snaps = useLiveQuery(() => db.balances.toArray(), [])
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const allTx = useLiveQuery(() => db.transactions.toArray(), [])
  const txs = useMonthTx(month)
  const bills = useBills()
  if (!snaps || !budgets || !allTx || !txs || !bills) return <PageSkeleton rows={4} />

  return (
    <FloorView
      label="Lobby"
      className="bk bk-lobby"
      hero={<LobbyHero snaps={snaps} />}
      support={[
        <SafeCard key="safe" month={month} setMonth={setMonth} budgets={budgets} txs={txs} bills={bills} vaultHref="/finance/vault" />,
        <FormGuide key="form" txs={allTx} budgets={budgets} bills={bills} budgetsHref="/finance/vault" />,
        <WinsFeed key="wins" />,
      ]}
      more={
        <FloorMore
          floor="Lobby"
          items={[
            { id: 'month', label: 'Month in numbers', panel: <MonthNumbers month={month} /> },
            { id: 'goals', label: 'Money goals', panel: <GoalsCard /> },
            { id: 'accounts', label: 'Accounts', to: '/finance/archive?view=networth' },
            { id: 'print', label: 'Print', onSelect: () => setTimeout(() => window.print(), 50) },
          ]}
        />
      }
    />
  )
}
