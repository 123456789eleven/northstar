// "Add many" sheet: pick a kind, paste one item per line (or a block copied from Excel/Sheets), check the preview, add all.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Tabs } from '../../components/ui'
import { useFocusTrap } from '../../components/useFocusTrap'
import { useToast } from '../../components/toastContext'
import { addBulk, loadBulkContext } from './bulkData'
import { BULK_KINDS, okItems, parseBulk, removeLine, type BulkContext, type BulkKind } from './parse'
import { TEMPLATE_KINDS, downloadTemplate } from './templates'
import './bulk.css'

const HELP: Record<BulkKind, { hint: string; placeholder: string }> = {
  tasks: {
    hint: 'One task per line. Same shortcuts as the capture bar: tomorrow, fri, !1, every week, #goal.',
    placeholder: 'call dentist tomorrow !1\nrenew passport by 11/15\nwater plants every week',
  },
  people: {
    hint: 'Name, relationship, every N days, birthday (MM-DD). Only the name is required.',
    placeholder: 'Alex Rivera, Friend, every 30 days, 03-14\nMom, Family, every 7 days, 09-02\nJordan',
  },
  goals: {
    hint: 'Title, area, by date. Areas: career, health, finance, learning, relationships, personal.',
    placeholder: 'Run a half marathon, health, by Dec 31\nFinish the leadership course, career, by 2027-03-01',
  },
  habits: {
    hint: 'Name, then optionally an area and how often: "Run, health, 3x week". Default is daily.',
    placeholder: 'Meditate\nRun, health, 3x week\nRead 20 pages, learning',
  },
  meals: {
    hint: 'What you ate, with calories and slot if you like. Same as the capture bar: "oatmeal 350cal for breakfast".',
    placeholder: 'oatmeal 350cal for breakfast\nchicken salad 520cal for lunch\npizza yesterday for dinner',
  },
  transactions: {
    hint: 'Description and amount. Unsigned is money out, +500 is money in. Add a date if it was not today.',
    placeholder: 'Kroger 42.50\n$12.50 chipotle\nPaycheck +1200\n2026-10-01, Rent, 1450',
  },
  balances: {
    hint: 'Name, asset or liability, amount, date (optional, default today). Dates: 2026-09-30 or 09/30/2026.',
    placeholder: 'Marcus Savings (HYSA), asset, 14490.94, 2026-09-30\nVisa Card, liability, 1250.00\nCar loan, debt, $8,400',
  },
}

const STATUS_LABEL = { ok: 'Ready', duplicate: 'Duplicate', error: 'Error' } as const

export default function BulkAdd({ initialKind = 'tasks', onClose }: { initialKind?: BulkKind; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const toast = useToast()
  useFocusTrap(ref, onClose)
  const [kind, setKind] = useState<BulkKind>(initialKind)
  const [texts, setTexts] = useState<Partial<Record<BulkKind, string>>>({})
  const [ctx, setCtx] = useState<{ kind: BulkKind; data: Pick<BulkContext, 'goals' | 'rules' | 'existing'> } | null>(null)
  const [busy, setBusy] = useState(false)
  const text = texts[kind] ?? ''

  useEffect(() => {
    let live = true
    loadBulkContext(kind).then((data) => live && setCtx({ kind, data }))
    return () => { live = false }
  }, [kind])

  const result = useMemo(() => {
    if (!text.trim()) return null
    return parseBulk(kind, text, { ...(ctx?.kind === kind ? ctx.data : {}) })
  }, [kind, text, ctx])

  const ready = result ? okItems(result) : []
  const dupes = result?.rows.filter((r) => r.status === 'duplicate').length ?? 0
  const errors = result?.rows.filter((r) => r.status === 'error').length ?? 0
  const noun = BULK_KINDS.find((k) => k.value === kind)!.noun
  const label = (n: number) => (kind === 'people' ? (n === 1 ? '1 person' : `${n} people`) : `${n} ${noun}${n === 1 ? '' : 's'}`)

  async function add() {
    if (!ready.length || busy || ctx?.kind !== kind) return
    setBusy(true)
    try {
      const added = await addBulk(kind, ready)
      toast({ message: `Added ${label(added.count)}`, undo: added.undo })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal bulk" role="dialog" aria-modal="true" aria-label="Add many" tabIndex={-1}>
        <div className="bulk-head">
          <h2>Add many</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close Add many">Close</button>
        </div>
        <Tabs value={kind} onChange={setKind} options={BULK_KINDS.map((k) => ({ value: k.value, label: k.label }))} />

        <p className="bulk-hint">{HELP[kind].hint}</p>
        <textarea
          className="input bulk-text"
          value={text}
          rows={6}
          autoFocus
          spellCheck={false}
          aria-label={`Paste ${noun}s, one per line`}
          placeholder={HELP[kind].placeholder}
          onChange={(e) => setTexts((t) => ({ ...t, [kind]: e.target.value }))}
        />
        <div className="bulk-tools">
          <span className="bulk-note">
            {result?.mode === 'sheet'
              ? result.headers
                ? `Spreadsheet paste. Columns found: ${result.headers.join(', ')}.`
                : 'Spreadsheet paste, read as lines.'
              : 'Or paste rows copied from Excel or Sheets; a header row is picked up automatically.'}
          </span>
          {TEMPLATE_KINDS.includes(kind) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadTemplate(kind)}>
              Download template (.csv)
            </button>
          )}
        </div>

        {result && result.rows.length > 0 && (
          <ul className="bulk-rows" aria-label="Preview">
            {result.rows.map((r) => (
              <li key={r.line} className={`bulk-row is-${r.status}`}>
                <div className="bulk-main">
                  <div className="bulk-title">{r.title}</div>
                  {r.status === 'ok' || r.status === 'duplicate' ? (
                    <div className="bulk-chips">
                      {r.chips.map((c, i) => <span key={i} className="chip">{c}</span>)}
                    </div>
                  ) : null}
                  {r.reason && <div className="bulk-reason">{r.reason}</div>}
                </div>
                <span className={`bulk-status s-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                <button
                  type="button"
                  className="icon-btn bulk-x"
                  aria-label={`Remove line ${r.line + 1}`}
                  onClick={() => setTexts((t) => ({ ...t, [kind]: removeLine(text, r.line) }))}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="bulk-foot">
          <span className="bulk-count" role="status" aria-live="polite">
            {result && result.rows.length
              ? [`${ready.length} ready`, dupes ? `${dupes} duplicate${dupes === 1 ? '' : 's'} skipped` : '', errors ? `${errors} error${errors === 1 ? '' : 's'} skipped` : ''].filter(Boolean).join(', ')
              : 'Nothing to add yet'}
          </span>
          <button className="btn btn-primary" disabled={!ready.length || busy || ctx?.kind !== kind} onClick={() => void add()}>
            {ready.length ? `Add ${label(ready.length)}` : 'Add'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
