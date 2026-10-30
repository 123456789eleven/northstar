import { useState } from 'react'
import { db, AREAS, type Area, type Goal, type Habit, type ISODate } from '../../db'
import { Field, Modal, AREA_LABEL } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { archiveHabit, deleteHabit, toggleCheckIn } from './habitData'
import { PER_WEEK_PRESETS, heatGrid, lastDays, perWeekLabel, streak, weekProgress } from './stats'

export function HeatStrip({ dates, today }: { dates: Set<ISODate>; today: ISODate }) {
  const grid = heatGrid(dates, today, 12)
  const gap = 3
  const cw = 36
  const ch = 11
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
                <rect key={c.date} x={x * (cw + gap)} y={top + y * (ch + gap)} width={cw} height={ch} rx={2} opacity={c.done ? 1 : 0.1}>
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

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function HabitCard({ habit, dates, today, goalTitle, onEdit }: { habit: Habit; dates: Set<ISODate>; today: ISODate; goalTitle?: string; onEdit: (h: Habit) => void }) {
  const s = streak(dates, today, habit.perWeek)
  const wp = weekProgress(dates, today, habit.perWeek)
  return (
    <section className={`card habit ${habit.archived ? 'archived' : ''}`}>
      <div className="habit-head">
        <div className="grow">
          <div className="habit-name">{habit.name}</div>
          <div className="habit-meta">
            <span>{AREA_LABEL[habit.area]}</span>
            <span>{perWeekLabel(habit.perWeek)}</span>
            {goalTitle && <span>{goalTitle}</span>}
          </div>
        </div>
        <div className="habit-streak">
          <strong>{wp.done} of {wp.target}</strong>
          <span>this week{s.count >= 1 ? ` · ${s.count} ${s.unit}${s.count === 1 ? '' : 's'} streak` : ' · no streak yet'}</span>
        </div>
      </div>
      <div className="habit-days">
        {lastDays(today).map((d) => {
          const on = dates.has(d)
          const dow = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))).getDay()
          return (
            <button
              key={d}
              type="button"
              className={`habit-day ${on ? 'on' : ''} ${d === today ? 'today' : ''}`}
              aria-pressed={on}
              aria-label={`${habit.name}, ${formatDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}${on ? ', done' : ''}`}
              onClick={() => void toggleCheckIn(habit, d)}
            >
              {DOW[dow]}
              <b>{Number(d.slice(8))}</b>
            </button>
          )
        })}
      </div>
      <HeatStrip dates={dates} today={today} />
      <div className="habit-foot">
        <span className="habit-week">Last 12 weeks</span>
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(habit)}>Edit</button>
      </div>
    </section>
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
