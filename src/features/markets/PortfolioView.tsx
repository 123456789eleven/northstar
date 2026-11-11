// Portfolio view: holdings with live value, day and unrealized P/L, weights, allocation bar, drift vs the owner's targets,
// and what was put in versus what it grew. Descriptive only.
import { useState } from 'react'
import { Skeleton } from './parts'
import { normalizeSymbol } from './finnhub'
import { allocation, contributionVsGrowth, weightDrift } from './portfolio'
import { saveTargets, type MarketsData } from './useMarketsData'
import { direction, fmtDrift, fmtMoney, fmtPct, fmtPrice, fmtSignedMoney, fmtWeight, parseTargetPct, targetsTotal } from './view'

function TargetInput({ ticker, value, targets }: { ticker: string; value?: number; targets: Record<string, number> }) {
  const [text, setText] = useState(value === undefined ? '' : String(Math.round(value * 1000) / 10))
  const [err, setErr] = useState(false)
  return (
    <input
      className="input mkt-target" inputMode="decimal" aria-label={`Target weight for ${ticker}, percent`} placeholder="0" value={text} aria-invalid={err || undefined}
      onChange={(e) => { setText(e.target.value); setErr(false) }}
      onBlur={() => {
        const p = parseTargetPct(text)
        if (p === 'invalid') { setErr(true); return }
        const next = { ...targets }
        if (p === undefined) delete next[ticker]
        else next[ticker] = p
        void saveTargets(next)
      }}
    />
  )
}

