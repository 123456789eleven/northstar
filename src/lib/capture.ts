// Quick-capture parser. Pure: no DB access, no Date.now() unless `now` is omitted.
// One line of text -> a description of what to create. Saving lives in features/tasks/captureSave.ts.
import { AREAS, type Area, type ISODate, type MealSlot, type Task } from '../db'
import { addDays, parseISODate, toISODate } from './dates'

export interface CaptureGoal {
  id: number
  title: string
  area: Area
  horizon?: 'life' | 'year' | 'quarter'
}

export interface CaptureContext {
  now?: Date
  /** Active goals, used to resolve #tags into goalId. */
  goals?: CaptureGoal[]
}

export type TaskCapture = {
  kind: 'task'
  title: string
  due?: ISODate
  priority: Task['priority']
  recurrence: Task['recurrence']
  goalId?: number
  goalTitle?: string
}

export type Capture =
  | TaskCapture
  | { kind: 'transaction'; amount: number; description: string; date: ISODate }
  | { kind: 'meal'; name: string; calories?: number; slot: MealSlot; date: ISODate }
  | { kind: 'win'; title: string; area: Area }
  | { kind: 'empty' }

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

const clean = (w: string) => w.toLowerCase().replace(/[.,;:!?]+$/, '')

/** Add whole months, clamping to the last day of the target month. */
export function addMonths(s: ISODate, n: number): ISODate {
  const d = parseISODate(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISODate(d)
}

/** Next date strictly after `from` that falls on weekday `dow` (0 = Sunday). */
export function nextWeekday(from: ISODate, dow: number): ISODate {
  const cur = parseISODate(from).getDay()
  const diff = ((dow - cur + 7) % 7) || 7
  return addDays(from, diff)
}

export function advance(s: ISODate, rec: Task['recurrence']): ISODate {
  if (rec === 'daily') return addDays(s, 1)
  if (rec === 'weekly') return addDays(s, 7)
  if (rec === 'monthly') return addMonths(s, 1)
  return s
}

/** Next due date for a recurring task: step from its due date until it lands after today. */
export function nextRecurrence(due: ISODate | undefined, rec: Task['recurrence'], todayISO: ISODate): ISODate | undefined {
  if (rec === 'none') return undefined
  let next = advance(due ?? todayISO, rec)
  for (let i = 0; next <= todayISO && i < 1000; i++) next = advance(next, rec)
  return next
}

export function slotForTime(now: Date): MealSlot {
  const h = now.getHours() + now.getMinutes() / 60
  if (h >= 4 && h < 10.5) return 'breakfast'
  if (h >= 10.5 && h < 15) return 'lunch'
  if (h >= 17 && h < 22) return 'dinner'
  return 'snack'
}

const norm = (s: string) => s.toLowerCase().replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim()

/** Resolve a #tag to a goal: title fragment first, then area (preferring quarter > year > life). */
export function matchGoal(tag: string, goals: CaptureGoal[]): CaptureGoal | undefined {
  const t = norm(tag)
  if (!t) return undefined
  const byTitle = goals.find((g) => norm(g.title).includes(t))
  if (byTitle) return byTitle
  if ((AREAS as string[]).includes(t)) {
    const rank = { quarter: 0, year: 1, life: 2 }
    return goals
      .filter((g) => g.area === t)
      .sort((a, b) => rank[a.horizon ?? 'life'] - rank[b.horizon ?? 'life'])[0]
  }
  return undefined
}

function parseDue(words: string[], i: number, todayISO: ISODate): { due: ISODate; used: number } | undefined {
  const w = clean(words[i])
  const w2 = words[i + 1] ? clean(words[i + 1]) : ''
  const w3 = words[i + 2] ? clean(words[i + 2]) : ''
  if (w === 'today' || w === 'tonight' || w === 'tod') return { due: todayISO, used: 1 }
  if (w === 'tomorrow' || w === 'tmr' || w === 'tmrw' || w === 'tom') return { due: addDays(todayISO, 1), used: 1 }
  if (w in WEEKDAYS) return { due: nextWeekday(todayISO, WEEKDAYS[w]), used: 1 }
  if (w === 'next' && w2 === 'week') return { due: nextWeekday(todayISO, 1), used: 2 }
  if (w === 'next' && w2 === 'month') return { due: addMonths(todayISO, 1).slice(0, 8) + '01', used: 2 }
  if (w === 'next' && w2 in WEEKDAYS) return { due: nextWeekday(todayISO, WEEKDAYS[w2]), used: 2 }
  if (w === 'in') {
    // "in 3d", "in 2w", "in 3 days", "in 2 weeks", "in 1 month"
    let n = 0
    let unit = ''
    let used = 2
    const short = /^(\d+)(d|w|m)$/.exec(w2)
    if (short) {
      n = Number(short[1])
      unit = short[2]
    } else if (/^\d+$/.test(w2)) {
      unit = /^days?$/.test(w3) ? 'd' : /^weeks?$/.test(w3) ? 'w' : /^months?$/.test(w3) ? 'm' : ''
      n = Number(w2)
      used = 3
    }
    if (unit) {
      const due = unit === 'd' ? addDays(todayISO, n) : unit === 'w' ? addDays(todayISO, n * 7) : addMonths(todayISO, n)
      return { due, used }
    }
  }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(w)
  if (m) {
    const d = toISODate(new Date(+m[1], +m[2] - 1, +m[3]))
    return { due: d, used: 1 }
  }
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(w)
  if (m) {
    const mo = +m[1], da = +m[2]
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return undefined
    const ty = parseISODate(todayISO).getFullYear()
    let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : ty
    let d = toISODate(new Date(y, mo - 1, da))
    if (!m[3] && d < todayISO) { y += 1; d = toISODate(new Date(y, mo - 1, da)) }
    return { due: d, used: 1 }
  }
  return undefined
}

const FILLER = new Set(['on', 'by', 'due', 'at'])

/** Parse a line as a task (also used by the Tasks page quick-add row). */
export function parseTask(input: string, ctx: CaptureContext = {}): TaskCapture {
  const todayISO = toISODate(ctx.now ?? new Date())
  const words = input.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  let due: ISODate | undefined
  let priority: Task['priority'] = 2
  let recurrence: Task['recurrence'] = 'none'
  let goal: CaptureGoal | undefined

  for (let i = 0; i < words.length; i++) {
    const raw = words[i]
    const w = clean(raw)

    const p = /^!([123])$/.exec(raw)
    if (p) { priority = Number(p[1]) as Task['priority']; continue }

    if (raw.startsWith('#') && raw.length > 1) {
      const g = matchGoal(raw.slice(1), ctx.goals ?? [])
      if (g && !goal) { goal = g; continue }
      out.push(raw)
      continue
    }

    if (w === 'every' && words[i + 1]) {
      const n = clean(words[i + 1])
      if (n === 'day') { recurrence = 'daily'; i += 1; continue }
      if (n === 'week') { recurrence = 'weekly'; i += 1; continue }
      if (n === 'month') { recurrence = 'monthly'; i += 1; continue }
      if (n in WEEKDAYS) {
        recurrence = 'weekly'
        if (!due) due = nextWeekday(addDays(todayISO, -1), WEEKDAYS[n])
        i += 1
        continue
      }
    }

    if (!due) {
      const r = parseDue(words, i, todayISO)
      if (r) {
        due = r.due
        i += r.used - 1
        // drop a dangling "on/by/due" right before the date
        if (out.length && FILLER.has(out[out.length - 1].toLowerCase())) out.pop()
        continue
      }
    }

    out.push(raw)
  }

  return {
    kind: 'task',
    title: out.join(' ').trim(),
    due,
    priority,
    recurrence,
    goalId: goal?.id,
    goalTitle: goal?.title,
  }
}

export function parseCapture(input: string, ctx: CaptureContext = {}): Capture {
  const now = ctx.now ?? new Date()
  const todayISO = toISODate(now)
  const text = input.trim()
  if (!text) return { kind: 'empty' }

  // Money: "$12.50 chipotle", "-$12.50 chipotle", "+$500 paycheck"
  const money = /^([+-])?\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?:\s+(.*))?$/.exec(text)
  if (money) {
    const amt = Number(money[2].replace(/,/g, ''))
    const income = money[1] === '+'
    const description = (money[3] ?? '').trim() || (income ? 'Income' : 'Expense')
    return { kind: 'transaction', amount: income ? amt : -amt, description, date: todayISO }
  }

  // Win: "win: shipped the report #career"
  const win = /^win\s*:\s*(.*)$/i.exec(text)
  if (win) {
    let area: Area = 'personal'
    const title = win[1]
      .split(/\s+/)
      .filter((w) => {
        const t = w.startsWith('#') ? w.slice(1).toLowerCase() : ''
        if (t && (AREAS as string[]).includes(t)) { area = t as Area; return false }
        return true
      })
      .join(' ')
      .trim()
    return { kind: 'win', title: title || 'Win', area }
  }

  // Meal: "ate oatmeal 350cal", "had chicken salad for lunch 520 kcal"
  const meal = /^(?:ate|had)\s+(?!to\b)(.+)$/i.exec(text)
  if (meal) {
    let rest = meal[1]
    let calories: number | undefined
    const cal = /(?:^|\s)(\d{1,5})\s*(?:k?cals?|calories)\b/i.exec(rest)
    if (cal) { calories = Number(cal[1]); rest = rest.replace(cal[0], ' ') }
    let slot = slotForTime(now)
    const forSlot = /\s*\bfor (breakfast|lunch|dinner|snack)\b/i.exec(rest)
    if (forSlot) { slot = forSlot[1].toLowerCase() as MealSlot; rest = rest.replace(forSlot[0], ' ') }
    const name = rest.replace(/\s+/g, ' ').trim()
    if (name) return { kind: 'meal', name, calories, slot, date: todayISO }
  }

  return parseTask(text, ctx)
}

