// Logging a contact: the remembered-kind quick log (with Undo toast) and the detailed panel (note, date, kind).
import { useState } from 'react'
import type { Interaction, Person } from '../../db'
import { useToast } from '../../components/toastContext'
import { today } from '../../lib/dates'
import { KINDS, logContact, undoContact } from './people'

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

/** Returns a function that logs a contact today with the last-used kind and offers Undo. */
export function useQuickLog() {
  const toast = useToast()
  return async (p: Person) => {
    const kind = lastKind()
    const label = KINDS.find((k) => k.value === kind)?.label.toLowerCase() ?? kind
    await logContact(p, kind)
    toast({ message: `Logged ${label} with ${p.name}`, undo: () => undoContact(p.id!, kind, today()) })
  }
}

export function LogPanel({ person, onDone }: { person: Person; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const log = async (kind: Interaction['kind']) => {
    rememberKind(kind)
    await logContact(person, kind, note, date)
    onDone()
  }
  return (
    <div className="ppl-log">
      <div className="ppl-log-extra">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
        <input className="input ppl-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} aria-label="Date of contact" />
      </div>
      <div className="ppl-log-kinds">
        {KINDS.map((k) => <button key={k.value} className="btn" onClick={() => log(k.value)}>{k.label}</button>)}
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}
