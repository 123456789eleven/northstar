import { useLiveQuery } from 'dexie-react-hooks'
import { type FormEvent, useState } from 'react'
import { Card, Empty, Stat } from '../../components/ui'
import { db, logEvent, type BalanceSnapshot } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { NetWorthChart } from './charts'
import { netWorthSeries } from './model'

export default function NetWorth() {
  const snaps = useLiveQuery(() => db.balances.toArray(), [])
  const [date, setDate] = useState(today)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<BalanceSnapshot['kind']>('asset')
  const [bal, setBal] = useState('')
  const [updating, setUpdating] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState('')

  if (!snaps) return null

  const latest = new Map<string, BalanceSnapshot>()
  for (const s of [...snaps].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))) latest.set(s.name, s)
  const accounts = [...latest.values()].sort((a, b) => (a.kind === b.kind ? b.balance - a.balance : a.kind === 'asset' ? -1 : 1))
  const series = netWorthSeries(snaps)
  const current = series.at(-1)
  const assets = accounts.filter((a) => a.kind === 'asset').reduce((s, a) => s + a.balance, 0)
  const liabilities = accounts.filter((a) => a.kind === 'liability').reduce((s, a) => s + a.balance, 0)

  async function addSnapshot(s: Omit<BalanceSnapshot, 'id'>) {
    const before = netWorthSeries(await db.balances.toArray())
    const prevHigh = before.length ? Math.max(...before.map((p) => p.net)) : null
    const id = await db.balances.add(s)
    const after = netWorthSeries(await db.balances.toArray())
    const now = after.at(-1)?.net ?? 0
    if (prevHigh !== null && now > prevHigh) {
      await logEvent({ area: 'finance', kind: 'finance.networth-high', title: `New net worth high: ${money(now)}`, refTable: 'balances', refId: id, milestone: true })
      setFlash(`New all-time high: ${money(now)}`)
      setTimeout(() => setFlash(''), 5000)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(bal.replace(/[$,\s]/g, ''))
    if (!name.trim() || !Number.isFinite(n)) return
    await addSnapshot({ date: date || today(), name: name.trim(), kind, balance: Math.abs(n) })
    setName('')
    setBal('')
  }

  async function quickUpdate(a: BalanceSnapshot) {
    const raw = updating[a.name]
    const n = Number((raw ?? '').replace(/[$,\s]/g, ''))
    if (raw === undefined || raw.trim() === '' || !Number.isFinite(n)) return
    await addSnapshot({ date: today(), name: a.name, kind: a.kind, balance: Math.abs(n) })
    setUpdating((u) => {
      const next = { ...u }
      delete next[a.name]
      return next
    })
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {current && (
        <div className="grid grid-3">
          <Stat label="Net worth" value={money(current.net)} note={`As of ${formatDate(current.date, { month: 'short', day: 'numeric', year: 'numeric' })}`} />
          <Stat label="Assets" value={money(assets)} />
          <Stat label="Liabilities" value={money(liabilities)} />
        </div>
      )}
      {flash && <div className="small good">{flash}</div>}

      <form className="card fin-add" onSubmit={submit}>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <input className="input fin-add-desc" list="fin-accounts" placeholder="Account, e.g. Checking, 401k, Car loan" value={name} onChange={(e) => {
          setName(e.target.value)
          const known = latest.get(e.target.value)
          if (known) setKind(known.kind)
        }} aria-label="Account" />
        <datalist id="fin-accounts">
          {accounts.map((a) => (
            <option key={a.name} value={a.name} />
          ))}
        </datalist>
        <select className="select" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value as BalanceSnapshot['kind'])} aria-label="Kind">
          <option value="asset">Asset</option>
          <option value="liability">Liability (owed)</option>
        </select>
        <input className="input fin-add-cat" inputMode="decimal" placeholder="Balance" value={bal} onChange={(e) => setBal(e.target.value)} aria-label="Balance" />
        <button className="btn btn-primary" disabled={!name.trim() || !bal.trim()}>
          Add balance
        </button>
      </form>

      {accounts.length === 0 ? (
        <Card>
          <Empty>Add each account's current balance above — checking, savings, retirement, and anything you owe like a credit card or car loan. Update them once a month to see your net worth trend.</Empty>
        </Card>
      ) : (
        <>
          <Card title="Net worth over time">
            {series.length >= 2 ? <NetWorthChart data={series} /> : <Empty>Add another balance on a later date to see the trend.</Empty>}
          </Card>
          <Card title="Accounts · latest balance">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                    <th>As of</th>
                    <th>Update today</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.name}>
                      <td>{a.name}</td>
                      <td className="muted small">{a.kind === 'asset' ? 'Asset' : 'Liability'}</td>
                      <td className={`mono nowrap ${a.kind === 'liability' ? 'warn' : ''}`} style={{ textAlign: 'right' }}>
                        {a.kind === 'liability' ? '−' : ''}
                        {money(a.balance)}
                      </td>
                      <td className="muted small nowrap">{formatDate(a.date, { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                      <td>
                        <form
                          className="row"
                          style={{ gap: 4 }}
                          onSubmit={(e) => {
                            e.preventDefault()
                            quickUpdate(a)
                          }}
                        >
                          <input
                            className="input mono"
                            style={{ width: 110, height: 32 }}
                            inputMode="decimal"
                            placeholder={String(a.balance)}
                            value={updating[a.name] ?? ''}
                            onChange={(e) => setUpdating((u) => ({ ...u, [a.name]: e.target.value }))}
                            aria-label={`New balance for ${a.name}`}
                          />
                          <button className="btn btn-sm" disabled={!updating[a.name]?.trim()}>
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
