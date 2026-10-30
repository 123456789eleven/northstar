import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Interaction, type Person } from '../../db'
import { Field, Modal } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { CADENCES, KINDS, cadenceLabel, deleteInteraction, deletePerson, personStatus } from './people'

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'short' }))
const pad = (n: number) => String(n).padStart(2, '0')

export function XIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

export function PersonForm({ person, onClose, onSaved }: { person?: Person; onClose: () => void; onSaved?: (id: number) => void }) {
  const [name, setName] = useState(person?.name ?? '')
  const [relation, setRelation] = useState(person?.relation ?? '')
  const [cadence, setCadence] = useState(person?.cadenceDays ?? 30)
  const [bm, setBm] = useState(person?.birthday?.slice(0, 2) ?? '')
  const [bd, setBd] = useState(person?.birthday?.slice(3, 5) ?? '')
  const [notes, setNotes] = useState(person?.notes ?? '')
  const preset = CADENCES.some((c) => c.days === cadence)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const birthday = bm && bd ? `${bm}-${bd}` : undefined
    const data = { name: name.trim(), relation: relation.trim(), cadenceDays: Math.max(0, Math.round(cadence) || 0), birthday, notes: notes.trim() || undefined }
    let id = person?.id
    if (id != null) await db.people.update(id, data)
    else id = await db.people.add(data)
    onSaved?.(id!)
    onClose()
  }

  return (
    <Modal title={person ? `Edit ${person.name}` : 'Add a person'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="ppl-form-grid">
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={80} />
          </Field>
          <Field label="Relation">
            <input className="input" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Friend, sister, mentor…" maxLength={40} />
          </Field>
        </div>
        <Field label="Check in">
          <div className="ppl-seg" role="group">
            {CADENCES.map((c) => (
              <button type="button" key={c.days} className="btn btn-sm" aria-pressed={cadence === c.days} onClick={() => setCadence(c.days)}>{c.label}</button>
            ))}
          </div>
        </Field>
        <div className="row small muted">
          <span>Every</span>
          <input className="input mono" style={{ width: 72 }} type="number" min={0} max={730} value={cadence} onChange={(e) => setCadence(Number(e.target.value))} aria-label="Days between check-ins" />
          <span>days{!preset && cadence > 0 ? ' (custom)' : ''}{cadence === 0 ? ' — no reminder' : ''}</span>
        </div>
        <Field label="Birthday (optional)">
          <div className="ppl-bday-inputs">
            <select className="select" value={bm} onChange={(e) => setBm(e.target.value)} aria-label="Birthday month">
              <option value="">Month</option>
              {MONTHS.map((m, i) => <option key={m} value={pad(i + 1)}>{m}</option>)}
            </select>
            <select className="select" value={bd} onChange={(e) => setBd(e.target.value)} aria-label="Birthday day">
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={pad(i + 1)}>{i + 1}</option>)}
            </select>
          </div>
        </Field>
        <Field label="Notes">
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kids' names, what they're working on, gift ideas…" />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>{person ? 'Save' : 'Add person'}</button>
        </div>
      </form>
    </Modal>
  )
}

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<Interaction['kind'], string>

export function PersonDetail({ personId, onClose }: { personId: number; onClose: () => void }) {
  const person = useLiveQuery(() => db.people.get(personId), [personId])
  const history = useLiveQuery(() => db.interactions.where('personId').equals(personId).reverse().sortBy('date'), [personId])
  const [editing, setEditing] = useState(false)

  if (person === undefined) return null
  if (editing) return <PersonForm person={person} onClose={() => setEditing(false)} />

  const status = personStatus(person)
  const bday = person.birthday ? formatDate(`2000-${person.birthday}`, { month: 'long', day: 'numeric' }) : null

  async function remove() {
    if (!person) return
    if (!confirm(`Delete ${person.name} and all ${history?.length ?? 0} logged contacts? This cannot be undone.`)) return
    await deletePerson(person)
    onClose()
  }

  return (
    <Modal title={person.name} onClose={onClose}>
      <div className="small muted" style={{ marginTop: -10, marginBottom: 14 }}>
        {[person.relation, cadenceLabel(person.cadenceDays), bday && `Birthday ${bday}`].filter(Boolean).join(' · ')}
        <div className={status.overdue ? 'ppl-status is-due' : 'ppl-status'}>{status.text}</div>
      </div>
      {person.notes ? <p className="ppl-notes">{person.notes}</p> : <p className="ppl-notes faint">No notes yet.</p>}

      <div className="ppl-section">History</div>
      {history && history.length > 0 ? (
        <div>
          {history.map((h) => (
            <div className="ppl-hist" key={h.id}>
              <span className="ppl-hist-date">{formatDate(h.date, { month: 'short', day: 'numeric', year: '2-digit' })}</span>
              <span className="ppl-hist-kind">{KIND_LABEL[h.kind]}</span>
              <span className="grow">{h.note}</span>
              <button className="btn btn-ghost ppl-icon-btn" aria-label="Delete this contact" onClick={() => deleteInteraction(h)}><XIcon /></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="small faint">No contacts logged yet. Use “Logged contact” on the list.</p>
      )}

      <div className="row-between" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost btn-danger" onClick={remove}>Delete</button>
        <div className="row">
          <button className="btn" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  )
}