const PRIORITY_LABEL: Record<number, string | undefined> = { 1: 'High', 2: undefined, 3: 'Low' }
const REC_LABEL: Record<string, string | undefined> = { none: undefined, daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

function dueLabel(due: ISODate, todayISO: ISODate): string {
  if (due === todayISO) return 'Today'
  if (due === addDays(todayISO, 1)) return 'Tomorrow'
  const diff = Math.round((parseISODate(due).getTime() - parseISODate(todayISO).getTime()) / 86_400_000)
  if (diff > 0 && diff < 7) return parseISODate(due).toLocaleDateString(undefined, { weekday: 'short' })
  return parseISODate(due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Short preview parts, e.g. ["Task", "Fri", "High"]. */
export function describeCapture(c: Capture, ctx: { now?: Date } = {}): string[] {
  const todayISO = toISODate(ctx.now ?? new Date())
  switch (c.kind) {
    case 'empty':
      return []
    case 'task':
      return [
        'Task',
        c.due ? dueLabel(c.due, todayISO) : undefined,
        PRIORITY_LABEL[c.priority],
        REC_LABEL[c.recurrence],
        c.goalTitle,
      ].filter((x): x is string => !!x)
    case 'transaction': {
      const abs = Math.abs(c.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
      return [c.amount < 0 ? 'Expense' : 'Income', abs]
    }
    case 'meal':
      return ['Meal', c.slot[0].toUpperCase() + c.slot.slice(1), c.calories != null ? `${c.calories} cal` : undefined].filter(
        (x): x is string => !!x,
      )
    case 'win':
      return ['Win', c.area[0].toUpperCase() + c.area.slice(1)]
  }
}
