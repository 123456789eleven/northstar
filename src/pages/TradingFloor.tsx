// Bank, Trading floor: portfolio value, the watchlist (prices flash powder on an up-tick, poppy on a down-tick), live prices
// setup when there is no key, and this year's retirement contributions. Portfolio, screener and holdings open as views.
// Information only: no advice, no trades.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, getSetting } from '../db'
import { today } from '../lib/dates'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { BankView, useView, useViewHref } from '../features/bank/bankNav'
import { Ring } from '../features/game/ui/Ring'
import Investments from '../features/investments/Investments'
import { DEFAULT_IRA_LIMIT, monthlyToMax, remainingRoom, ytdContributions } from '../features/investments/model'
import Detail from '../features/markets/Detail'
import KeySetup from '../features/markets/KeySetup'
import { Banner, Hero, useClock } from '../features/markets/MarketsHero'
import PortfolioView from '../features/markets/PortfolioView'
import Screener from '../features/markets/Screener'
import { useMarketsData, type MarketsData } from '../features/markets/useMarketsData'
import Watchlist from '../features/markets/Watchlist'
import { ADVICE_NOTE } from '../features/markets/view'
import '../features/finance/finance.css'
import '../features/finance/money.css'
import '../features/markets/markets.css'
import '../features/bank/bank.css'

const whole = (n: number) => Math.round(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function Retirement({ href }: { href: string }) {
  const d = useLiveQuery(async () => {
    const [contribs, limit] = await Promise.all([db.contributions.toArray(), getSetting<number>('invest.iraLimit', DEFAULT_IRA_LIMIT)])
    return { contribs, limit: Number(limit) || DEFAULT_IRA_LIMIT }
  }, [])
  if (!d) return null
  const t = today()
  const year = Number(t.slice(0, 4))
  const ytd = ytdContributions(d.contribs, year)
  const room = remainingRoom(d.limit, ytd)
  const share = d.limit > 0 ? Math.min(1, ytd / d.limit) : 0
  return (
    <FloorCard title={`${year} retirement`} action={<Link className="btn btn-ghost btn-sm" to={href}>Holdings</Link>}>
      <div className="tf-roth">
        <Ring value={share} size={64} stroke={6} tone={room === 0 ? 'reward' : undefined} label={`${Math.round(share * 100)} percent of the ${year} limit`}>
          <span className="mn-ring-pct mn-num">{Math.round(share * 100)}%</span>
        </Ring>
        <span className="tf-roth-text mn-num">
          <span><strong>{whole(ytd)}</strong> of {whole(d.limit)}</span>
          <span className="muted">{room === 0 ? 'Limit reached' : `${whole(monthlyToMax(d.limit, ytd, t))} a month fills it`}</span>
        </span>
      </div>
    </FloorCard>
  )
}

/** A floor view that can open a symbol's detail sheet. */
function WithDetail({ d, children }: { d: MarketsData; children: (select: (s: string | null) => void, selected: string | null) => ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <>
      {children(setSelected, selected)}
      {selected && <Detail key={selected} d={d} symbol={selected} onClose={() => setSelected(null)} inline={false} />}
    </>
  )
}

export default function TradingFloor() {
  const d = useMarketsData()
  const now = useClock()
  const view = useView()
  const href = useViewHref()
  const hasKey = d.key.hasKey

  if (view === 'holdings') return <BankView title="Holdings and contributions"><Investments /></BankView>
  if (view === 'portfolio') return <BankView title="Portfolio"><WithDetail d={d}>{(sel) => <PortfolioView d={d} onSelect={sel} />}</WithDetail></BankView>
  if (view === 'screener') return <BankView title="Screener"><WithDetail d={d}>{(sel) => <Screener d={d} onSelect={sel} />}</WithDetail></BankView>
  if (view === 'key') return <BankView title="Live prices"><div className="card floor-card"><KeySetup /></div></BankView>

  const hero = (
    <div className="stack tf-hero">
      <Banner d={d} now={now} />
      <Hero d={d} now={now} empty={<Link className="btn btn-primary btn-sm" to={href('holdings')}>Add a holding</Link>} />
    </div>
  )
  return (
    <WithDetail d={d}>
      {(select, selected) => (
        <FloorView
          label="Trading floor"
          className="bk tf"
          hero={hero}
          support={[
            <FloorCard key="watch" title="Watchlist" className="tf-watch"><Watchlist d={d} selected={selected} onSelect={select} /></FloorCard>,
            <div key="side" className="bk-side">
              {!d.key.loading && !hasKey && <FloorCard title="Live prices" className="tf-key"><KeySetup /></FloorCard>}
              <Retirement href={href('holdings')} />
            </div>,
          ]}
          more={
            <>
              <FloorMore
                floor="Trading floor"
                items={[
                  { id: 'portfolio', label: 'Portfolio', to: href('portfolio') },
                  { id: 'screener', label: 'Screener', to: href('screener') },
                  { id: 'holdings', label: 'Holdings', to: href('holdings') },
                  ...(hasKey ? [{ id: 'key', label: 'Key settings', to: href('key') }] : []),
                ]}
              />
              <p className="bk-fine">{ADVICE_NOTE} Prices from Finnhub may be delayed. No trades are placed.</p>
            </>
          }
        />
      )}
    </WithDetail>
  )
}
