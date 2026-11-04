import { useState } from 'react'
import { db, AREAS, type Area, type Goal, type Habit, type ISODate } from '../../db'
import { Field, Modal, AREA_LABEL } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { archiveHabit, deleteHabit } from './habitData'
import { PER_WEEK_PRESETS, heatGrid } from './stats'

export function HeatStrip({ dates, today }: { dates: Set<ISODate>; today: ISODate }) {
  const grid = heatGrid(dates, today, 12)
  const gap = 3
  const cw = 36
  const ch = 9
  const top = 14
  const w = 12 * (cw + gap) - gap
  const h = top + 7 * (ch + gap) - gap
  return (
    <svg className="heat" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Check-ins over the last 12 weeks">
      {grid.map((col, x) => {
        const m = col[0].date.slice(5, 7)
        const label = x === 0 || grid[x - 1][0].date.slice(5, 7) !== m ? formatDate(col[0].date, { month: 'short' }) : null
        return (
          <g key={col[0].date}>
            {label && <text className="heat-month" x={x * (cw + gap)} y={10}>{label}</text>}
            {col.map((c, y) =>
              c.future ? null : (
                <rect key={c.date} className={c.done ? 'on' : ''} x={x * (cw + gap)} y={top + y * (ch + gap)} width={cw} height={ch} rx={2}>
                  <title>{`${formatDate(c.date)}${c.done ? ': done' : ''}`}</title>
                </rect>
              ),
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function HabitModal({ habit, goals, onClose }: { habit: Habit | null; goals: Goal[]; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? '')
  const [area, setArea] = useState<Area>(habit?.area ?? 'health')
  const [perWeek, setPerWeek] = useState(habit?.perWeek ?? 7)
  const [goalId, setGoalId] = useState<number | ''>(habit?.goalId ?? '')
  const [confirmDel, setConfirmDel] = useState(false)

  const save = async () => {
    const n = name.trim()
    if (!n) return
    const patch = { name: n, area, perWeek, goalId: goalId === '' ? undefined : goalId }
    if (habit?.id != null) await db.habits.update(habit.id, patch)
    else await db.habits.add({ ...patch, createdAt: new Date().toISOString() })
    onClose()
  }

  return (
    <Modal title={habit ? 'Edit habit' : 'New habit'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk 20 minutes" autoFocus />
        </Field>
        <Field label="How often">
          <div className="seg">
            {PER_WEEK_PRESETS.map((p) => (
              <button key={p.value} type="button" aria-pressed={perWeek === p.value} onClick={() => setPerWeek(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-2">
          <Field label="Area">
            <select className="select" value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {AREAS.map((a) => (
                <option key={a} value={a}>{AREA_LABEL[a]}</option>
              ))}
            </select>
          </Field>
          <Field label="Supports goal">
            <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">None</option>
              {goals.filter((g) => g.status !== 'done').map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="row-between">
          <div className="row">
            {habit && (
              <>
                <button type="button" className="btn btn-sm" onClick={() => void archiveHabit(habit, !habit.archived).then(onClose)}>
                  {habit.archived ? 'Restore' : 'Archive'}
                </button>
                {confirmDel ? (
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => void deleteHabit(habit).then(onClose)}>
                    Delete with history
                  </button>
                ) : (
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDel(true)}>
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Save</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
