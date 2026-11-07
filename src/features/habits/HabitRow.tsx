// Habit surfaces: the weekly-ring card, the big "today" check row and the detail panel with the month heat map.
import { useRef, useState } from 'react'
import type { Habit, ISODate } from '../../db'
import { AREA_LABEL } from '../../components/ui'
import SidePanel from '../../components/SidePanel'
import { formatDate } from '../../lib/dates'
import { celebrate } from '../game/ui/feedback'
import { Ring } from '../game/ui/Ring'
import { WeekDots } from '../game/ui/Meters'
import type { StreakState } from '../game/types'
import { HeatStrip } from './HabitParts'
import { perWeekLabel, weekCountText } from './stats'
import { useHabitCheckIn } from './useHabitCheckIn'
import { monthGrid, weekRing, type WeekRing } from './week'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Check-in with a drawn check; celebrates (haptic/sound, both opt-in settings) only when it becomes checked. */
function useTick(habit: Habit) {
  const checkIn = useHabitCheckIn()
  const [pop, setPop] = useState(false)
  const timer = useRef(0)
  return {
    pop,
    tick: async (date: ISODate) => {
      const r = await checkIn(habit, date)
      if (r.checked) {
        celebrate('tick')
        setPop(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setPop(false), 600)
      }
    },
  }
}

function Check({ on, pop }: { on: boolean; pop: boolean }) {
  return (
    <svg className={`hcheck ${on ? 'is-on' : ''} ${pop ? 'is-pop' : ''}`} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
    </svg>
  )
}

const asStreak = (w: WeekRing): StreakState => ({ target: w.target, daysThisWeek: w.done, weekDots: w.days.map((d) => d.on), restTokens: 0, weeksInRow: 0 })

export function HabitCard({ habit, dates, today, goalTitle, onOpen }: { habit: Habit; dates: Set<ISODate>; today: ISODate; goalTitle?: string; onOpen: (h: Habit) => void }) {
  const { pop, tick } = useTick(habit)
  const w = weekRing(dates, today, habit.perWeek)
  const wt = weekCountText(Math.min(w.done, w.target), w.target)
  const doneToday = dates.has(today)
  return (
    <section data-focus-id={habit.id} data-testid="habit-card" className={`card habit ${habit.archived ? 'archived' : ''}`}>
      <div className="habit-top">
        <Ring value={w.pct} size={52} stroke={4} label={`${Math.min(w.done, w.target)} of ${w.target} this week`} className="habit-ring">
          <span className="habit-ring-n mono" data-testid="habit-ring-count">{Math.min(w.done, w.target)}</span>
        </Ring>
        <button type="button" className="habit-open" onClick={() => onOpen(habit)}>
          <span className="habit-name">{habit.name}</span>
          <span className="habit-meta">
            <span>{AREA_LABEL[habit.area]}</span>
            <span>{perWeekLabel(habit.perWeek)}</span>
            {goalTitle && <span>{goalTitle}</span>}
          </span>
        </button>
        {!habit.archived && (
          <button type="button" className={`habit-check ${doneToday ? 'is-on' : ''}`} aria-pressed={doneToday} aria-label={`${habit.name}: check in today`} onClick={() => void tick(today)}>
            <Check on={doneToday} pop={pop} />
          </button>
        )}
      </div>
      <div className="habit-weekline">
        <WeekDots streak={asStreak(w)} />
        <div className="habit-streak">
          <strong className={wt.met ? 'is-met' : ''}>{wt.main}</strong>
          <span>{wt.caption}</span>
        </div>
      </div>
    </section>
  )
}

/** One big tap target for a habit due today. */
function TodayItem({ habit, dates, today }: { habit: Habit; dates: Set<ISODate>; today: ISODate }) {
  const { pop, tick } = useTick(habit)
  const w = weekRing(dates, today, habit.perWeek)
  const on = dates.has(today)
  return (
    <button type="button" className={`today-habit ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => void tick(today)} data-testid="today-habit">
      <span className="today-habit-box"><Check on={on} pop={pop} /></span>
      <span className="today-habit-name">{habit.name}</span>
      <span className="today-habit-week">{Math.min(w.done, w.target)}/{w.target}</span>
    </button>
  )
}

export function TodayRow({ habits, byHabit, today }: { habits: Habit[]; byHabit: Map<number, Set<ISODate>>; today: ISODate }) {
  if (!habits.length) return null
  return (
    <section className="today-row" aria-label="Habits due today">
      <h2 className="quest-h">Due today</h2>
      <div className="today-habits">
        {habits.map((h) => <TodayItem key={h.id} habit={h} dates={byHabit.get(h.id!) ?? new Set()} today={today} />)}
      </div>
    </section>
  )
}

/** Month heat map. Past days and today are tappable so a missed check-in can be filled in. */
function MonthHeat({ habit, dates, today }: { habit: Habit; dates: Set<ISODate>; today: ISODate }) {
  const { tick } = useTick(habit)
  const grid = monthGrid(dates, today)
  return (
    <div className="mheat" role="group" aria-label={`${formatDate(today, { month: 'long', year: 'numeric' })} check-ins`}>
      <div className="mheat-dow" aria-hidden>{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
      {grid.map((row) => (
        <div className="mheat-row" key={row[0].date}>
          {row.map((c) =>
            c.inMonth ? (
              <button
                key={c.date}
                type="button"
                className={`mheat-cell ${c.done ? 'on' : ''} ${c.date === today ? 'today' : ''}`}
                disabled={c.future || habit.archived}
                aria-pressed={c.done}
                aria-label={`${habit.name}, ${formatDate(c.date, { weekday: 'long', month: 'short', day: 'numeric' })}${c.done ? ', done' : ''}`}
                onClick={() => void tick(c.date)}
              >
                <span aria-hidden>{Number(c.date.slice(8))}</span>
              </button>
            ) : (
              <span key={c.date} className="mheat-cell is-out" aria-hidden />
            ),
          )}
        </div>
      ))}
    </div>
  )
}

export function HabitDetail({ habit, dates, today, goalTitle, onClose, onEdit }: { habit: Habit; dates: Set<ISODate>; today: ISODate; goalTitle?: string; onClose: () => void; onEdit: (h: Habit) => void }) {
  const w = weekRing(dates, today, habit.perWeek)
  const wt = weekCountText(Math.min(w.done, w.target), w.target)
  return (
    <SidePanel title={habit.name} onClose={onClose}>
      <div className="stack">
        <div className="habit-detail-head">
          <Ring value={w.pct} size={52} stroke={4} label={`${Math.min(w.done, w.target)} of ${w.target} this week`}>
            <span className="habit-ring-n mono">{Math.min(w.done, w.target)}</span>
          </Ring>
          <div className="habit-streak is-left">
            <strong className={wt.met ? 'is-met' : ''}>{wt.main}</strong>
            <span>{wt.caption}</span>
            <span>{AREA_LABEL[habit.area]} · {perWeekLabel(habit.perWeek)}{goalTitle ? ` · ${goalTitle}` : ''}</span>
          </div>
        </div>
        <div>
          <div className="quest-h">{formatDate(today, { month: 'long', year: 'numeric' })}</div>
          <MonthHeat habit={habit} dates={dates} today={today} />
        </div>
        <div>
          <div className="quest-h">Last 12 weeks</div>
          <HeatStrip dates={dates} today={today} />
        </div>
        <div className="row">
          <button className="btn" onClick={() => onEdit(habit)}>Edit or archive</button>
        </div>
      </div>
    </SidePanel>
  )
}
