import { useLiveQuery } from 'dexie-react-hooks'
import { type FormEvent, useState } from 'react'
import { Card, Empty, PageSkeleton } from '../../components/ui'
import ChartFrame from '../../components/ChartFrame'
import DataTable from '../../components/DataTable'
import KpiStrip from '../../components/KpiStrip'
import { db, logEvent, type BalanceSnapshot } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { NetWorthPath } from './NetWorthHero'
import { netWorthSeries } from './model'

/** Adds one balance snapshot; logs a milestone and returns the new net worth when it is an all-time high (else null). */
export async function addBalanceSnapshot(s: Omit<BalanceSnapshot, 'id'>): Promise<number | null> {
  const before = netWorthSeries(await db.balances.toArray())
  const prevHigh = before.length ? Math.max(...before.map((p) => p.net)) : null
  const id = await db.balances.add(s)
  const now = netWorthSeries(await db.balances.toArray()).at(-1)?.net ?? 0
  if (prevHigh === null || now <= prevHigh) return null
  await logEvent({ area: 'finance', kind: 'finance.networth-high', title: `New net worth high: ${money(now)}`, refTable: 'balances', refId: id, milestone: true })
  return now
}

/** Net worth history (Bank, Archive): add or update balances, the growth path as a table, every account's latest balance. */
export default function NetWorth() {
  const snaps = useLiveQuery(() => db.balances.toArray(), [])
  const [date, setDate] = useState(today)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<BalanceSnapshot['kind']>('asset')
  const [bal, setBal] = useState('')
  const [updating, setUpdating] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState('')

  if (!snaps) return <PageSkeleton rows={5} />

  const latest = new Map<string, BalanceSnapshot>()
  for (const s of [...snaps].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))) latest.set(s.name, s)
  const accounts = [...latest.values()].sort((a, b) => (a.kind === b.kind ? b.balance - a.balance : a.kind === 'asset' ? -1 : 1))
  const series = netWorthSeries(snaps)
  const current = series.at(-1)
  const assets = accounts.filter((a) => a.kind === 'asset').reduce((s, a) => s + a.balance, 0)
  const liabilities = accounts.filter((a) => a.kind === 'liability').reduce((s, a) => s + a.balance, 0)

  async function addSnapshot(s: Omit<BalanceSnapshot, 'id'>) {
    const high = await addBalanceSnapshot(s)
    if (high != null) {
      setFlash(`New all-time high: ${money(high)}.`)
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
        <KpiStrip
          items={[
            { label: 'Assets', value: money(assets), note: `As of ${formatDate(current.date, { month: 'short', day: 'numeric', year: 'numeric' })}` },
            { label: 'Liabilities', value: money(liabilities) },
          ]}
        />
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
          <Empty>Add each account's balance above: checking, savings, retirement, plus what you owe, like a card or car loan. Update it every so often and the growth path draws itself.</Empty>
        </Card>
      ) : (
        <>
          <ChartFrame
            title="Growth path"
            hasData={series.length >= 2}
            table={
              <table className="table">
                <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Net worth</th></tr></thead>
                <tbody>{[...series].reverse().map((p) => <tr key={p.date}><td>{formatDate(p.date, { month: 'short', day: 'numeric', year: '2-digit' })}</td><td className="mono" style={{ textAlign: 'right' }}>{money(p.net)}</td></tr>)}</tbody>
              </table>
            }
          >
            <NetWorthPath data={series} />
          </ChartFrame>
          <Card title="Accounts · latest balance" flush>
            <DataTable
              label="Accounts"
              rows={accounts}
              rowKey={(a) => a.name}
              columns={[
                { key: 'name', header: 'Account', primary: true, render: (a) => a.name },
                { key: 'kind', header: 'Type', render: (a) => <span className="muted small">{a.kind === 'asset' ? 'Asset' : 'Liability'}</span> },
                { key: 'asof', header: 'As of', render: (a) => <span className="muted small nowrap">{formatDate(a.date, { month: 'short', day: 'numeric', year: '2-digit' })}</span> },
                {
                  key: 'upd',
                  header: 'Update today',
                  render: (a) => (
                    <form className="row" style={{ gap: 4 }} onSubmit={(e) => { e.preventDefault(); quickUpdate(a) }}>
                      <input
                        className="input mono"
                        style={{ width: 110, height: 32 }}
                        inputMode="decimal"
                        placeholder={String(a.balance)}
                        value={updating[a.name] ?? ''}
                        onChange={(e) => setUpdating((u) => ({ ...u, [a.name]: e.target.value }))}
                        aria-label={`New balance for ${a.name}`}
                      />
                      <button className="btn btn-sm" disabled={!updating[a.name]?.trim()}>Save</button>
                    </form>
                  ),
                },
                { key: 'bal', header: 'Balance', align: 'right', value: true, render: (a) => <span className={`mono nowrap ${a.kind === 'liability' ? 'warn' : ''}`}>{a.kind === 'liability' ? '−' : ''}{money(a.balance)}</span> },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}
