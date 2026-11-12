// The month in numbers (Lobby > More): cash flow against last month at the same point, and the short recap.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { today } from '../../lib/dates'
import { CashFlowCard, RecapCard } from '../finance/OverviewCards'
import { monthRange, shiftMonth, summarize, useMonthTx } from '../finance/model'

export function MonthNumbers({ month }: { month: string }) {
  const txs = useMonthTx(month)
  const prevMonth = shiftMonth(month, -1)
  const [a, b] = monthRange(prevMonth)
  const prevAll = useLiveQuery(() => db.transactions.where('date').between(a, b, true, true).toArray(), [a, b])
  if (!txs || !prevAll) return null
  const t = today()
  const cut = month === t.slice(0, 7) ? Number(t.slice(8, 10)) : 31
  const prevTx = prevAll.filter((x) => Number(x.date.slice(8, 10)) <= cut)
  const s = summarize(txs)
  const prev = prevTx.length ? summarize(prevTx) : null
  return (
    <div className="stack">
      <CashFlowCard month={month} s={s} prev={prev} />
      <RecapCard month={month} txs={txs} s={s} prev={prev} />
    </div>
  )
}
