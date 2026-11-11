// Paper account: hero (equity, P/L, curve, reset), order ticket, positions, trade history.
import { useMemo, useState } from 'react'
import { Card, Empty, Skeleton } from '../../components/ui'
import ChartFrame from '../../components/ChartFrame'
import { useToast } from '../../components/toastContext'
import { formatDate, money } from '../../lib/dates'
import { EquityChart } from './charts'
import { signed, tone } from './fmt'
import { canRemoveTrade } from './ledger'
import OrderTicket, { MANUAL_TAG } from './OrderTicket'
import { removeTrade, resetAccount, usePaper } from './usePaper'

const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`
const PAGE = 40

export default function AccountPanel({ onJournal }: { onJournal: (tradeId: number, symbol: string) => void }) {
  const { model, loading, quotesError, refreshQuotes } = usePaper()
  const toast = useToast()
  const [session, setSession] = useState<number[]>([])
  const [confirm, setConfirm] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [filter, setFilter] = useState('')

  const history = useMemo(() => {
    if (!model) return []
    const rows = [...model.trades].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))
    return filter ? rows.filter((t) => t.symbol.toUpperCase() === filter) : rows
  }, [model, filter])

  if (loading || !model) return <Skeleton lines={5} label="Loading paper account" />
  const { summary, startCash, total, day, curve } = model
  const empty = model.trades.length === 0
  const symbols = [...new Set(model.trades.map((t) => t.symbol.toUpperCase()))].sort()

  async function doReset() {
    const restore = await resetAccount()
    setConfirm(false)
    toast({ message: 'Paper account reset', undo: restore })
  }

  return (
    <div className="pr-stack">
      <Card className="pr-hero">
        <div className="pr-hero-top">
          <div>
            <div className="pr-kicker">Paper account · simulated money</div>
            <div className="pr-equity" aria-label={`Equity ${money(summary.equity)}`}>{money(summary.equity)}</div>
            <div className="pr-pl">
              <span className={tone(day)}>{signed(day)} today</span>
              <span className={tone(total)}>{signed(total)} ({pct((total / startCash) * 100)}) since start</span>
            </div>
          </div>
          <dl className="pr-facts">
            <div><dt>Cash</dt><dd>{money(summary.cash)}</dd></div>
            <div><dt>Start</dt><dd>{money(startCash)}</dd></div>
            <div><dt>Realized</dt><dd className={tone(summary.realized)}>{signed(summary.realized)}</dd></div>
            <div><dt>Unrealized</dt><dd className={tone(summary.unrealized)}>{signed(summary.unrealized)}</dd></div>
          </dl>
        </div>
        {!empty && (
          <ChartFrame
            title="Equity curve"
            sub={`Built from your trades and prices recorded on this device. It fills in over time${model.live ? '' : '; add a price key for daily points'}.`}
            hasData={curve.length > 1}
            empty="One point so far. The curve appears after a second day of activity or recorded prices."
            table={<div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Equity</th></tr></thead><tbody>{curve.slice(-60).map((p) => <tr key={p.date}><td>{formatDate(p.date)}</td><td className="mono">{money(p.equity)}</td></tr>)}</tbody></table></div>}
          >
            <EquityChart data={curve} startCash={startCash} />
          </ChartFrame>
        )}
        <div className="pr-hero-foot">
          {quotesError && quotesError.code !== 'NoKey' && (
            <span className="pr-help">Prices unavailable ({quotesError.message}). Showing last known prices. <button className="btn btn-ghost btn-sm" onClick={refreshQuotes}>Retry</button></span>
          )}
          {!confirm ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)} disabled={empty}>Reset account</button>
          ) : (
            <div className="pr-confirm" role="alertdialog" aria-label="Confirm reset">
              <span>Delete all {model.trades.length} paper trades and start over with {money(startCash)}? Journal entries stay.</span>
              <button className="btn btn-danger btn-sm" onClick={doReset}>Reset</button>
              <button className="btn btn-sm" onClick={() => setConfirm(false)}>Keep it</button>
            </div>
          )}
        </div>
      </Card>

      {empty && (
        <Empty title="Take your first practice trade">
          You start with {money(startCash)} of simulated cash. Pick a symbol on the ticket, buy a small amount and jot down why in the journal. It is all simulated, so nothing touches real money.
        </Empty>
      )}

      <div className="pr-grid">
        <OrderTicket cash={summary.cash} onPlaced={(id) => setSession((s) => [...s, id])} />
        <Card title="Positions" sub={summary.positions.length ? `${summary.positions.length} open` : undefined}>
          {summary.positions.length === 0 ? (
            <p className="muted">No open positions.</p>
          ) : (
            <div className="table-wrap">
              <table className="table pr-table">
                <caption className="sr-only">Open paper positions</caption>
                <thead><tr><th>Symbol</th><th className="num">Qty</th><th className="num hide-sm">Avg cost</th><th className="num">Last</th><th className="num">Unrealized</th><th className="num hide-sm">Realized</th><th className="num hide-sm">Weight</th></tr></thead>
                <tbody>
                  {summary.positions.map((p) => {
                    const u = p.unrealized ?? 0
                    return (
                      <tr key={p.symbol}>
                        <td><b>{p.symbol}</b></td>
                        <td className="num mono">{p.qty}</td>
                        <td className="num mono hide-sm">{money(p.avgCost)}</td>
                        <td className="num mono">{money((p.value ?? 0) / p.qty)}</td>
                        <td className={`num mono ${tone(u)}`}>{signed(u)}</td>
                        <td className={`num mono hide-sm ${tone(model.realizedBySymbol[p.symbol] ?? 0)}`}>{signed(model.realizedBySymbol[p.symbol] ?? 0)}</td>
                        <td className="num mono hide-sm">{summary.equity ? (((p.value ?? 0) / summary.equity) * 100).toFixed(1) : '0.0'}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Trade history" sub={`${model.trades.length} trade${model.trades.length === 1 ? '' : 's'}`} action={symbols.length > 1 ? (
        <select className="select pr-select" aria-label="Filter history by symbol" value={filter} onChange={(e) => { setFilter(e.target.value); setShown(PAGE) }}>
          <option value="">All symbols</option>
          {symbols.map((s) => <option key={s}>{s}</option>)}
        </select>
      ) : undefined}>
        {history.length === 0 ? <p className="muted">No trades yet. Your first one lands here.</p> : (
          <ul className="pr-list">
            {history.slice(0, shown).map((t) => {
              const id = t.id as number
              const mine = session.includes(id) && canRemoveTrade(model.trades, id, startCash)
              const manual = t.note?.startsWith(MANUAL_TAG)
              return (
                <li key={id} className="pr-row">
                  <span className="pr-row-date">{formatDate(t.date)}</span>
                  <span className="pr-row-main"><b className={t.side === 'buy' ? '' : 'pr-sell'}>{t.side === 'buy' ? 'Buy' : 'Sell'}</b> {t.qty} {t.symbol.toUpperCase()} at {money(t.price)}{manual && <span className="pr-tag pr-tag-manual">{MANUAL_TAG}</span>}</span>
                  <span className="pr-row-act">
                    <button className="btn btn-ghost btn-sm" onClick={() => onJournal(id, t.symbol.toUpperCase())}>Journal</button>
                    {mine && <button className="btn btn-ghost btn-sm" onClick={async () => { await removeTrade(id); toast({ message: 'Paper trade undone' }) }}>Undo</button>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {history.length > shown && <button className="btn btn-sm" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, history.length - shown)} more</button>}
      </Card>
    </div>
  )
}
