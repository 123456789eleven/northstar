// Terminal-style watchlist: dense, tabular figures, sticky header, arrow-key navigation, add by symbol search.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { finnhub, MarketError, normalizeSymbol, type SearchHit } from './finnhub'
import { Change, RangeBar, Skeleton, Tick } from './parts'
import { addSymbol } from './actions'
import { saveOrder, type MarketsData, type WatchRow } from './useMarketsData'
import { alertState, COMMON_SYMBOLS, fmtPrice, MAX_WATCHLIST, moveSymbol, sortRows, type SortKey } from './view'

function AddSymbol({ d }: { d: MarketsData }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const count = d.watchlist.length
  const hasKey = d.key.hasKey

  useEffect(() => {
    if (!hasKey || q.trim().length < 2) { setHits([]); return }
    let stopped = false
    const t = setTimeout(async () => {
      try {
        const r = await finnhub.search(q)
        if (!stopped) setHits(r.filter((h) => normalizeSymbol(h.symbol) && !h.symbol.includes('.')).slice(0, 6))
      } catch (e) {
        if (!stopped) { setHits([]); if (e instanceof MarketError && e.code !== 'Unavailable') setMsg(e.message) }
      }
    }, 350)
    return () => { stopped = true; clearTimeout(t) }
  }, [q, hasKey])

  async function add(sym: string) {
    setBusy(true)
    const err = await addSymbol(sym, count)
    setBusy(false)
    setMsg(err)
    if (!err) { setQ(''); setHits([]) }
  }

  return (
    <div className="mkt-add">
      <form className="row" onSubmit={(e) => { e.preventDefault(); void add(q) }}>
        <input
          className="input" value={q} onChange={(e) => { setQ(e.target.value); setMsg(null) }} placeholder={hasKey ? 'Add by symbol or company name' : 'Add by symbol, such as VTI'}
          aria-label="Add a symbol" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40}
        />
        <button className="btn btn-primary" disabled={busy || !normalizeSymbol(q)}>Add</button>
        <span className="muted mkt-count">{count} of {MAX_WATCHLIST}</span>
      </form>
      {msg && <p className="field-error" role="alert">{msg}</p>}
      {hits.length > 0 && (
        <ul className="mkt-hits" aria-label="Search matches">
          {hits.map((h) => (
            <li key={h.symbol}>
              <button className="mkt-hit" onClick={() => void add(h.symbol)}>
                <b>{h.symbol}</b> <span className="muted">{h.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const HEADS: { key: SortKey; label: string; cls?: string }[] = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'price', label: 'Price', cls: 'r' },
  { key: 'changePct', label: 'Day', cls: 'r' },
  { key: 'order', label: 'Day range', cls: 'hide-sm' },
  { key: 'week52', label: '52-week', cls: 'hide-sm' },
]

export default function Watchlist({ d, selected, onSelect }: { d: MarketsData; selected: string | null; onSelect: (s: string | null) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'order', dir: 'asc' })
  const [focusSym, setFocusSym] = useState<string | null>(null)
  const body = useRef<HTMLTableSectionElement>(null)
  const rows = sortRows(d.rows, sort.key, sort.dir)
  const loadingPrices = d.key.hasKey && d.quotesLoading && !d.hasLive

  function head(k: SortKey) {
    if (k === 'order') return
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'symbol' ? 'asc' : 'desc' }))
  }

  function onKey(e: KeyboardEvent<HTMLTableRowElement>, r: WatchRow, i: number) {
    const go = (j: number) => { const el = body.current?.children[Math.max(0, Math.min(rows.length - 1, j))] as HTMLElement | undefined; el?.focus() }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (e.altKey && sort.key === 'order') void shift(r, 1); else go(i + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (e.altKey && sort.key === 'order') void shift(r, -1); else go(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); go(0) }
    else if (e.key === 'End') { e.preventDefault(); go(rows.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r.symbol) }
    else if (e.key === 'Escape') onSelect(null)
  }
  async function shift(r: WatchRow, delta: -1 | 1) {
    const order = rows.map((x) => x.symbol)
    await saveOrder(moveSymbol(order, r.symbol, delta))
    requestAnimationFrame(() => (body.current?.querySelector(`[data-sym="${r.symbol}"]`) as HTMLElement | null)?.focus())
  }

  const triggered = d.rows.filter((r) => alertState(r.price, r.item.alertAbove, r.item.alertBelow)).length

  if (d.loading) return <Skeleton />
  return (
    <section className="mkt-watch" aria-label="Watchlist">
      <AddSymbol d={d} />
      {triggered > 0 && <p className="mkt-alertline" role="status">{triggered} {triggered === 1 ? 'alert level' : 'alert levels'} crossed. Marked in the list.</p>}
      {d.rows.length === 0 ? (
        <div className="mkt-empty">
          <p><b>Nothing on the watchlist yet.</b> Type a symbol above to follow it.</p>
          <div className="row mkt-common">
            <span className="muted">Common symbols</span>
            {COMMON_SYMBOLS.map((s) => <button key={s} className="btn btn-sm" onClick={() => void addSymbol(s, 0)}>Add {s}</button>)}
          </div>
        </div>
      ) : (
        <div className="mkt-scroll">
          <table className="mkt-table" aria-label="Watchlist prices">
            <thead>
              <tr>
                {HEADS.map((h) => (
                  <th key={h.label} className={h.cls} aria-sort={sort.key === h.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {h.key === 'order' ? h.label : <button className="mkt-th" onClick={() => head(h.key)}>{h.label}{sort.key === h.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</button>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={body}>
              {rows.map((r, i) => {
                const al = alertState(r.price, r.item.alertAbove, r.item.alertBelow)
                const tab = focusSym ? focusSym === r.symbol : i === 0
                return (
                  <tr
                    key={r.symbol} data-sym={r.symbol} tabIndex={tab ? 0 : -1} aria-selected={selected === r.symbol} className={selected === r.symbol ? 'is-selected' : ''}
                    onClick={() => onSelect(r.symbol)} onFocus={() => setFocusSym(r.symbol)} onKeyDown={(e) => onKey(e, r, i)}
                  >
                    <td className="mkt-sym">
                      <b>{r.symbol}</b>
                      {al && <span className="mkt-flag" title={al === 'above' ? `At or above ${r.item.alertAbove}` : `At or below ${r.item.alertBelow}`}>{al === 'above' ? 'Above level' : 'Below level'}</span>}
                      <span className="mkt-name">{r.name ?? ' '}</span>
                    </td>
                    <td className="r mkt-num">{loadingPrices && r.price === undefined ? <span className="mkt-skel mkt-skel-cell" /> : <Tick value={r.price}>{fmtPrice(r.price)}</Tick>}{r.stored && <span className="mkt-tag">saved</span>}</td>
                    <td className="r mkt-num"><Change pct={r.changePct} /></td>
                    <td className="hide-sm"><RangeBar value={r.price} low={r.low} high={r.high} label="Day range" /></td>
                    <td className="hide-sm"><RangeBar value={r.price} low={r.week52Low} high={r.week52High} label="52-week position" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {d.rows.length > 12 && d.key.hasKey && <p className="muted mkt-fine">Finnhub's free plan allows 60 calls a minute, so a long list refreshes more slowly than 15 s.</p>}
      <p className="muted mkt-fine">Arrow keys move between rows, Enter opens details{sort.key === 'order' ? ', Alt with an arrow reorders' : ''}.</p>
    </section>
  )
}
