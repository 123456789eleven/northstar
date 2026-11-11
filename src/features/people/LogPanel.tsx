// Logging a contact: the remembered-kind quick log (with Undo toast) and the detailed panel (note, date, kind).
import { useState } from 'react'
import type { Interaction, Person } from '../../db'
import { useToast } from '../../components/toastContext'
import { today } from '../../lib/dates'
import { KINDS, logContact, undoContact } from './people'
import { reconnectLine } from './starter'

const KIND_KEY = 'northstar.people.lastKind'
const lastKind = (): Interaction['kind'] => {
  try {
    const v = localStorage.getItem(KIND_KEY)
    return KINDS.some((k) => k.value === v) ? (v as Interaction['kind']) : 'text'
  } catch {
    return 'text'
  }
}
const rememberKind = (k: Interaction['kind']) => {
  try { localStorage.setItem(KIND_KEY, k) } catch { /* ignore */ }
}

/** Log a contact of a given kind (default: the last used) with one toast. A 60+ day gap swaps in the reconnect line. */
export function useLogKind() {
  const toast = useToast()
  return async (p: Person, kind: Interaction['kind'] = lastKind(), note?: string, date = today()) => {
    const label = KINDS.find((k) => k.value === kind)?.label.toLowerCase() ?? kind
    const gap = await logContact(p, kind, note, date)
    toast({ message: gap ? reconnectLine(p, gap) : `Logged ${label} with ${p.name}. Warmer already.`, undo: () => undoContact(p.id!, kind, date) })
  }
}

/** Returns a function that logs a contact today with the last-used kind and offers Undo. */
export function useQuickLog() {
  const log = useLogKind()
  return (p: Person) => log(p)
}

export function LogPanel({ person, onDone }: { person: Person; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const log = useLogKind()
  const go = async (kind: Interaction['kind']) => {
    rememberKind(kind)
    await log(person, kind, note, date)
    onDone()
  }
  return (
    <div className="ppl-log">
      <div className="ppl-log-extra">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you talk about? (optional)" aria-label="Note" />
        <input className="input ppl-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} aria-label="Date of contact" />
      </div>
      <div className="ppl-log-kinds">
        {KINDS.map((k) => <button key={k.value} className="btn" onClick={() => go(k.value)}>{k.label}</button>)}
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}
