import { useState } from 'react'
import { db, type CalendarEvent, type ISODate } from '../../db'
import { Field, Modal } from '../../components/ui'

type Draft = Pick<CalendarEvent, 'title' | 'date' | 'allDay' | 'start' | 'end' | 'location' | 'notes'>

export function EventModal({ event, defaults, onClose }: { event: CalendarEvent | null; defaults: { date: ISODate; start?: string }; onClose: () => void }) {
  const [d, setD] = useState<Draft>(
    event ?? { title: '', date: defaults.date, allDay: !defaults.start, start: defaults.start, end: undefined, location: '', notes: '' },
  )
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))

  const save = async () => {
    const title = d.title.trim()
    if (!title) return
    const timed = !d.allDay && d.start
    const row = {
      title,
      date: d.date,
      allDay: !timed,
      start: timed ? d.start : undefined,
      end: timed && d.end ? d.end : undefined,
      location: d.location?.trim() || undefined,
      notes: d.notes?.trim() || undefined,
    }
    if (event?.id != null) await db.calendar.update(event.id, row)
    else await db.calendar.add(row)
    onClose()
  }

  return (
    <Modal title={event ? 'Edit event' : 'New event'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <Field label="Title">
          <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Dentist" autoFocus />
        </Field>
        <div className="grid grid-2">
          <Field label="Date">
            <input className="input" type="date" value={d.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
          </Field>
          <Field label="All day">
            <label className="row" style={{ minHeight: 36 }}>
              <input type="checkbox" className="check" checked={d.allDay} onChange={(e) => set({ allDay: e.target.checked, start: e.target.checked ? undefined : d.start ?? '09:00' })} />
              <span className="small muted">No set time</span>
            </label>
          </Field>
        </div>
        {!d.allDay && (
          <div className="grid grid-2">
            <Field label="Start">
              <input className="input" type="time" value={d.start ?? ''} onChange={(e) => set({ start: e.target.value || undefined })} />
            </Field>
            <Field label="End (optional)">
              <input className="input" type="time" value={d.end ?? ''} onChange={(e) => set({ end: e.target.value || undefined })} />
            </Field>
          </div>
        )}
        <Field label="Location">
          <input className="input" value={d.location ?? ''} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea className="textarea" value={d.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <div className="row-between">
          {event?.id != null ? (
            <button type="button" className="btn btn-sm btn-danger" onClick={() => void db.calendar.delete(event.id!).then(onClose)}>Delete</button>
          ) : (
            <span />
          )}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!d.title.trim()}>Save</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
