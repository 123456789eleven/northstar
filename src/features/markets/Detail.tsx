// Symbol detail: profile, key metrics, news (text only), your position, notes and alert levels, and a chart built from
// our own recorded closes. Side panel on desktop, bottom sheet on phone.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import SidePanel from '../../components/SidePanel'
import { db } from '../../db'
import { CHART, GRID_PROPS, MARGIN, X_AXIS, Y_AXIS } from '../../components/chartTheme'
import { finnhub, type NewsItem } from './finnhub'
import { getCloses } from './history'
import { Change, RangeBar, Tick } from './parts'
import { addSymbol } from './actions'
import { saveOrder, type MarketsData } from './useMarketsData'
import { ageLabel, alertState, fmtMarketCap, fmtMoney, fmtPrice, fmtRatio, fmtSignedMoney, fmtWeight, fmtYield, moveSymbol, newsWindow, parseOptionalPrice } from './view'

function News({ symbol, enabled }: { symbol: string; enabled: boolean }) {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let stopped = false
    const { from, to } = newsWindow(new Date())
    finnhub.getNews(symbol, from, to).then(
      (n) => { if (!stopped) setItems(n.slice(0, 8)) },
      () => { if (!stopped) setFailed(true) },
    )
    return () => { stopped = true }
  }, [symbol, enabled])
  if (!enabled) return <p className="muted">News needs a Finnhub key.</p>
  if (failed) return <p className="muted">News is not available right now.</p>
  if (!items) return <div className="mkt-skel-list" role="status" aria-label="Loading news"><div className="mkt-skel" /><div className="mkt-skel" /></div>
  if (!items.length) return <p className="muted">No headlines in the last 7 days.</p>
  return (
    <ul className="mkt-news">
      {items.map((n) => (
        <li key={n.id}>
          {/* Headline is rendered as plain text; the link is validated https by the client. */}
          <a href={n.url} target="_blank" rel="noopener noreferrer">{n.headline}</a>
          <span className="muted"> {n.source}, {ageLabel(Date.now() - n.time)}</span>
        </li>
      ))}
    </ul>
  )
}

function Edit({ id, label, field, value }: { id: number; label: string; field: 'alertAbove' | 'alertBelow'; value?: number }) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const [err, setErr] = useState(false)
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input" inputMode="decimal" value={text} aria-invalid={err || undefined} placeholder="None"
        onChange={(e) => { setText(e.target.value); setErr(false) }}
        onBlur={async () => {
          const p = parseOptionalPrice(text)
          if (p === 'invalid') { setErr(true); return }
          await db.watchlist.update(id, { [field]: p })
        }}
      />
      {err && <span className="field-error" role="alert">Enter a price above 0, or leave blank.</span>}
    </label>
  )
}

