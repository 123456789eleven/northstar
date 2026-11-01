import { useLiveQuery } from 'dexie-react-hooks'
import { type FormEvent, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartFrame from '../../components/ChartFrame'
import StatusChip from '../../components/StatusChip'
import { Card, Empty, Progress } from '../../components/ui'
import { db, setSetting, type BalanceSnapshot, type Contribution, type Holding } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { addNetWorthSnapshot, addContribution, deleteContribution, recordContributions, updatePrice } from './actions'
import {
  allocation, contributedToDate, DEFAULT_IRA_LIMIT, holdingGain, holdingValue, importCandidates, isStale, monthlySeries, monthlyToMax,
  remainingRoom, sharesFromBalance, whatIf, ytdContributions,
} from './model'
import './investments.css'

const AMBER = '#e3b261'
const GRID = '#262a33'
const AXIS = '#a6a49d'
const num = (s: string) => Number(s.replace(/[$,\s]/g, ''))
const okNum = (s: string) => s.trim() !== '' && Number.isFinite(num(s))
const fmtShares = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 })

export default function Investments() {
  const holdings = useLiveQuery(() => db.holdings.toArray(), [])
  const balances = useLiveQuery(() => db.balances.toArray(), [])
  const contribs = useLiveQuery(() => db.contributions.toArray(), [])
  const settings = useLiveQuery(() => db.settings.toArray(), [])
  if (!holdings || !balances || !contribs || !settings) return null

  const setting = <T,>(k: string, d: T) => (settings.find((s) => s.key === k)?.value as T | undefined) ?? d
  const limit = Number(setting('invest.iraLimit', DEFAULT_IRA_LIMIT))
  const catchup = Number(setting('invest.iraCatchup', 0))
  const marked = setting<string[]>('invest.accounts', [])

  const latest = new Map<string, BalanceSnapshot>()
  for (const s of [...balances].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))) latest.set(s.name, s)
  const assetNames = [...latest.values()].filter((s) => s.kind === 'asset').map((s) => s.name)
  const accounts = [...new Set([...holdings.map((h) => h.account), ...marked])]
  const untracked = assetNames.filter((n) => !accounts.includes(n))

  return (
    <div className="stack" style={{ gap: 16 }}>
      {holdings.length === 0 && (
        <Card title="Add your first holding">
          <Empty>Add your VTI holding: type your balance and today's price. Prices are typed by hand; nothing is looked up online.</Empty>
        </Card>
      )}
      <HoldingSetup assetNames={assetNames} latest={latest} />
      {holdings.length > 1 && <AllocationBar holdings={holdings} />}
      {accounts.map((a) => (
        <AccountCard key={a} account={a} holdings={holdings.filter((h) => h.account === a)} latest={latest.get(a)} snaps={balances} contribs={contribs} limit={limit + catchup} />
      ))}
      <Card title="Retirement contribution limit">
        <LimitSettings limit={limit} catchup={catchup} />
      </Card>
      {untracked.length > 0 && (
        <div className="inv-form small muted">
          Track another account:
          {untracked.map((n) => (
            <button key={n} className="btn btn-sm" onClick={() => setSetting('invest.accounts', [...marked, n])}>{n}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function HoldingSetup({ assetNames, latest }: { assetNames: string[]; latest: Map<string, BalanceSnapshot> }) {
  const guess = assetNames.find((n) => /roth|ira|vti/i.test(n)) ?? ''
  const [mode, setMode] = useState<'balance' | 'shares'>('balance')
  const [account, setAccount] = useState(guess)
  const [ticker, setTicker] = useState('VTI')
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [open, setOpen] = useState(false)
  const bal = latest.get(account)?.balance
  const p = okNum(price) ? num(price) : null
  const a = okNum(amount) ? num(amount) : null
  const effAmount = mode === 'balance' && a == null && bal != null ? bal : a
  const shares = p != null && effAmount != null ? (mode === 'balance' ? sharesFromBalance(effAmount, p) : effAmount) : null
  const valid = account.trim() && ticker.trim() && p != null && p > 0 && shares != null

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid || shares == null || p == null) return
    const acct = account.trim()
    await db.holdings.add({ account: acct, ticker: ticker.trim().toUpperCase(), shares, price: p, priceDate: today() })
    if (mode === 'balance' && !latest.has(acct) && effAmount != null) await addNetWorthSnapshot({ date: today(), name: acct, kind: 'asset', balance: effAmount })
    setPrice('')
    setAmount('')
    setOpen(false)
  }

  if (!open) return <div><button className="btn btn-sm" onClick={() => setOpen(true)}>Add a holding</button></div>
  return (
    <form className="card stack" style={{ gap: 10 }} onSubmit={save}>
      <div className="row wrap" role="group" aria-label="Setup mode" style={{ gap: 6 }}>
        <button type="button" className={`btn btn-sm ${mode === 'balance' ? 'btn-primary' : ''}`} aria-pressed={mode === 'balance'} onClick={() => setMode('balance')}>I know the balance and price</button>
        <button type="button" className={`btn btn-sm ${mode === 'shares' ? 'btn-primary' : ''}`} aria-pressed={mode === 'shares'} onClick={() => setMode('shares')}>I know my shares</button>
      </div>
      <div className="inv-form">
        <input className="input" list="inv-accts" placeholder="Net worth account" value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Account" style={{ flex: '2 1 200px' }} />
        <datalist id="inv-accts">{assetNames.map((n) => <option key={n} value={n} />)}</datalist>
        <input className="input" placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} aria-label="Ticker" style={{ width: 90 }} />
        <input className="input mono" inputMode="decimal" placeholder={mode === 'balance' ? (bal != null ? String(bal) : 'Balance') : 'Shares'} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={mode === 'balance' ? 'Balance' : 'Shares'} style={{ width: 130 }} />
        <input className="input mono" inputMode="decimal" placeholder="Price today" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price today" style={{ width: 120 }} />
        <button className="btn btn-primary" disabled={!valid}>Save</button>
      </div>
      <div className="inv-note">
        {mode === 'balance'
          ? shares != null && effAmount != null && p != null
            ? `${money(effAmount)} ÷ ${money(p)} = ${fmtShares(shares)} shares (rounded to 3 decimals). Find the exact share count on your Schwab positions page later and correct it.`
            : 'Shares = balance ÷ price. Leave balance empty to use the latest Net worth balance.'
          : shares != null && p != null
            ? `${fmtShares(shares)} shares × ${money(p)} = ${money(shares * p)}.`
            : 'Value = shares × price.'}
      </div>
    </form>
  )
}

function AllocationBar({ holdings }: { holdings: Holding[] }) {
  const alloc = allocation(holdings)
  if (alloc.length < 2) return null
  return (
    <Card title="Allocation">
      <div className="inv-alloc" role="img" aria-label={alloc.map((x) => `${x.ticker} ${Math.round(x.share * 100)}%`).join(', ')}>
        {alloc.map((x, i) => <span key={x.ticker} style={{ width: `${x.share * 100}%`, opacity: 1 - i * 0.22 > 0.3 ? 1 - i * 0.22 : 0.3 }} />)}
      </div>
      <div className="row wrap small" style={{ gap: 12, marginTop: 8 }}>
        {alloc.map((x) => <span key={x.ticker}><strong>{x.ticker}</strong> <span className="mono muted">{(x.share * 100).toFixed(1)}%</span></span>)}
      </div>
    </Card>
  )
}

function HoldingRow({ h, latestBal, account }: { h: Holding; latestBal?: BalanceSnapshot; account: string }) {
  const [px, setPx] = useState('')
  const [edit, setEdit] = useState(false)
  const [sh, setSh] = useState(h.shares != null ? String(h.shares) : '')
  const [cb, setCb] = useState(h.costBasis != null ? String(h.costBasis) : '')
  const val = holdingValue(h)
  const gain = holdingGain(h)
  const stale = isStale(h.priceDate, today())
  const diff = val != null && latestBal ? Math.abs(val - latestBal.balance) >= 0.5 : false

  async function savePrice(e: FormEvent) {
    e.preventDefault()
    if (!okNum(px) || num(px) <= 0) return
    await updatePrice(h.id!, num(px))
    setPx('')
  }
  async function saveEdit() {
    await db.holdings.update(h.id!, { shares: okNum(sh) ? num(sh) : undefined, costBasis: okNum(cb) ? num(cb) : undefined })
    setEdit(false)
  }
  async function pushToNetWorth() {
    if (val == null) return
    await addNetWorthSnapshot({ date: today(), name: account, kind: 'asset', balance: val })
  }

  return (
    <div className="inv-holding">
      <div>
        <span className="inv-ticker">{h.ticker}</span>{' '}
        <span className="muted small">{h.shares != null ? `${fmtShares(h.shares)} sh` : 'shares not set'}</span>
        <div className="small muted">
          {h.price != null ? `${money(h.price)} · ${h.priceDate ? formatDate(h.priceDate) : 'no date'}` : 'no price yet'}{' '}
          {(h.price == null || stale) && <StatusChip status="warn">Stale</StatusChip>}
        </div>
      </div>
      <div className="inv-val">
        <div className="mono">{val != null ? money(val) : '—'}</div>
        {gain && <div className={`small mono ${gain.amount >= 0 ? 'good' : 'warn'}`}>{gain.amount >= 0 ? '+' : '−'}{money(Math.abs(gain.amount))} ({(gain.pct * 100).toFixed(1)}%)</div>}
      </div>
      <form className="inv-upd" onSubmit={savePrice}>
        <input className="input mono" inputMode="decimal" placeholder="Update price, e.g. 312.45" value={px} onChange={(e) => setPx(e.target.value)} aria-label={`New price for ${h.ticker}`} style={{ width: 170 }} />
        <button className="btn btn-sm" disabled={!okNum(px)}>Update price</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEdit((v) => !v)}>{edit ? 'Close' : 'Edit'}</button>
        {diff && <button type="button" className="btn btn-sm" onClick={pushToNetWorth}>Update Net worth balance to {money(val!)}</button>}
      </form>
      {edit && (
        <div className="inv-upd">
          <input className="input mono" inputMode="decimal" placeholder="Shares" value={sh} onChange={(e) => setSh(e.target.value)} aria-label="Shares" />
          <input className="input mono" inputMode="decimal" placeholder="Cost basis (optional)" value={cb} onChange={(e) => setCb(e.target.value)} aria-label="Cost basis" style={{ width: 170 }} />
          <button className="btn btn-sm btn-primary" onClick={saveEdit}>Save</button>
          <button className="btn btn-sm btn-ghost" onClick={async () => { await db.holdings.delete(h.id!) }}>Remove holding</button>
        </div>
      )}
    </div>
  )
}

function AccountCard({ account, holdings, latest, snaps, contribs, limit }: { account: string; holdings: Holding[]; latest?: BalanceSnapshot; snaps: BalanceSnapshot[]; contribs: Contribution[]; limit: number }) {
  const total = holdings.reduce((s, h) => s + (holdingValue(h) ?? 0), 0)
  return (
    <Card title={account} action={<span className="mono">{money(holdings.length ? total : latest?.balance ?? 0)}</span>}>
      {holdings.length === 0 && <Empty>No holding yet. Use "Add a holding" above and pick this account.</Empty>}
      {holdings.map((h) => <HoldingRow key={h.id} h={h} latestBal={latest} account={account} />)}
      <Tracker account={account} contribs={contribs} limit={limit} />
      <Growth account={account} snaps={snaps} contribs={contribs} />
    </Card>
  )
}

function Tracker({ account, contribs, limit }: { account: string; contribs: Contribution[]; limit: number }) {
  const now = today()
  const year = Number(now.slice(0, 4))
  const ytd = ytdContributions(contribs, year, account)
  const room = remainingRoom(limit, ytd)
  const perMonth = monthlyToMax(limit, ytd, now)
  const [date, setDate] = useState(now)
  const [amt, setAmt] = useState('')
  const [kind, setKind] = useState<Contribution['kind']>('contribution')
  const rows = contribs.filter((c) => c.account === account).sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!okNum(amt) || num(amt) <= 0) return
    await addContribution({ date: date || now, amount: num(amt), account, kind }, limit)
    setAmt('')
  }

  return (
    <div className="stack" style={{ gap: 8, marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <strong>{year} contributions</strong>
        <span className="mono small">{money(ytd)} of {money(limit)}</span>
      </div>
      <Progress value={limit > 0 ? Math.min(100, (ytd / limit) * 100) : 0} label={`${year} contributions toward limit`} />
      <div className="small muted">
        {room === 0 ? 'Limit reached for this year.' : `${money(room)} room left. To max by Dec 31: ${money(perMonth)} per month.`}
      </div>
      <form className="inv-form" onSubmit={add}>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <input className="input mono" inputMode="decimal" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} aria-label="Amount" style={{ width: 110 }} />
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value as Contribution['kind'])} aria-label="Kind" style={{ width: 'auto' }}>
          <option value="contribution">Contribution</option>
          <option value="withdrawal">Withdrawal</option>
        </select>
        <button className="btn btn-primary" disabled={!okNum(amt)}>Add</button>
      </form>
      {rows.length === 0 && <div className="inv-note">No contributions logged yet. Add this year's deposits, or import them from transactions below.</div>}
      {rows.slice(0, 8).map((c) => (
        <div key={c.id} className="inv-row">
          <span className="small">{formatDate(c.date, { month: 'short', day: 'numeric', year: 'numeric' })} · {c.kind === 'withdrawal' ? 'Withdrawal' : 'Contribution'}</span>
          <span className="row" style={{ gap: 6 }}>
            <span className="mono">{money(c.amount)}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => deleteContribution(c)} aria-label={`Delete ${money(c.amount)} on ${c.date}`}>Delete</button>
          </span>
        </div>
      ))}
      <ImportHelper account={account} contribs={contribs} limit={limit} />
      <div className="inv-note">Your actual limit and eligibility depend on your income and age. Check the current IRS limit.</div>
    </div>
  )
}

