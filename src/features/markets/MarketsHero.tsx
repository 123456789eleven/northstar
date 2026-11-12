// Trading floor hero (Bank): portfolio value with the day change and a sparkline, plus the one status banner. Live prices are
// opt-in (own Finnhub key); without one it shows saved prices. Information only: no advice, no trades.
import { useEffect, useState, type ReactNode } from 'react'
import { useNumberRoll } from '../../components/motion'
import type { MarketsData } from './useMarketsData'
import { backoffSeconds, direction, fmtMoney, fmtPct, fmtSignedMoney, freshness, sparkPath } from './view'
import './markets.css'

export function useClock(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function Banner({ d, now }: { d: MarketsData; now: number }) {
  const err = d.error
  const [startedAt, setStartedAt] = useState(now)
  useEffect(() => { setStartedAt(Date.now()) }, [err])
  if (!err || err.code === 'NoKey') return null
  if (err.code === 'Unavailable' && d.hasLive) return null // one odd symbol should not shout over good prices
  let text = err.message
  if (err.code === 'InvalidKey') text = 'Finnhub did not accept the saved key. Replace it under Key settings below.'
  if (err.code === 'RateLimited') text = `Finnhub is limiting requests. Resuming in ${backoffSeconds(err.retryAfterMs, startedAt, now)} s.`
  if (err.code === 'Offline') text = d.hasLive || d.series.length || d.rows.some((r) => r.price !== undefined) ? 'Offline. Showing the last prices saved on this device.' : err.message
  return (
    <div className={`mkt-banner ${err.code === 'Offline' ? '' : 'mkt-banner-warn'}`} role="status">
      <span>{text}</span>
      {err.code !== 'Offline' && err.code !== 'InvalidKey' && <button className="btn btn-sm" onClick={d.refresh}>Retry</button>}
    </div>
  )
}

export function Hero({ d, now, empty }: { d: MarketsData; now: number; empty?: ReactNode }) {
  const p = d.portfolio
  const hasHoldings = p.positions.length > 0
  const shown = useNumberRoll(Math.round(p.totalValue * 100), 600) / 100
  const live = d.key.hasKey
  const fresh = freshness({ now, hasKey: live, fetchedAt: d.fetchedAt, marketOpen: d.status?.isOpen, offline: d.error?.code === 'Offline' })
  const values = d.series.map((s) => s.value)
  if (hasHoldings && d.hasLive && values.length) values.push(p.totalValue)
  const path = sparkPath(values, 160, 40)
  const dir = direction(p.dayChange)
  const showDay = hasHoldings && d.hasLive
  return (
    <section className="mkt-hero card" aria-label="Portfolio value">
      <div className="mkt-hero-top">
        <span className="mkt-eyebrow">Portfolio value</span>
        <span className="mkt-hero-meta">
          {live && !d.statusError && d.status && (
            <span className={`mkt-pill ${d.status.isOpen ? 'mkt-pill-open' : ''}`}>{d.status.isOpen ? 'Market open' : 'Market closed'}</span>
          )}
          <span className={`mkt-fresh mkt-fresh-${fresh.tone}`} aria-live="off">{fresh.label}</span>
        </span>
      </div>
      {d.loading ? (
        <div className="mkt-skel mkt-skel-hero" aria-label="Loading" />
      ) : hasHoldings ? (
        <div className="mkt-hero-body">
          <div>
            <div className="mkt-hero-value" data-testid="portfolio-value">{fmtMoney(shown)}</div>
            <div className={`mkt-hero-day mkt-${dir}`}>
              {showDay ? (
                <>
                  <span>{fmtSignedMoney(p.dayChange)}</span> <span>{fmtPct(p.dayChangePct * 100)}</span> <span className="muted">today</span>
                </>
              ) : (
                <span className="muted">{live ? 'Day change appears once prices load.' : 'Saved prices. Add a key for the day change.'}</span>
              )}
            </div>
          </div>
          <div className="mkt-spark">
            {path ? (
              <svg viewBox="0 0 160 40" role="img" aria-label={`Portfolio value over ${values.length} recorded days`}><path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
            ) : (
              <span className="mkt-spark-note">Chart builds as you open the app</span>
            )}
          </div>
        </div>
      ) : (
        <div className="mkt-hero-empty row"><span className="muted">No holdings yet.</span>{empty}</div>
      )}
    </section>
  )
}
