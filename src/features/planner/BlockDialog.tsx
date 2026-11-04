// "Block time" dialog (desktop modal) / "Add block" sheet (phone): pick a task or Training, a start time and a duration.
// The same form edits an existing block (tap a block on phone, click it on desktop).
import { useState } from 'react'
import type { CalendarEvent, ISODate, Task } from '../../db'
import BottomSheet from '../../components/BottomSheet'
import { Field, Modal } from '../../components/ui'
import { toMin } from './layout'
import { blockMeta, hhmm, makeSpan, type BlockKind } from './timeBlock'
import type { useBlocks } from './useBlocks'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180]

export interface BlockDefaults { date: ISODate; start?: string; taskId?: number }

export function BlockDialog({ block, defaults, tasks, phone, api, onClose }: {
  block: CalendarEvent | null
  defaults: BlockDefaults
  tasks: Task[]
  phone: boolean
  api: ReturnType<typeof useBlocks>
  onClose: () => void
}) {
  const meta = block ? blockMeta(block) : null
  const open = tasks.filter((t) => t.status === 'open')
  const [kind, setKind] = useState<BlockKind>(meta?.kind ?? (defaults.taskId || open.length ? 'task' : 'training'))
  const [taskId, setTaskId] = useState<number | ''>(meta?.taskId ?? defaults.taskId ?? open[0]?.id ?? '')
  const [title, setTitle] = useState(meta?.kind === 'training' ? block!.title : 'Training')
  const [date, setDate] = useState<ISODate>(block?.date ?? defaults.date)
  const [start, setStart] = useState(block?.start ?? defaults.start ?? '09:00')
  const [len, setLen] = useState(block?.start && block.end ? Math.max(15, toMin(block.end) - toMin(block.start)) : 45)
  const lens = DURATIONS.includes(len) ? DURATIONS : [...DURATIONS, len].sort((a, b) => a - b)
  const chosen = open.find((t) => t.id === taskId) ?? tasks.find((t) => t.id === taskId)
  const canSave = kind === 'training' ? !!title.trim() : !!chosen

  const save = async () => {
    if (!canSave) return
    const span = makeSpan(date, toMin(start), len)
    if (block) await api.edit(block, { title: kind === 'training' ? title.trim() : chosen?.title, span })
    else await api.create({ kind, task: chosen, title, span })
    onClose()
  }

  const heading = block ? 'Edit block' : phone ? 'Add block' : 'Block time'
  const form = (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <div className="pl-toggle" role="group" aria-label="Block kind">
        {(['task', 'training'] as BlockKind[]).map((k) => (
          <button key={k} type="button" className="btn btn-sm" aria-pressed={kind === k} onClick={() => setKind(k)} disabled={!!block && meta?.kind !== k}>
            {k === 'task' ? 'Task' : 'Training'}
          </button>
        ))}
      </div>
      {kind === 'task' ? (
        <Field label="Task" hint={open.length === 0 && !chosen ? 'No open tasks. Add one on Tasks first.' : undefined}>
          <select className="input" value={taskId} onChange={(e) => setTaskId(Number(e.target.value))} disabled={open.length === 0 && !chosen}>
            {!open.some((t) => t.id === taskId) && chosen && <option value={chosen.id}>{chosen.title}</option>}
            {open.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
      ) : (
        <Field label="Title" hint="Protected time shows in the Body skill color.">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      )}
      <div className="grid grid-2">
        <Field label="Date">
          <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="Start">
          <input className="input" type="time" step={900} value={start} onChange={(e) => e.target.value && setStart(hhmm(toMin(e.target.value)))} />
        </Field>
      </div>
      <Field label="Duration">
        <select className="input" value={len} onChange={(e) => setLen(Number(e.target.value))}>
          {lens.map((n) => <option key={n} value={n}>{n >= 60 && n % 60 === 0 ? `${n / 60} hr` : `${n} min`}</option>)}
        </select>
      </Field>
      <div className="row-between">
        {block ? <button type="button" className="btn btn-sm btn-danger" onClick={() => void api.remove(block).then(onClose)}>Delete</button> : <span />}
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!canSave}>{block ? 'Save' : 'Add block'}</button>
        </div>
      </div>
    </form>
  )
  return phone ? <BottomSheet title={heading} onClose={onClose}>{form}</BottomSheet> : <Modal title={heading} onClose={onClose}>{form}</Modal>
}
