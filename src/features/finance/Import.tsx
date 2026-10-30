import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Card, Empty, Field } from '../../components/ui'
import { db, getSetting, logEvent, setSetting, type Transaction } from '../../db'
import { formatDate, money } from '../../lib/dates'
import { UNCATEGORIZED } from './categories'
import { buildRow, dedupeKey, detectMapping, parseCsv, type Mapping, type ParsedFile } from './csv'
import { IMPORTS_KEY, useImports, useRules, type ImportRecord } from './model'

interface Result {
  added: number
  skipped: number
  errors: number
  uncategorized: number
  from?: string
  to?: string
  batch: string
}

function countKeys(txs: Pick<Transaction, 'date' | 'amount' | 'description'>[]) {
  const m = new Map<string, number>()
  for (const t of txs) {
    const k = dedupeKey(t)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export default function Import({ onDone }: { onDone: (category?: string, month?: string) => void }) {
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [map, setMap] = useState<Mapping | null>(null)
  const [account, setAccount] = useState('')
  const [err, setErr] = useState('')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rules = useRules()
  const imports = useImports()
  const existing = useLiveQuery(() => (file ? db.transactions.toArray() : Promise.resolve([] as Transaction[])), [file])

  async function load(f: File | undefined) {
    if (!f) return
    setErr('')
    setResult(null)
    if (!/\.(csv|txt)$/i.test(f.name) && f.type && !/csv|text/.test(f.type)) {
      setErr('That doesn’t look like a CSV file. Most banks offer “Download → CSV” on the transactions page.')
      return
    }
    try {
      const p = await parseCsv(f)
      setFile(p)
      setMap(detectMapping(p))
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

  const built = useMemo(() => (file && map ? file.rows.map((r) => buildRow(r, map, rules.all, account)) : []), [file, map, rules.all, account])

  const plan = useMemo(() => {
    if (!existing) return null
    const have = countKeys(existing)
    const status: ('new' | 'dup' | 'error')[] = []
    for (const b of built) {
      if (!b.tx) {
        status.push('error')
        continue
      }
      const k = dedupeKey(b.tx)
      const n = have.get(k) ?? 0
      if (n > 0) {
        have.set(k, n - 1)
        status.push('dup')
      } else status.push('new')
    }
    return status
  }, [built, existing])

  const counts = plan ? { new: plan.filter((s) => s === 'new').length, dup: plan.filter((s) => s === 'dup').length, error: plan.filter((s) => s === 'error').length } : null
  const mappingOk = !!map && map.date >= 0 && (map.mode === 'amount' ? map.amount >= 0 : map.debit >= 0 || map.credit >= 0)

  async function runImport() {
    if (!file || !plan || !counts) return
    setBusy(true)
    try {
      const batch = `imp-${Date.now().toString(36)}`
      const rows = built.flatMap((b, i) => (plan[i] === 'new' && b.tx ? [{ ...b.tx, importBatch: batch }] : []))
      await db.transactions.bulkAdd(rows)
      const dates = rows.map((r) => r.date).sort()
      const rec: ImportRecord = { id: batch, at: new Date().toISOString(), file: file.name, added: rows.length, skipped: counts.dup, errors: counts.error }
      await setSetting(IMPORTS_KEY, [rec, ...(await getSetting<ImportRecord[]>(IMPORTS_KEY, []))].slice(0, 50))
      await logEvent({ area: 'finance', kind: 'finance.import', title: `Imported ${rows.length} transaction${rows.length === 1 ? '' : 's'} from ${file.name}` })
      setResult({ added: rows.length, skipped: counts.dup, errors: counts.error, uncategorized: rows.filter((r) => r.category === UNCATEGORIZED).length, from: dates[0], to: dates.at(-1), batch })
      setFile(null)
      setMap(null)
    } finally {
      setBusy(false)
    }
  }

  async function undo(id: string) {
    const n = await db.transactions.where('importBatch').equals(id).count()
    if (!window.confirm(`Remove the ${n} transaction${n === 1 ? '' : 's'} added by this import?`)) return
    await db.transactions.where('importBatch').equals(id).delete()
    await setSetting(IMPORTS_KEY, (await getSetting<ImportRecord[]>(IMPORTS_KEY, [])).filter((r) => r.id !== id))
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

      {!file && (
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
          <div style={{ fontSize: 16 }}>Drop a bank CSV here, or tap to choose a file</div>
          <div className="small faint" style={{ marginTop: 6, maxWidth: 460 }}>
            On your bank’s website, open an account’s transactions and look for Download or Export → CSV. The file is read on this device only — nothing is uploaded.
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv"
            hidden
            onChange={(e) => {
              load(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      )}
      {err && <div className="small warn">{err}</div>}

      {file && map && (
        <Card
          title={`${file.name} · ${file.rows.length} rows`}
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setFile(null)
              setMap(null)
            }}>
              Cancel
            </button>
          }
        >
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

          <hr className="divider" />
          <div className="small muted" style={{ marginBottom: 8 }}>
            Preview (first 10 rows). Spending should show as negative.
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
                        <td className={`small ${b.tx.category === UNCATEGORIZED ? 'faint' : ''}`}>{b.tx.category}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="small faint">
                        {b.error} · {file.rows[i].join(' | ').slice(0, 80)}
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
                  <strong style={{ color: 'var(--ink)' }}>{counts.new}</strong> new · {counts.dup} duplicate{counts.dup === 1 ? '' : 's'} · {counts.error} unreadable
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