function ImportHelper({ account, contribs, limit }: { account: string; contribs: Contribution[]; limit: number }) {
  const txns = useLiveQuery(() => db.transactions.filter((t) => t.amount < 0 && /roth|ira|schwab/i.test(t.description)).toArray(), [])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const cands = importCandidates(txns ?? [], contribs)
  if (!cands.length) return null
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  return (
    <details>
      <summary className="small" style={{ cursor: 'pointer', minHeight: 32 }}>Import from transactions ({cands.length})</summary>
      {cands.map((c) => (
        <label key={c.key} className="inv-row">
          <span className="row" style={{ gap: 8, minWidth: 0 }}>
            <input type="checkbox" checked={picked.has(c.key)} onChange={() => toggle(c.key)} />
            <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDate(c.date)} · {c.description}</span>
          </span>
          <span className="mono">{money(c.amount)}</span>
        </label>
      ))}
      <button
        className="btn btn-sm btn-primary"
        style={{ marginTop: 8 }}
        disabled={picked.size === 0}
        onClick={async () => {
          await recordContributions(cands.filter((c) => picked.has(c.key)).map((c) => ({ date: c.date, amount: c.amount, account, kind: 'contribution' as const })), limit)
          setPicked(new Set())
        }}
      >
        Record {picked.size || ''} as contributions to this account
      </button>
    </details>
  )
}