export default function Detail({ d, symbol, onClose, inline = true }: { d: MarketsData; symbol: string; onClose: () => void; inline?: boolean }) {
  const row = d.rows.find((r) => r.symbol === symbol)
  const item = d.watchlist.find((w) => w.symbol === symbol)
  const q = d.quotes[symbol]
  const pos = d.portfolio.positions.find((p) => p.ticker === symbol)
  const price = row?.price ?? q?.price ?? pos?.price
  const closes = useLiveQuery(() => getCloses(symbol), [symbol, q?.price]) ?? []
  const m = row?.info?.metrics
  const p = row?.info?.profile
  const al = item ? alertState(price, item.alertAbove, item.alertBelow) : null
  const order = d.rows.map((r) => r.symbol)
  const [note, setNote] = useState(item?.note ?? '')

  return (
    <SidePanel title={symbol} onClose={onClose} inline={inline}>
      <div className="mkt-detail stack">
        <div>
          <div className="mkt-detail-price"><Tick value={price}>{price === undefined ? '—' : `$${fmtPrice(price)}`}</Tick> <Change pct={q?.changePct} /></div>
          <div className="muted">{p?.name ?? row?.name ?? 'Name appears once Finnhub answers.'}</div>
          {al && <div className="mkt-flag mkt-flag-inline">{al === 'above' ? `At or above ${item?.alertAbove}` : `At or below ${item?.alertBelow}`}</div>}
        </div>

        <section aria-label="Chart">
          <h3 className="mkt-h">Chart</h3>
          {closes.length >= 2 ? (
            <div className="mkt-chart">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={closes} margin={MARGIN}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis {...X_AXIS} dataKey="date" tickFormatter={(v: string) => v.slice(5)} minTickGap={32} />
                  <YAxis {...Y_AXIS} domain={['auto', 'auto']} width={44} />
                  <Tooltip formatter={(v) => fmtPrice(Number(v))} contentStyle={{ background: CHART.surface, border: `1px solid ${CHART.grid}`, color: '#edf0f5', fontSize: 12 }} />
                  <Line type="monotone" dataKey="close" stroke={CHART.accent} strokeWidth={1.75} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          <p className="muted mkt-fine">Chart builds as you open the app. {closes.length} {closes.length === 1 ? 'day' : 'days'} recorded.</p>
        </section>

        {pos && (
          <section aria-label="Your position">
            <h3 className="mkt-h">Your position</h3>
            <dl className="mkt-dl">
              <dt>Shares</dt><dd>{pos.shares}</dd>
              <dt>Value</dt><dd>{fmtMoney(pos.value)}</dd>
              <dt>Weight</dt><dd>{fmtWeight(pos.weight)}</dd>
              {pos.dayChange !== undefined && (<><dt>Day</dt><dd>{fmtSignedMoney(pos.dayChange)}</dd></>)}
              {pos.unrealized !== undefined && (<><dt>Unrealized</dt><dd>{fmtSignedMoney(pos.unrealized)}</dd></>)}
            </dl>
          </section>
        )}

        <section aria-label="Profile and key figures">
          <h3 className="mkt-h">Profile</h3>
          <dl className="mkt-dl">
            <dt>Exchange</dt><dd>{p?.exchange ?? '—'}</dd>
            <dt>Industry</dt><dd>{p?.industry ?? '—'}</dd>
            <dt>Market cap</dt><dd>{fmtMarketCap(m?.marketCap ?? p?.marketCap)}</dd>
            <dt>52-week high</dt><dd>{fmtPrice(m?.week52High)}</dd>
            <dt>52-week low</dt><dd>{fmtPrice(m?.week52Low)}</dd>
            <dt>P/E</dt><dd>{fmtRatio(m?.peTTM)}</dd>
            <dt>EPS</dt><dd>{fmtRatio(m?.epsTTM)}</dd>
            <dt>Beta</dt><dd>{fmtRatio(m?.beta)}</dd>
            <dt>Dividend yield</dt><dd>{fmtYield(m?.dividendYield)}</dd>
          </dl>
          <RangeBar value={price} low={m?.week52Low} high={m?.week52High} label="52-week position" />
        </section>

        <section aria-label="News">
          <h3 className="mkt-h">News, last 7 days</h3>
          <News symbol={symbol} enabled={d.key.hasKey} />
        </section>

        {item ? (
          <section aria-label="Notes and levels">
            <h3 className="mkt-h">Notes and levels</h3>
            <label className="field">
              <span>Note</span>
              <textarea className="textarea" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => void db.watchlist.update(item.id!, { note: note.trim() || undefined })} />
            </label>
            <div className="grid-2">
              <Edit id={item.id!} label="Alert at or above" field="alertAbove" value={item.alertAbove} />
              <Edit id={item.id!} label="Alert at or below" field="alertBelow" value={item.alertBelow} />
            </div>
            <p className="muted mkt-fine">Alerts mark the row in this app only. No notifications are sent.</p>
            <div className="row mkt-actions">
              <button className="btn btn-sm" disabled={order.indexOf(symbol) <= 0} onClick={() => void saveOrder(moveSymbol(order, symbol, -1))}>Move up</button>
              <button className="btn btn-sm" disabled={order.indexOf(symbol) >= order.length - 1} onClick={() => void saveOrder(moveSymbol(order, symbol, 1))}>Move down</button>
              <button className="btn btn-sm btn-danger" onClick={async () => { await db.watchlist.delete(item.id!); onClose() }}>Remove from watchlist</button>
            </div>
          </section>
        ) : (
          <button className="btn" onClick={() => void addSymbol(symbol, d.watchlist.length)}>Add {symbol} to watchlist</button>
        )}
      </div>
    </SidePanel>
  )
}
