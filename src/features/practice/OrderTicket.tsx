// Paper order ticket. Simulated only: nothing here is sent to a broker, and nothing recommends a trade.
import { useEffect, useState } from 'react'
import { Card, Field } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { today, money } from '../../lib/dates'
import { finnhub, normalizeSymbol, type SearchHit } from '../markets/finnhub'
import { useFinnhubKey, useQuote } from '../markets/hooks'
import { addPaperTrade } from '../markets/paper'
import { logTradeEvent, removeTrade } from './usePaper'

export const MANUAL_TAG = 'Manual price'

function useDebounced<T>(v: T, ms = 450): T {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

export default function OrderTicket({ cash, onPlaced }: { cash: number; onPlaced: (id: number) => void }) {
  const toast = useToast()
  const { hasKey } = useFinnhubKey()
  const [symbol, setSymbol] = useState('')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState('')
  const [priceText, setPriceText] = useState('')
  const [manual, setManual] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])

  const sym = normalizeSymbol(symbol)
  const lookup = useDebounced(hasKey && sym ? sym : '')
  const { quote, loading: quoteLoading, error: quoteError } = useQuote(lookup)
  const quoteOk = !!lookup && lookup === sym && !!quote && !manual
  const price = quoteOk ? quote!.price : Number(priceText)
  const typed = useDebounced(symbol.trim())

  useEffect(() => {
    if (!hasKey || typed.length < 2) return
    let live = true
    finnhub.search(typed).then((h) => live && setHits(h.slice(0, 8))).catch(() => live && setHits([]))
    return () => { live = false }
  }, [typed, hasKey])

  const q = Number(qty)
  const est = Number.isFinite(q) && q > 0 && Number.isFinite(price) && price > 0 ? q * price : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!sym) return setError('Enter a ticker symbol, such as VTI.')
    if (!Number.isFinite(q) || q <= 0) return setError('Quantity must be more than zero.')
    if (!Number.isFinite(price) || price <= 0) return setError(hasKey && !manual ? 'Waiting for a price. Enter one manually if this symbol has no quote.' : 'Enter the price you want to practice at.')
    setBusy(true)
    try {
      const usedManual = !quoteOk
      const r = await addPaperTrade({ symbol: sym, side, qty: q, price, date: today(), note: [usedManual ? MANUAL_TAG : '', note.trim()].filter(Boolean).join(': ') || undefined })
      if (!r.ok) return setError(r.reason)
      await logTradeEvent({ side, symbol: sym }, r.id)
      onPlaced(r.id)
      toast({ message: `Paper ${side === 'buy' ? 'bought' : 'sold'} ${q} ${sym} at ${money(price)}`, undo: () => removeTrade(r.id) })
      setQty('')
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Order ticket" sub="Paper order. Simulated money, no broker.">
      <form className="pr-form" onSubmit={submit} noValidate>
        <div className="pr-seg" role="group" aria-label="Side">
          {(['buy', 'sell'] as const).map((s) => (
            <button key={s} type="button" className={`pr-seg-btn ${side === s ? 'on' : ''}`} aria-pressed={side === s} onClick={() => setSide(s)}>{s === 'buy' ? 'Buy' : 'Sell'}</button>
          ))}
        </div>
        <Field label="Symbol" hint={hasKey ? undefined : 'No price key set, so you enter prices by hand.'}>
          <input className="input" list="pr-hits" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="VTI" />
        </Field>
        <datalist id="pr-hits">{(hasKey && typed.length >= 2 ? hits : []).map((h) => <option key={h.symbol} value={h.symbol}>{h.description}</option>)}</datalist>
        <div className="pr-two">
          <Field label="Quantity" hint="Fractions are fine.">
            <input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="10" />
          </Field>
          <Field label={quoteOk ? 'Price (latest quote)' : 'Price'}>
            <input
              className="input" inputMode="decimal" aria-label="Price"
              value={quoteOk ? String(quote!.price) : priceText}
              readOnly={quoteOk}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder={quoteLoading ? 'Fetching' : '0.00'}
            />
          </Field>
        </div>
        <div className="pr-tags">
          {quoteOk && <span className="pr-tag">Live quote</span>}
          {!quoteOk && <span className="pr-tag pr-tag-manual">{MANUAL_TAG}</span>}
          {hasKey && lookup && quoteError && !manual && <span className="pr-help">No quote found: {quoteError.message}</span>}
          {hasKey && sym && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setManual(!manual); if (!manual && quote) setPriceText(String(quote.price)) }}>
              {manual ? 'Use latest quote' : 'Enter price by hand'}
            </button>
          )}
        </div>
        <Field label="Note (optional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Why, in a few words" />
        </Field>
        <p className="pr-help" aria-live="polite">
          {est !== null ? `${side === 'buy' ? 'Cost' : 'Proceeds'} ${money(est)}. ` : ''}Paper cash {money(cash)}.
        </p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{side === 'buy' ? 'Place paper buy' : 'Place paper sell'}</button>
      </form>
    </Card>
  )
}
