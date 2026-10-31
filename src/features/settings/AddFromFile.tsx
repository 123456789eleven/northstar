// "Add from a data file": additive import of transactions, balances and budgets. Never replaces anything.
import { useRef, useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { applyAdditiveImport, describeAdded, planAdditiveImport, undoAdditiveImport, type AdditivePlan, type TablePlan } from '../../lib/additiveImport'
import { parseBackup } from '../../lib/backup'
import { money } from '../../lib/dates'

function Block<T>({ title, plan, row, extra }: { title: string; plan: TablePlan<T>; row: (r: T) => string; extra?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="set-counts">
        <div><span className="muted">{title}: will add</span><span className="mono">{plan.add.length.toLocaleString()}</span></div>
        <div><span className="muted">Already present</span><span className="mono">{plan.present.toLocaleString()}</span></div>
        <div><span className="muted">Skipped as invalid</span><span className="mono">{plan.invalid.length.toLocaleString()}</span></div>
      </div>
      {extra && <p className="set-text small">{extra}</p>}
      {plan.add.slice(0, 5).map((r, i) => <div key={i} className="small muted">{row(r)}</div>)}
      {plan.add.length > 5 && <div className="small faint">and {(plan.add.length - 5).toLocaleString()} more</div>}
      {plan.invalid.length > 0 && <div className="small faint">Example problem: row {plan.invalid[0].index + 1}, {plan.invalid[0].reason}</div>}
    </div>
  )
}

export default function AddFromFile({ disabled, onError }: { disabled?: boolean; onError: (m: string) => void }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<AdditivePlan | null>(null)
  const [source, setSource] = useState<Awaited<ReturnType<typeof parseBackup>>['data'] | null>(null)
  const [busy, setBusy] = useState(false)

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    onError('')
    try {
      const parsed = await parseBackup(f)
      setSource(parsed.data)
      setPlan(await planAdditiveImport(parsed.data))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  async function onAdd() {
    if (!source) return
    setBusy(true)
    try {
      const res = await applyAdditiveImport({ source })
      const none = res.added.transactions + res.added.balances + res.added.budgets === 0
      toast(none
        ? { message: 'Nothing new to add. Everything in that file is already here.' }
        : { message: `${describeAdded(res.added)}.`, undo: () => undoAdditiveImport(res.undo) })
    } catch (e) {
      onError(e instanceof Error ? `Nothing was added: ${e.message}` : 'Nothing was added.')
    } finally {
      setBusy(false)
      setPlan(null)
      setSource(null)
    }
  }

  const close = () => { if (!busy) { setPlan(null); setSource(null) } }
  const nothing = plan ? plan.transactions.add.length + plan.balances.add.length + plan.budgets.add.length === 0 : true

  return (
    <>
      <button className="btn" onClick={() => fileRef.current?.click()} disabled={disabled || busy}>Add from a data file…</button>
      <input ref={fileRef} className="set-file" type="file" accept="application/json,.json" onChange={onPick} tabIndex={-1} aria-hidden />
      {plan && (
        <Modal title="Add from this file?" onClose={close}>
          <p className="set-text">Nothing you already have is replaced. You can undo right after adding.</p>
          <Block title="Transactions" plan={plan.transactions} row={(t) => `${t.date}  ${t.description}  ${money(t.amount)}`} />
          <Block title="Balances" plan={plan.balances} row={(b) => `${b.date}  ${b.name} (${b.kind})  ${money(b.balance)}`} />
          <Block
            title="Budgets"
            plan={plan.budgets}
            row={(b) => `${b.category}  ${money(b.monthlyLimit)} a month`}
            extra={plan.budgets.kept.length ? `${plan.budgets.kept.length} budget${plan.budgets.kept.length === 1 ? '' : 's'} kept your existing limit: ${plan.budgets.kept.slice(0, 5).map((k) => k.category).join(', ')}.` : undefined}
          />
          {plan.skipped.length > 0 && <p className="set-text small">Not used (never read): {plan.skipped.join(', ')}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={close} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={onAdd} disabled={busy || nothing}>{busy ? 'Adding…' : nothing ? 'Nothing to add' : 'Add'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}
