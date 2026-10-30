import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Card, Empty, Field } from '../../components/ui'
import { db, getSetting, setSetting, type Transaction } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { categorizeWithSource, TRANSFER, UNCATEGORIZED } from './categories'
import { buildRow, describeMapping, detectMapping, headerSignature, MAP_KEY_PREFIX, parseCsv, type Mapping, type ParsedFile, type RowResult } from './csv'
import { planImport } from './dedupe'
import { commitImport, undoImport } from './importActions'
import { isOfxText, ofxKey, parseOfx, type OfxParse } from './ofx'
import { useImports, useRules } from './model'

interface Result {
  added: number
  skipped: number
  errors: number
  uncategorized: number
  from?: string
  to?: string
  batch: string
}

export default function Import({ onDone }: { onDone: (category?: string, month?: string) => void }) {
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [map, setMap] = useState<Mapping | null>(null)
  const [account, setAccount] = useState('')
  const [err, setErr] = useState('')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ofx, setOfx] = useState<{ name: string; parsed: OfxParse } | null>(null)
  const [remembered, setRemembered] = useState(false)
  const [snap, setSnap] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rules = useRules()
  const imports = useImports()
  const existing = useLiveQuery(() => (file || ofx ? db.transactions.toArray() : Promise.resolve([] as Transaction[])), [file, ofx])

  async function load(f: File | undefined) {
    if (!f) return
    setErr('')
    setResult(null)
    if (f.size > 5 * 1024 * 1024) {
      setErr(`That file is ${(f.size / 1048576).toFixed(1)} MB. Imports are limited to 5 MB - export a shorter date range from your bank.`)
      return
    }
    try {
      const isOfxName = /\.(ofx|qfx)$/i.test(f.name)
      if (!isOfxName && !/\.(csv|txt)$/i.test(f.name) && f.type && !/csv|text/.test(f.type)) {
        setErr('That file type is not supported. Choose an OFX/QFX or CSV file from your bank.')
        return
      }
      const text = await f.text()
      if (isOfxName || isOfxText(text.slice(0, 4000))) {
        const parsed = parseOfx(text)
        if (parsed.accounts.every((a) => a.txs.length === 0)) throw new Error(parsed.warnings.join(' ') || 'No transactions found in that file.')
        setFile(null)
        setMap(null)
        setOfx({ name: f.name, parsed })
        setSnap(false)
        const a = parsed.accounts.find((x) => x.txs.length) ?? parsed.accounts[0]
        setAccount(a.masked ? `${a.kind === 'card' ? 'Card' : 'Account'} ${a.masked}` : f.name.replace(/\.(ofx|qfx)$/i, ''))
        return
      }
      const p = await parseCsv(f)
      const saved = await getSetting<Mapping | null>(MAP_KEY_PREFIX + headerSignature(p.headers), null)
      const width = p.headers.length
      const ok = saved && [saved.date, saved.description, saved.amount, saved.debit, saved.credit].every((i) => i < width)
      setOfx(null)
      setFile(p)
      setMap(ok ? saved : detectMapping(p))
      setRemembered(!!ok)
      setAccount(f.name.replace(/\.(csv|txt)$/i, '').replace(/[_-]+/g, ' ').slice(0, 40))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDrag(false)
    load(e.dataTransfer.files?.[0])
  }

  const built = useMemo<RowResult[]>(() => {
    if (ofx) {
      const multi = ofx.parsed.accounts.filter((a) => a.txs.length).length > 1
      return ofx.parsed.accounts.flatMap((a) =>
        a.txs.map((t): RowResult => {
          const base = multi ? `${a.kind === 'card' ? 'Card' : 'Account'} ${a.masked}` : account.trim()
          const c = categorizeWithSource(t.description, t.amount, rules.user)
          const category = c.source === 'none' && t.type === 'XFER' ? TRANSFER : c.category
          const tx: Omit<Transaction, 'id'> = { date: t.date, amount: t.amount, description: t.description, category }
          if (base) tx.account = base
          if (t.fitid) tx.fitid = ofxKey(a, t.fitid)
          return { tx }
        }),
      )
    }
    return file && map ? file.rows.map((r) => buildRow(r, map, rules.all, account)) : []
  }, [file, map, ofx, rules.all, rules.user, account])

  const plan = useMemo(() => (existing ? planImport(built.map((b) => b.tx), existing) : null), [built, existing])

  const counts = plan ? { new: plan.filter((s) => s === 'new').length, dup: plan.filter((s) => s === 'dup').length, error: plan.filter((s) => s === 'error').length } : null
  const mappingOk = !!ofx || !!map && map.date >= 0 && (map.mode === 'amount' ? map.amount >= 0 : map.debit >= 0 || map.credit >= 0)

  async function runImport() {
    if ((!file && !ofx) || !plan || !counts) return
    setBusy(true)
    try {
      const name = file?.name ?? ofx!.name
      const rows = built.flatMap((b, i) => (plan[i] === 'new' && b.tx ? [b.tx] : []))
      const { batch } = await commitImport(name, rows, counts.dup, counts.error)
      const dates = rows.map((r) => r.date).sort()
      setResult({ added: rows.length, skipped: counts.dup, errors: counts.error, uncategorized: rows.filter((r) => r.category === UNCATEGORIZED).length, from: dates[0], to: dates.at(-1), batch })
      if (file && map) await setSetting(MAP_KEY_PREFIX + headerSignature(file.headers), map)
      if (ofx && snap) {
        for (const a of ofx.parsed.accounts) {
          if (!a.ledger) continue
          const label = `${a.kind === 'card' ? 'Card' : 'Account'} ${a.masked}`.trim()
          const bal = a.ledger.amount
          await db.balances.add({ date: a.ledger.date ?? today(), name: label, kind: a.kind === 'card' || bal < 0 ? 'liability' : 'asset', balance: Math.abs(bal) })
        }
      }
      setFile(null)
      setMap(null)
      setOfx(null)
    } finally {
      setBusy(false)
    }
  }

  async function undo(id: string) {
    const n = await db.transactions.where('importBatch').equals(id).count()
    if (!window.confirm(`Remove the ${n} transaction${n === 1 ? '' : 's'} added by this import?`)) return
    await undoImport(id)
    if (result?.batch === id) setResult(null)
  }

  const col = (label: string, key: 'date' | 'description' | 'amount' | 'debit' | 'credit', optional = false) =>
    file &&
    map && (
      <Field label={label}>
        <select className="select" value={map[key]} onChange={(e) => setMap({ ...map, [key]: Number(e.target.value) })}>
          <option value={-1}>{optional ? '(none)' : '— choose —'}</option>
          {file.headers.map((h, i) => (
            <option key={i} value={i}>
              {h}
              {file.rows[0]?.[i] ? ` · e.g. ${file.rows[0][i].slice(0, 24)}` : ''}
            </option>
          ))}
        </select>
      </Field>
    )

  return (
    <div className="stack" style={{ gap: 16 }}>
      {result && (
        <Card title="Import complete">
          <p className="small" style={{ margin: '0 0 10px' }}>
            Added <strong>{result.added}</strong> transaction{result.added === 1 ? '' : 's'}
            {result.from && result.to && (
              <span className="muted">
                {' '}
                ({formatDate(result.from, { month: 'short', day: 'numeric', year: 'numeric' })} – {formatDate(result.to, { month: 'short', day: 'numeric', year: 'numeric' })})
              </span>
            )}
            . Skipped {result.skipped} already-imported{result.errors > 0 ? ` and ${result.errors} unreadable` : ''} row{result.skipped + result.errors === 1 ? '' : 's'}.
            {result.uncategorized > 0 && ` ${result.uncategorized} need a category.`}
          </p>
          <div className="row wrap">
            {result.uncategorized > 0 ? (
              <button className="btn btn-primary" onClick={() => onDone(UNCATEGORIZED, result.to?.slice(0, 7))}>
                Categorize {result.uncategorized}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => onDone(undefined, result.to?.slice(0, 7))}>
                View transactions
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => undo(result.batch)}>
              Undo this import
            </button>
          </div>
        </Card>
      )}

      {!file && !ofx && (
        <div
          className={`fin-drop ${drag ? 'is-drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <div style={{ fontSize: 16 }}>Drop a bank file here, or tap to choose one</div>
          <div className="small faint" style={{ marginTop: 6, maxWidth: 520, textAlign: 'left' }}>
            <p style={{ margin: '0 0 6px' }}>
              <strong style={{ color: 'var(--ink-2)' }}>How to get the file.</strong> Sign in to your bank or card website, open an account’s transactions, pick a date range, and choose Download or Export. Choose <strong>OFX or QFX</strong> if offered (it has exact dates and amounts and never double-counts); CSV is fine too.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--ink-2)' }}>What is read.</strong> Date, amount, description and an account number (only the last 4 digits are shown). Nothing is uploaded; the file is read on this device and no logins are ever stored. Importing the same period twice is safe.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".ofx,.qfx,.csv,.txt,text/csv"
            hidden
            onChange={(e) => {
              load(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      )}
      {err && <div className="small warn">{err}</div>}

      {(file || ofx) && (
        <Card
          title={file ? `${file.name} · ${file.rows.length} rows` : `${ofx!.name} · ${built.length} transactions`}
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setFile(null)
              setMap(null)
              setOfx(null)
            }}>
              Cancel
            </button>
          }
        >
          {ofx && <OfxSummary parsed={ofx.parsed} account={account} setAccount={setAccount} snap={snap} setSnap={setSnap} />}
          {file && map && (<>
          <div className="small muted" style={{ marginBottom: 10 }}>
            {remembered ? 'Using the column mapping you used for this layout before. ' : 'Detected: '}
            {describeMapping(file, map)}
          </div>
          <div className="grid grid-3">
            {col('Date column', 'date')}
            {col('Description column', 'description', true)}
            <Field label="Amounts are in">
              <select className="select" value={map.mode} onChange={(e) => setMap({ ...map, mode: e.target.value as Mapping['mode'] })}>
                <option value="amount">One amount column</option>
                <option value="split">Separate debit / credit columns</option>
              </select>
            </Field>
            {map.mode === 'amount' ? (
              col('Amount column', 'amount')
            ) : (
              <>
                {col('Debit (money out)', 'debit', true)}
                {col('Credit (money in)', 'credit', true)}
              </>
            )}
            <Field label="Account name (optional)">
              <input className="input" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. Chase checking" />
            </Field>
          </div>
          <div className="row wrap" style={{ marginTop: 12, gap: 18 }}>
            {map.mode === 'amount' && (
              <label className="row small" style={{ gap: 8 }}>
                <input type="checkbox" className="check" checked={map.expensesPositive} onChange={(e) => setMap({ ...map, expensesPositive: e.target.checked })} />
                Expenses are positive in this file
              </label>
            )}
            <label className="row small" style={{ gap: 8 }}>
              <input type="checkbox" className="check" checked={map.dayFirst} onChange={(e) => setMap({ ...map, dayFirst: e.target.checked })} />
              Dates are day/month/year
            </label>
          </div>
          </>)}

          <hr className="divider" />
          <div className="small muted" style={{ marginBottom: 8 }}>
            Preview (first 10 rows). Spending should show as negative. “suggested” categories come from built-in keywords.
          </div>
          <div className="table-wrap">
            <table className="table fin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {built.slice(0, 10).map((b, i) => (
                  <tr key={i}>
                    {b.tx ? (
                      <>
                        <td className="mono muted nowrap">{formatDate(b.tx.date, { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                        <td className="fin-desc">{b.tx.description}</td>
                        <td className={`mono nowrap ${b.tx.amount > 0 ? 'good' : ''}`} style={{ textAlign: 'right' }}>
                          {money(b.tx.amount)}
                        </td>
                        <td className={`small ${b.tx.category === UNCATEGORIZED ? 'faint' : ''}`}>
                          {b.tx.category}
                          {categorizeWithSource(b.tx.description, b.tx.amount, rules.user).source === 'default' && b.tx.category !== UNCATEGORIZED && <span className="tiny faint"> · suggested</span>}
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="small faint">
                        {b.error} · {file?.rows[i]?.join(' | ').slice(0, 80)}
                      </td>
                    )}
                    <td className="small nowrap">{plan?.[i] === 'dup' ? <span className="faint">Already imported</span> : plan?.[i] === 'error' ? <span className="warn">Skip</span> : 'New'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-between wrap" style={{ marginTop: 14 }}>
            <span className="small muted">
              {counts ? (
                <>
                  <strong style={{ color: 'var(--ink)' }}>{counts.new}</strong> new · {counts.dup} already imported · {counts.error} unreadable
                </>
              ) : (
                'Checking for duplicates…'
              )}
            </span>
            <button className="btn btn-primary" disabled={!mappingOk || !counts || counts.new === 0 || busy} onClick={runImport}>
              {counts && counts.new > 0 ? `Import ${counts.new}` : 'Nothing new to import'}
            </button>
          </div>
          {!mappingOk && <div className="small warn" style={{ marginTop: 8 }}>Pick the date and amount columns above.</div>}
        </Card>
      )}

      <Card title="Past imports">
        {imports.length === 0 ? (
          <Empty>No imports yet. Each import is kept as a batch here so you can undo it in one step.</Empty>
        ) : (
          <div className="list">
            {imports.map((r) => (
              <div key={r.id} className="list-item small">
                <div className="grow">
                  <div style={{ overflowWrap: 'anywhere' }}>{r.file}</div>
                  <div className="tiny faint">
                    {new Date(r.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {r.added} added · {r.skipped} skipped
                  </div>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => undo(r.id)}>
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function OfxSummary({ parsed, account, setAccount, snap, setSnap }: { parsed: OfxParse; account: string; setAccount: (s: string) => void; snap: boolean; setSnap: (b: boolean) => void }) {
  const accts = parsed.accounts.filter((a) => a.txs.length)
  const withBal = accts.filter((a) => a.ledger)
  return (
    <div className="stack" style={{ gap: 10, marginBottom: 12 }}>
      <div className="small muted">
        {parsed.format === 'xml' ? 'OFX 2 (XML)' : 'OFX 1 (SGML)'} ·{' '}
        {accts.map((a) => `${a.kind === 'card' ? 'Credit card' : 'Account'} ${a.masked || '(no id)'} · ${a.currency} · ${a.txs.length} transactions`).join(' · ')}
      </div>
      {accts.some((a) => a.currency !== 'USD') && <div className="small warn">This file is not in US dollars. Amounts are imported as printed, with no conversion.</div>}
      {parsed.warnings.map((w) => (
        <div key={w} className="small warn">{w}</div>
      ))}
      {accts.length === 1 && (
        <Field label="Account name (optional)">
          <input className="input" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. Chase checking" />
        </Field>
      )}
      {withBal.length > 0 && (
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" className="check" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          Also record the statement balance ({withBal.map((a) => money(a.ledger!.amount)).join(', ')}) as a net-worth snapshot (not removed by Undo)
        </label>
      )}
    </div>
  )
}
