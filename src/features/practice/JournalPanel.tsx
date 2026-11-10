// Trade journal: structured private entries, search and filters, and a review of how the paper trades went.
// Journal text never goes into event titles.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Empty, Field, Modal, Skeleton } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { db, logEvent, type TradeJournalEntry } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { getStartCash } from '../markets/paper'
import { signed, tone } from './fmt'
import { blankDraft, draftFromEntry, EMOTIONS, filterJournal, journalSymbols, journalTags, planStreak, rewardRisk, validateDraft, type JournalDraft } from './journal'
import { fills, tradeStats } from './ledger'

export type DraftSeed = { tradeId?: number; symbol?: string } | null

function EntryForm({ initial, id, onClose }: { initial: JournalDraft; id?: number; onClose: () => void }) {
  const toast = useToast()
  const [d, setD] = useState(initial)
  const [errs, setErrs] = useState<ReturnType<typeof validateDraft>['errors']>({})
  const [askDelete, setAskDelete] = useState(false)
  const set = <K extends keyof JournalDraft>(k: K, v: JournalDraft[K]) => setD((p) => ({ ...p, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const r = validateDraft(d)
    setErrs(r.errors)
    if (!r.entry) return
    if (id) await db.tradeJournal.put({ ...r.entry, id })
    else {
      const nid = (await db.tradeJournal.add(r.entry)) as number
      await logEvent({ area: 'finance', kind: 'markets.journal', title: 'Trade journal entry', refTable: 'tradeJournal', refId: nid })
    }
    toast({ message: 'Journal entry saved' })
    onClose()
  }

  async function del() {
    if (!id) return
    const row = await db.tradeJournal.get(id)
    const evs = await db.events.filter((e) => e.refTable === 'tradeJournal' && e.refId === id).toArray()
    await db.transaction('rw', db.tradeJournal, db.events, async () => {
      await db.tradeJournal.delete(id)
      await db.events.bulkDelete(evs.map((x) => x.id as number))
    })
    toast({ message: 'Journal entry deleted', undo: async () => { if (row) await db.transaction('rw', db.tradeJournal, db.events, async () => { await db.tradeJournal.put(row); await db.events.bulkAdd(evs) }) } })
    onClose()
  }

  const txt = (k: keyof JournalDraft, label: string, props: { area?: boolean; hint?: string; ph?: string; mode?: 'decimal' } = {}) => (
    <Field label={label} error={errs[k]} hint={props.hint}>
      {props.area
        ? <textarea className="textarea" rows={3} value={String(d[k] ?? '')} aria-invalid={!!errs[k]} onChange={(e) => set(k, e.target.value as never)} placeholder={props.ph} />
        : <input className="input" inputMode={props.mode} value={String(d[k] ?? '')} aria-invalid={!!errs[k]} onChange={(e) => set(k, e.target.value as never)} placeholder={props.ph} />}
    </Field>
  )

  return (
    <Modal title={id ? 'Edit journal entry' : 'New journal entry'} onClose={onClose} wide>
      <form className="pr-form" onSubmit={save} noValidate>
        <div className="pr-two">
          {txt('symbol', 'Symbol', { ph: 'Optional' })}
          <Field label="Date" error={errs.date}><input className="input" type="date" value={d.date} onChange={(e) => set('date', e.target.value)} /></Field>
        </div>
        {txt('thesis', 'Thesis', { area: true, ph: 'Why this trade, in a sentence or two' })}
        <div className="pr-two">
          {txt('setup', 'Setup', { ph: 'Breakout, pullback, earnings...' })}
          <Field label="Emotion going in">
            <input className="input" list="pr-emotions" value={d.emotion} onChange={(e) => set('emotion', e.target.value)} placeholder="Calm" />
            <datalist id="pr-emotions">{EMOTIONS.map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
        </div>
        <div className="pr-three">
          {txt('entry', 'Plan: entry', { mode: 'decimal' })}
          {txt('stop', 'Plan: stop', { mode: 'decimal' })}
          {txt('target', 'Plan: target', { mode: 'decimal' })}
        </div>
        {txt('tags', 'Tags', { hint: 'Comma separated' })}
        <h3 className="pr-sub">After the trade</h3>
        {txt('outcome', 'Outcome', { area: true })}
        {txt('lesson', 'Lesson', { area: true })}
        <Field label="Did you follow the plan?">
          <select className="select" value={d.followedPlan} onChange={(e) => set('followedPlan', e.target.value as JournalDraft['followedPlan'])}>
            <option value="">Not reviewed yet</option>
            <option value="yes">Followed the plan</option>
            <option value="no">Deviated from the plan</option>
          </select>
        </Field>
        <div className="row pr-actions">
          <button className="btn btn-primary" type="submit">Save entry</button>
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          {id && !askDelete && <button className="btn btn-ghost" type="button" onClick={() => setAskDelete(true)}>Delete</button>}
          {id && askDelete && <button className="btn btn-danger" type="button" onClick={del}>Delete this entry</button>}
        </div>
      </form>
    </Modal>
  )
}

export default function JournalPanel({ seed, clearSeed }: { seed: DraftSeed; clearSeed: () => void }) {
  const entries = useLiveQuery(() => db.tradeJournal.toArray(), [])
  const trades = useLiveQuery(() => db.paperTrades.toArray(), [])
  const startCash = useLiveQuery(getStartCash, [])
  const [text, setText] = useState('')
  const [symbol, setSymbol] = useState('')
  const [tag, setTag] = useState('')
  const [edit, setEdit] = useState<{ id?: number; draft: JournalDraft } | null>(null)
  const [shown, setShown] = useState(30)

  const stats = useMemo(() => (trades && startCash !== undefined ? tradeStats(fills(trades, startCash)) : null), [trades, startCash])
  const streak = useMemo(() => planStreak(entries ?? []), [entries])
  const list = useMemo(() => filterJournal(entries ?? [], { text, symbol, tag }), [entries, text, symbol, tag])

  if (!entries || !stats) return <Skeleton lines={5} label="Loading journal" />
  const open: { id?: number; draft: JournalDraft } | null = seed ? { draft: blankDraft(today(), seed.symbol ?? '', seed.tradeId) } : edit

  return (
    <div className="pr-stack">
      <Card title="Review" sub="From your paper trades that closed with a sale, and your journal.">
        {stats.count === 0 && streak.reviewedDays === 0 ? (
          <p className="muted">Nothing to review yet. Review appears after you sell a paper position and mark entries as followed or not.</p>
        ) : (
          <dl className="pr-review">
            <div><dt>Win rate</dt><dd>{stats.winRate === null ? 'None yet' : `${Math.round(stats.winRate * 100)}%`}<small>{stats.wins} won, {stats.losses} lost</small></dd></div>
            <div><dt>Average win</dt><dd className="good">{stats.avgWin === null ? 'None yet' : signed(stats.avgWin)}</dd></div>
            <div><dt>Average loss</dt><dd className={stats.avgLoss === null ? '' : 'warn'}>{stats.avgLoss === null ? 'None yet' : signed(stats.avgLoss)}</dd></div>
            <div><dt>Best</dt><dd>{stats.best ? <><span className={tone(stats.best.gain)}>{signed(stats.best.gain)}</span><small>{stats.best.symbol}, {formatDate(stats.best.date)}</small></> : 'None yet'}</dd></div>
            <div><dt>Worst</dt><dd>{stats.worst ? <><span className={tone(stats.worst.gain)}>{signed(stats.worst.gain)}</span><small>{stats.worst.symbol}, {formatDate(stats.worst.date)}</small></> : 'None yet'}</dd></div>
            <div><dt>Plan-followed days in a row</dt><dd>{streak.streak}<small>{streak.followedDays} of {streak.reviewedDays} reviewed days</small></dd></div>
          </dl>
        )}
      </Card>

      <Card title="Entries" sub={`${entries.length} saved. Private to this device.`} action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({ draft: blankDraft(today()) })}>New entry</button>}>
        {entries.length === 0 ? (
          <Empty title="Write the first entry">Record the thesis before you trade: why, the entry, the stop, the target. Add the outcome and lesson afterwards. You can also start from a trade in the Account tab.</Empty>
        ) : (
          <>
            <div className="pr-filters">
              <input className="input" type="search" aria-label="Search journal" placeholder="Search thesis, lesson, tags" value={text} onChange={(e) => { setText(e.target.value); setShown(30) }} />
              <select className="select" aria-label="Filter by symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                <option value="">All symbols</option>
                {journalSymbols(entries).map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className="select" aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">All tags</option>
                {journalTags(entries).map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            {list.length === 0 ? <p className="muted">No entries match.</p> : (
              <ul className="pr-entries">
                {list.slice(0, shown).map((e) => <EntryCard key={e.id} e={e} onOpen={() => setEdit({ id: e.id, draft: draftFromEntry(e) })} />)}
              </ul>
            )}
            {list.length > shown && <button className="btn btn-sm" onClick={() => setShown(shown + 30)}>Show more</button>}
          </>
        )}
      </Card>
      {open && <EntryForm key={open.id ?? 'new'} initial={open.draft} id={open.id} onClose={() => { setEdit(null); clearSeed() }} />}
    </div>
  )
}

function EntryCard({ e, onOpen }: { e: TradeJournalEntry; onOpen: () => void }) {
  const rr = rewardRisk(e.plan)
  return (
    <li>
      <button className="pr-entry" onClick={onOpen} aria-label={`Open entry ${e.symbol || 'general'} ${formatDate(e.date)}`}>
        <span className="pr-entry-head"><b>{e.symbol || 'General'}</b><span className="muted">{formatDate(e.date)}</span>
          {e.followedPlan !== undefined && <span className="pr-tag">{e.followedPlan ? 'Followed plan' : 'Deviated'}</span>}
        </span>
        <span className="pr-entry-body">{e.thesis}</span>
        {(e.plan || e.setup || e.emotion) && (
          <span className="pr-entry-meta">
            {e.setup && <span>{e.setup}</span>}
            {e.emotion && <span>{e.emotion}</span>}
            {e.plan?.entry && <span className="mono">in {money(e.plan.entry)}{e.plan.stop ? ` · stop ${money(e.plan.stop)}` : ''}{e.plan.target ? ` · target ${money(e.plan.target)}` : ''}</span>}
            {rr !== null && <span className="mono">{rr.toFixed(1)}R</span>}
          </span>
        )}
        {e.lesson && <span className="pr-entry-lesson">Lesson: {e.lesson}</span>}
        {!!e.tags?.length && <span className="pr-entry-meta">{e.tags.map((t) => <span key={t} className="pr-tag">{t}</span>)}</span>}
      </button>
    </li>
  )
}
