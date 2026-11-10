// Screener: criteria the owner sets, run over the watchlist. Results are matches, never suggestions.
import { useMemo, useState } from 'react'
import { Change, Skeleton } from './parts'
import { saveScreens, type MarketsData } from './useMarketsData'
import { CAP_LABEL, criteriaCount, fmtMarketCap, fmtPrice, fmtRatio, fmtYield, numField, rangePosition, runScreen, type CapBucket, type Criteria } from './view'

type Form = { priceMin: string; priceMax: string; changeMin: string; changeMax: string; posMin: string; posMax: string; peMin: string; peMax: string; yieldMin: string; caps: CapBucket[] }
const EMPTY: Form = { priceMin: '', priceMax: '', changeMin: '', changeMax: '', posMin: '', posMax: '', peMin: '', peMax: '', yieldMin: '', caps: [] }
const toCriteria = (f: Form): Criteria => ({
  priceMin: numField(f.priceMin), priceMax: numField(f.priceMax), changeMin: numField(f.changeMin), changeMax: numField(f.changeMax),
  posMin: numField(f.posMin), posMax: numField(f.posMax), peMin: numField(f.peMin), peMax: numField(f.peMax), yieldMin: numField(f.yieldMin), caps: f.caps,
})
const toForm = (c: Criteria): Form => {
  const s = (n?: number) => (n === undefined ? '' : String(n))
  return { priceMin: s(c.priceMin), priceMax: s(c.priceMax), changeMin: s(c.changeMin), changeMax: s(c.changeMax), posMin: s(c.posMin), posMax: s(c.posMax), peMin: s(c.peMin), peMax: s(c.peMax), yieldMin: s(c.yieldMin), caps: c.caps ?? [] }
}

function Pair({ label, a, b, f, set, hint }: { label: string; a: keyof Form; b?: keyof Form; f: Form; set: (k: keyof Form, v: string) => void; hint?: string }) {
  return (
    <div className="mkt-crit">
      <span className="mkt-crit-label">{label}{hint && <span className="muted"> {hint}</span>}</span>
      <div className="row">
        <input className="input" inputMode="decimal" aria-label={`${label} minimum`} placeholder="Min" value={f[a] as string} onChange={(e) => set(a, e.target.value)} />
        {b && <input className="input" inputMode="decimal" aria-label={`${label} maximum`} placeholder="Max" value={f[b] as string} onChange={(e) => set(b, e.target.value)} />}
      </div>
    </div>
  )
}

export default function Screener({ d, onSelect }: { d: MarketsData; onSelect: (s: string) => void }) {
  const [f, setF] = useState<Form>(EMPTY)
  const [name, setName] = useState('')
  const set = (k: keyof Form, v: string) => setF((p) => ({ ...p, [k]: v }))
  const c = useMemo(() => toCriteria(f), [f])
  const n = criteriaCount(c)
  const matches = useMemo(() => runScreen(d.rows, c), [d.rows, c])
  const noData = d.rows.filter((r) => r.week52High === undefined && r.pe === undefined && r.marketCap === undefined).length
  if (d.loading) return <Skeleton />

  return (
    <section className="mkt-screener stack" aria-label="Screener">
      <p className="muted">Set the criteria you care about. It runs over the {d.rows.length} {d.rows.length === 1 ? 'symbol' : 'symbols'} on your watchlist and lists the ones that match.</p>
      {d.screens.length > 0 && (
        <div className="row mkt-saved">
          <span className="muted">Saved screens</span>
          {d.screens.map((s) => (
            <span key={s.name} className="mkt-saved-item">
              <button className="btn btn-sm" onClick={() => { setF(toForm(s.criteria)); setName(s.name) }}>{s.name}</button>
              <button className="btn btn-sm btn-ghost" aria-label={`Delete screen ${s.name}`} onClick={() => void saveScreens(d.screens.filter((x) => x.name !== s.name))}>Delete</button>
            </span>
          ))}
        </div>
      )}
      <div className="mkt-crit-grid">
        <Pair label="Price" a="priceMin" b="priceMax" f={f} set={set} hint="$" />
        <Pair label="Day change" a="changeMin" b="changeMax" f={f} set={set} hint="%" />
        <Pair label="52-week position" a="posMin" b="posMax" f={f} set={set} hint="0 = low, 100 = high" />
        <Pair label="P/E" a="peMin" b="peMax" f={f} set={set} />
        <Pair label="Dividend yield" a="yieldMin" f={f} set={set} hint="% or more" />
        <div className="mkt-crit">
          <span className="mkt-crit-label">Market cap</span>
          <div className="row mkt-caps">
            {(Object.keys(CAP_LABEL) as CapBucket[]).map((k) => (
              <button key={k} type="button" className={`chip ${f.caps.includes(k) ? 'chip-accent' : ''}`} aria-pressed={f.caps.includes(k)}
                onClick={() => setF((p) => ({ ...p, caps: p.caps.includes(k) ? p.caps.filter((x) => x !== k) : [...p.caps, k] }))}>{CAP_LABEL[k]}</button>
            ))}
          </div>
        </div>
      </div>
      <form className="row mkt-savebar" onSubmit={(e) => {
        e.preventDefault()
        const nm = name.trim().slice(0, 40)
        if (!nm || !n) return
        void saveScreens([...d.screens.filter((s) => s.name !== nm), { name: nm, criteria: c }])
      }}>
        <input className="input" placeholder="Name this screen" aria-label="Screen name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <button className="btn btn-sm" disabled={!name.trim() || !n}>Save screen</button>
        <button type="button" className="btn btn-sm btn-ghost" disabled={!n} onClick={() => { setF(EMPTY); setName('') }}>Clear</button>
      </form>

      <div aria-live="polite">
        <h3 className="mkt-h">{n === 0 ? 'Set a criterion to see matches' : `${matches.length} of ${d.rows.length} match`}</h3>
        {n > 0 && noData > 0 && <p className="muted mkt-fine">{noData} {noData === 1 ? 'symbol has' : 'symbols have'} no company figures yet and cannot match figure-based criteria.</p>}
        {n > 0 && matches.length > 0 && (
          <div className="mkt-scroll">
            <table className="mkt-table" aria-label="Matches">
              <thead><tr><th>Symbol</th><th className="r">Price</th><th className="r">Day</th><th className="r hide-sm">52-wk pos.</th><th className="r hide-sm">P/E</th><th className="r hide-sm">Yield</th><th className="r hide-sm">Cap</th></tr></thead>
              <tbody>
                {matches.map((r) => {
                  const pos = rangePosition(r.price, r.week52Low, r.week52High)
                  return (
                    <tr key={r.symbol} tabIndex={0} onClick={() => onSelect(r.symbol)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r.symbol) } }}>
                      <td className="mkt-sym"><b>{r.symbol}</b><span className="mkt-name">{r.name ?? ' '}</span></td>
                      <td className="r mkt-num">{fmtPrice(r.price)}</td>
                      <td className="r mkt-num"><Change pct={r.changePct} /></td>
                      <td className="r mkt-num hide-sm">{pos === null ? '—' : `${Math.round(pos * 100)}`}</td>
                      <td className="r mkt-num hide-sm">{fmtRatio(r.pe, 1)}</td>
                      <td className="r mkt-num hide-sm">{fmtYield(r.dividendYield)}</td>
                      <td className="r mkt-num hide-sm">{fmtMarketCap(r.marketCap)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {n > 0 && matches.length === 0 && <p className="muted">Nothing on the watchlist matches these criteria.</p>}
      </div>
    </section>
  )
}