export default function PortfolioView({ d, onSelect }: { d: MarketsData; onSelect: (s: string) => void }) {
  const p = d.portfolio
  const [newT, setNewT] = useState('')
  if (d.loading) return <Skeleton />
  if (!p.positions.length) {
    return <div className="mkt-empty"><p><b>No holdings yet.</b> Add shares under Investments and your value, day gain or loss and weights show up here, with live prices once a key is saved.</p></div>
  }
  const alloc = allocation(p.positions)
  const drift = weightDrift(p.positions, d.targets)
  const total = targetsTotal(d.targets)
  const cvg = d.contributions.length ? contributionVsGrowth(d.contributions, p.totalValue) : null
  const top = alloc.slice(0, 6)
  const rest = alloc.slice(6).reduce((s, a) => s + a.weight, 0)

  return (
    <section className="mkt-portfolio stack" aria-label="Portfolio">
      <div>
        <div className="mkt-bar" role="img" aria-label={`Allocation: ${top.map((a) => `${a.ticker} ${fmtWeight(a.weight)}`).join(', ')}`}>
          {top.map((a, i) => <span key={a.ticker} style={{ width: `${a.weight * 100}%`, opacity: 1 - i * 0.14 }} />)}
          {rest > 0 && <span style={{ width: `${rest * 100}%`, opacity: 0.2 }} />}
        </div>
        <ul className="mkt-legend">
          {top.map((a, i) => <li key={a.ticker}><i style={{ opacity: 1 - i * 0.14 }} />{a.ticker} {fmtWeight(a.weight)}</li>)}
          {rest > 0 && <li><i style={{ opacity: 0.2 }} />Other {fmtWeight(rest)}</li>}
        </ul>
      </div>

      <div className="mkt-scroll">
        <table className="mkt-table" aria-label="Holdings">
          <thead>
            <tr><th>Holding</th><th className="r hide-sm">Price</th><th className="r">Value</th><th className="r">Day</th><th className="r hide-sm">Unrealized</th><th className="r">Weight</th></tr>
          </thead>
          <tbody>
            {p.positions.map((x) => (
              <tr key={x.ticker} tabIndex={0} onClick={() => onSelect(x.ticker)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(x.ticker) } }}>
                <td className="mkt-sym"><b>{x.ticker}</b><span className="mkt-name">{x.shares} shares</span></td>
                <td className="r mkt-num hide-sm">{fmtPrice(x.price)}</td>
                <td className="r mkt-num">{fmtMoney(x.value)}</td>
                <td className={`r mkt-num mkt-${direction(x.dayChange)}`}>{fmtSignedMoney(x.dayChange)}</td>
                <td className={`r mkt-num hide-sm mkt-${direction(x.unrealized)}`}>{x.unrealized === undefined ? '—' : `${fmtSignedMoney(x.unrealized)} (${fmtPct((x.unrealizedPct ?? 0) * 100)})`}</td>
                <td className="r mkt-num">{fmtWeight(x.weight)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td><td className="hide-sm" />
              <td className="r mkt-num">{fmtMoney(p.totalValue)}</td>
              <td className={`r mkt-num mkt-${direction(p.dayChange)}`}>{d.hasLive ? fmtSignedMoney(p.dayChange) : '—'}</td>
              <td className={`r mkt-num hide-sm mkt-${direction(p.unrealized)}`}>{p.costBasis > 0 ? `${fmtSignedMoney(p.unrealized)} (${fmtPct(p.unrealizedPct * 100)})` : '—'}</td>
              <td className="r mkt-num">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mkt-two">
        <section aria-label="Weight drift">
          <h3 className="mkt-h">Weight against your targets</h3>
          <p className="muted mkt-fine">Set the weight you want for each holding. The table shows how far today's weight sits from it. Targets are yours; nothing here is a suggestion.</p>
          <table className="mkt-table mkt-table-flat">
            <thead><tr><th>Holding</th><th className="r">Weight</th><th className="r">Target %</th><th className="r">Drift</th></tr></thead>
            <tbody>
              {drift.map((x) => (
                <tr key={x.ticker}>
                  <td><b>{x.ticker}</b></td>
                  <td className="r mkt-num">{fmtWeight(x.weight)}</td>
                  <td className="r"><TargetInput key={`${x.ticker}:${x.target}`} ticker={x.ticker} value={d.targets[x.ticker]} targets={d.targets} /></td>
                  <td className="r mkt-num">{d.targets[x.ticker] === undefined ? '—' : fmtDrift(x.drift)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form className="row mkt-addtarget" onSubmit={(e) => { e.preventDefault(); const t = normalizeSymbol(newT); if (t) { void saveTargets({ ...d.targets, [t]: d.targets[t] ?? 0 }); setNewT('') } }}>
            <input className="input" value={newT} onChange={(e) => setNewT(e.target.value)} placeholder="Target for another symbol" aria-label="Symbol to set a target for" maxLength={20} />
            <button className="btn btn-sm" disabled={!normalizeSymbol(newT)}>Add target</button>
          </form>
          {total > 0 && <p className={`mkt-fine ${Math.abs(total - 1) > 0.001 ? 'warn' : 'muted'}`}>Targets add up to {fmtWeight(total)}.</p>}
        </section>

        <section aria-label="Contributed and growth">
          <h3 className="mkt-h">Put in and grown</h3>
          {cvg ? (
            <dl className="mkt-dl">
              <dt>Contributed</dt><dd>{fmtMoney(cvg.contributed)}</dd>
              <dt>Growth</dt><dd className={`mkt-${direction(cvg.growth)}`}>{fmtSignedMoney(cvg.growth)}</dd>
              <dt>Value</dt><dd>{fmtMoney(cvg.value)}</dd>
              <dt>Growth on contributed</dt><dd>{cvg.contributed > 0 ? fmtPct(cvg.growthPct * 100) : '—'}</dd>
            </dl>
          ) : (
            <p className="muted">Log contributions under Investments to see what you put in versus what it grew.</p>
          )}
          {cvg && cvg.contributed > 0 && (
            <div className="mkt-bar mkt-bar-thin" role="img" aria-label={`Contributed ${fmtMoney(cvg.contributed)}, growth ${fmtSignedMoney(cvg.growth)}`}>
              <span style={{ width: `${Math.min(100, (cvg.contributed / Math.max(cvg.value, cvg.contributed)) * 100)}%`, opacity: 0.5 }} />
              {cvg.growth > 0 && <span style={{ width: `${(cvg.growth / cvg.value) * 100}%` }} />}
            </div>
          )}
          <p className="muted mkt-fine">Compares all logged contributions with the value of the holdings listed here.</p>
        </section>
      </div>
    </section>
  )
}