function Growth({ account, snaps, contribs }: { account: string; snaps: BalanceSnapshot[]; contribs: Contribution[] }) {
  const series = monthlySeries(snaps, account)
  const [rate, setRate] = useState('')
  const [monthly, setMonthly] = useState('')
  const [years, setYears] = useState('10')
  if (series.length === 0) return null
  const value = series.at(-1)!.value
  const contributed = contributedToDate(contribs, account)
  const hasSplit = series.length >= 3 && contribs.some((c) => c.account === account)
  const hypo = okNum(rate) && okNum(years) ? whatIf(value, okNum(monthly) ? num(monthly) : 0, num(rate), num(years)) : null
  return (
    <div className="stack" style={{ gap: 8, marginTop: 12 }}>
      <ChartFrame
        title="Balance by month"
        hasData={series.length >= 2}
        table={
          <table className="table">
            <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
            <tbody>{[...series].reverse().map((p) => <tr key={p.date}><td>{formatDate(p.date, { month: 'short', day: 'numeric', year: '2-digit' })}</td><td className="mono" style={{ textAlign: 'right' }}>{money(p.value)}</td></tr>)}</tbody>
          </table>
        }
      >
        <div style={{ width: '100%', height: 200 }} role="img" aria-label={`${account} balance by month, latest ${money(value)}`}>
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(d: string) => formatDate(d, { month: 'short', year: '2-digit' })} minTickGap={36} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={48} domain={['auto', 'auto']} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip isAnimationActive={false} cursor={{ stroke: GRID }} formatter={(v) => money(Number(v))} labelFormatter={(d) => formatDate(String(d), { month: 'short', day: 'numeric', year: 'numeric' })} contentStyle={{ background: '#1c1f26', border: '1px solid #262a33', fontSize: 12 }} />
              <Line dataKey="value" name="Balance" stroke={AMBER} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
      {hasSplit && (
        <div className="row wrap small" style={{ gap: 16 }}>
          <span>Contributed (logged here): <strong className="mono">{money(contributed)}</strong></span>
          <span>Growth: <strong className="mono">{money(value - contributed)}</strong></span>
          <span className="muted">Only deposits recorded above are counted.</span>
        </div>
      )}
      <details>
        <summary className="small" style={{ cursor: 'pointer', minHeight: 32 }}>What-if calculator (hypothetical)</summary>
        <div className="inv-form" style={{ marginTop: 6 }}>
          <input className="input mono" inputMode="decimal" placeholder="Yearly return %" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Assumed yearly return percent" style={{ width: 130 }} />
          <input className="input mono" inputMode="decimal" placeholder="Monthly add" value={monthly} onChange={(e) => setMonthly(e.target.value)} aria-label="Monthly contribution" style={{ width: 110 }} />
          <input className="input mono" inputMode="decimal" placeholder="Years" value={years} onChange={(e) => setYears(e.target.value)} aria-label="Years" style={{ width: 80 }} />
        </div>
        <div className="inv-note" style={{ marginTop: 6 }}>
          {hypo != null ? `Hypothetical: ${money(hypo)} after ${years} years at ${rate}% per year. This is arithmetic on a rate you typed, not a forecast.` : 'Type a return rate you want to test. Nothing here predicts real returns.'}
        </div>
      </details>
    </div>
  )
}

function LimitSettings({ limit, catchup }: { limit: number; catchup: number }) {
  const [l, setL] = useState(String(limit))
  const [c, setC] = useState(String(catchup))
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="inv-form">
        <label className="small muted">Annual limit (estimate)</label>
        <input className="input mono" inputMode="decimal" value={l} onChange={(e) => setL(e.target.value)} onBlur={() => okNum(l) && setSetting('invest.iraLimit', num(l))} aria-label="Annual IRA limit" style={{ width: 100 }} />
        <label className="small muted">Catch-up</label>
        <input className="input mono" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} onBlur={() => okNum(c) && setSetting('invest.iraCatchup', num(c))} aria-label="Catch-up amount" style={{ width: 100 }} />
      </div>
      <div className="inv-note">Check the current IRS limit. What you can contribute depends on your income and age.</div>
    </div>
  )
}
