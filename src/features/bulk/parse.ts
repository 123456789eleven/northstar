// "Add many" parsers. Pure: no DB access. Text (one item per line, or a block pasted from a spreadsheet) -> preview rows.
// Tasks/meals/transactions reuse the capture-bar parser (lib/capture.ts) and the finance quick-add parser.
// Pasting from Excel/Sheets gives tab-separated text: if the first row matches known column names it is mapped as headers.
import { AREAS, type Area, type Goal, type ISODate, type MealSlot, type Task } from '../../db'
import { parseCapture, parseTask, slotForTime, type CaptureGoal } from '../../lib/capture'
import { formatDate, toISODate } from '../../lib/dates'
import { CATEGORIES, allRules, categorize, type Rule } from '../finance/categories'
import { parseQuickAdd } from '../finance/quickAdd'

export type BulkKind = 'tasks' | 'people' | 'goals' | 'habits' | 'meals' | 'transactions' | 'balances'

export const BULK_KINDS: { value: BulkKind; label: string; noun: string }[] = [
  { value: 'tasks', label: 'Tasks', noun: 'task' },
  { value: 'people', label: 'People', noun: 'person' },
  { value: 'goals', label: 'Goals', noun: 'goal' },
  { value: 'habits', label: 'Habits', noun: 'habit' },
  { value: 'meals', label: 'Meals', noun: 'meal' },
  { value: 'transactions', label: 'Transactions', noun: 'transaction' },
  { value: 'balances', label: 'Balances', noun: 'balance' },
]

export type BulkItem =
  | { kind: 'tasks'; title: string; due?: ISODate; priority: Task['priority']; recurrence: Task['recurrence']; goalId?: number; goalTitle?: string; notes?: string }
  | { kind: 'people'; name: string; relation: string; cadenceDays: number; birthday?: string; notes?: string }
  | { kind: 'goals'; title: string; area: Area; horizon: Goal['horizon']; targetDate?: ISODate; why?: string }
  | { kind: 'habits'; name: string; area: Area; perWeek: number }
  | { kind: 'meals'; name: string; slot: MealSlot; date: ISODate; calories?: number }
  | { kind: 'transactions'; date: ISODate; amount: number; description: string; category: string; account?: string }
  | { kind: 'balances'; name: string; accountKind: 'asset' | 'liability'; balance: number; date: ISODate }

export type RowStatus = 'ok' | 'duplicate' | 'error'

export interface BulkRow {
  /** 0-based index of the line in the pasted text (what "remove" deletes). */
  line: number
  raw: string
  status: RowStatus
  reason?: string
  title: string
  chips: string[]
  item?: BulkItem
}

export interface BulkResult {
  rows: BulkRow[]
  /** How the text was read. */
  mode: 'lines' | 'sheet'
  /** Column names recognised from a header row, when there was one. */
  headers?: string[]
  /** Line index of the header row (skipped, not an item). */
  headerLine?: number
}

export type ExistingKeys = Record<BulkKind, Set<string>>
export const emptyExisting = (): ExistingKeys => ({
  tasks: new Set(), people: new Set(), goals: new Set(), habits: new Set(), meals: new Set(), transactions: new Set(), balances: new Set(),
})

export interface BulkContext {
  now?: Date
  goals?: CaptureGoal[]
  rules?: Rule[]
  existing?: ExistingKeys
}

// ---------- small value parsers (exported for tests) ----------

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const monthIndex = (w: string): number => {
  const t = w.toLowerCase().replace(/\.$/, '')
  if (t.length < 3) return -1
  return MONTHS.findIndex((m) => m.startsWith(t) || (t === 'sept' && m === 'september'))
}
const daysIn = (m: number, y = 2000) => new Date(y, m, 0).getDate() // m is 1-12
const pad = (n: number) => String(n).padStart(2, '0')

function realDate(y: number, m: number, d: number): ISODate | undefined {
  if (m < 1 || m > 12 || d < 1 || d > daysIn(m, y)) return undefined
  return `${y}-${pad(m)}-${pad(d)}`
}

/** Dates people actually type: 2026-12-31, 12/31, 12/31/26, Dec 31, Dec 31 2026, December 2026 (-> month end), 31 Dec, tomorrow, fri. */
export function parseLooseDate(input: string, todayISO: ISODate, prefer: 'future' | 'past' = 'future'): ISODate | undefined {
  const t = input.trim().replace(/^(?:by|due|on)\s+/i, '').replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!t) return undefined
  const ty = Number(todayISO.slice(0, 4))
  const rollForward = (m: number, d: number, y?: number): ISODate | undefined => {
    if (y != null) return realDate(y, m, d)
    const a = realDate(ty, m, d)
    if (prefer === 'past') return a && a > todayISO ? realDate(ty - 1, m, d) : a // logged things already happened
    return a && a < todayISO ? realDate(ty + 1, m, d) : a
  }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return realDate(+m[1], +m[2], +m[3])
  m = /^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/i.exec(t)
  if (m && monthIndex(m[1]) >= 0) return rollForward(monthIndex(m[1]) + 1, +m[2], m[3] ? +m[3] : undefined)
  m = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\.?(?: (\d{4}))?$/i.exec(t)
  if (m && monthIndex(m[2]) >= 0) return rollForward(monthIndex(m[2]) + 1, +m[1], m[3] ? +m[3] : undefined)
  m = /^([a-z]{3,9})\.? (\d{4})$/i.exec(t)
  if (m && monthIndex(m[1]) >= 0) return realDate(+m[2], monthIndex(m[1]) + 1, daysIn(monthIndex(m[1]) + 1, +m[2]))
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t)
  if (m) return realDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2])
  m = /^(\d{1,2})\/(\d{1,2})$/.exec(t)
  if (m) return rollForward(+m[1], +m[2])
  // Relative words ("tomorrow", "next fri", "in 2 weeks"): only if the capture parser consumes the whole text.
  const r = parseTask(`x ${t}`, { now: new Date(`${todayISO}T12:00:00`) })
  return r.title === 'x' ? r.due : undefined
}

/** Birthday as MM-DD. Accepts 03-14, 3/14, 3/14/1990, 1990-03-14, Mar 14, March 14 1990; optional "bday:" prefix. */
export function parseBirthday(input: string): string | undefined {
  const t = input.trim().replace(/^(?:b-?day|birthday|born)\s*:?\s*/i, '').replace(/,/g, ' ').replace(/\s+/g, ' ')
  const ok = (mo: number, d: number) => (mo >= 1 && mo <= 12 && d >= 1 && d <= daysIn(mo) ? `${pad(mo)}-${pad(d)}` : undefined)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return ok(+m[2], +m[3])
  m = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2}|\d{4}))?$/.exec(t)
  if (m) return ok(+m[1], +m[2])
  m = /^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?: \d{4})?$/i.exec(t)
  if (m && monthIndex(m[1]) >= 0) return ok(monthIndex(m[1]) + 1, +m[2])
  m = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\.?(?: \d{4})?$/i.exec(t)
  if (m && monthIndex(m[2]) >= 0) return ok(monthIndex(m[2]) + 1, +m[1])
  return undefined
}

/** Days between contacts: "every 30 days", "every 2 weeks", "weekly", "monthly", "quarterly", "none". Bare numbers only when allowed (a labelled column). */
export function parseCadence(input: string, allowBare = false): number | undefined {
  const t = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!t) return undefined
  if (/^(none|never|no reminder|no reminders|off)$/.test(t)) return 0
  if (/^(daily|every day)$/.test(t)) return 1
  if (/^(weekly|every week)$/.test(t)) return 7
  if (/^(biweekly|bi-weekly|fortnightly|every other week)$/.test(t)) return 14
  if (/^(monthly|every month)$/.test(t)) return 30
  if (/^(quarterly|every quarter)$/.test(t)) return 90
  if (/^(yearly|annually|every year)$/.test(t)) return 365
  const m = /^(?:every )?(\d{1,4})\s*(d|days?|w|wks?|weeks?|m|mos?|months?)$/.exec(t)
  if (m) {
    const unit = m[2][0]
    return Math.min(3650, Number(m[1]) * (unit === 'w' ? 7 : unit === 'm' ? 30 : 1))
  }
  if (allowBare && /^\d{1,4}$/.test(t)) return Math.min(3650, Number(t))
  return undefined
}

export function parseAmount(input: string): number | undefined {
  let t = input.trim()
  if (!t) return undefined
  let neg = false
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1) }
  if (t.endsWith('-')) { neg = !neg; t = t.slice(0, -1) }
  t = t.replace(/\s/g, '')
  const sign = /^[+-]/.exec(t)?.[0]
  if (sign) t = t.slice(1)
  t = t.replace(/^\$/, '')
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$|^\.\d{1,2}$/.test(t)) return undefined
  const n = Number(t.replace(/,/g, ''))
  if (!Number.isFinite(n)) return undefined
  return neg !== (sign === '-') ? -n : n
}

function parsePriority(s: string): Task['priority'] | undefined {
  const t = s.trim().toLowerCase().replace(/^[!p]/, '')
  if (t === '1' || t === 'high' || t === 'h' || t === 'urgent') return 1
  if (t === '2' || t === 'medium' || t === 'med' || t === 'normal' || t === 'm') return 2
  if (t === '3' || t === 'low' || t === 'l') return 3
  return undefined
}

function parseRecurrence(s: string): Task['recurrence'] | undefined {
  const t = s.trim().toLowerCase().replace(/^every\s+/, '')
  if (['', 'none', 'no', 'never', 'once'].includes(t)) return 'none'
  if (['daily', 'day'].includes(t)) return 'daily'
  if (['weekly', 'week'].includes(t)) return 'weekly'
  if (['monthly', 'month'].includes(t)) return 'monthly'
  return undefined
}

function parseArea(s: string): Area | undefined {
  const t = s.trim().toLowerCase().replace(/^#/, '')
  return (AREAS as string[]).includes(t) ? (t as Area) : undefined
}

const SLOT_WORDS = ['breakfast', 'lunch', 'dinner', 'snack']

// ---------- splitting ----------

/** Split one line into cells, honouring "double quotes" (so a pasted CSV round-trips). */
export function splitCells(line: string, delim: ',' | '\t'): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"' && cur === '') q = true
    else if (c === delim) { out.push(cur.trim()); cur = '' }
    else cur += c
  }
  out.push(cur.trim())
  return out
}

const BULLET = /^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s+/

type Field = string
const ALIASES: Record<BulkKind, Record<Field, string[]>> = {
  tasks: {
    title: ['task', 'tasks', 'title', 'name', 'todo', 'to do', 'description'],
    due: ['due', 'due date', 'date', 'deadline'],
    priority: ['priority', 'prio'],
    recurrence: ['repeat', 'repeats', 'recurrence', 'recurring', 'frequency'],
    notes: ['notes', 'note'],
  },
  people: {
    name: ['name', 'person', 'contact', 'full name'],
    relation: ['relationship', 'relation', 'type', 'role'],
    cadence: ['cadence', 'contact every', 'frequency', 'every', 'reminder', 'stay in touch'],
    birthday: ['birthday', 'bday', 'birth date', 'dob', 'date of birth'],
    notes: ['notes', 'note'],
  },
  goals: {
    title: ['goal', 'goals', 'title', 'name'],
    area: ['area', 'category'],
    horizon: ['horizon', 'timeframe', 'level'],
    targetDate: ['by', 'target', 'target date', 'due', 'due date', 'deadline', 'date'],
    why: ['why', 'notes', 'note'],
  },
  habits: {
    name: ['habit', 'habits', 'name', 'title'],
    area: ['area', 'category'],
    perWeek: ['per week', 'times per week', 'target', 'frequency', 'days per week', 'perweek'],
  },
  meals: {
    name: ['meal', 'food', 'name', 'item', 'description'],
    calories: ['calories', 'cal', 'cals', 'kcal'],
    slot: ['slot', 'meal type', 'type', 'when'],
    date: ['date', 'day'],
  },
  transactions: {
    date: ['date', 'transaction date', 'posted date'],
    description: ['description', 'payee', 'merchant', 'name', 'memo', 'details'],
    amount: ['amount', 'amt', 'value'],
    debit: ['debit', 'withdrawal', 'money out'],
    credit: ['credit', 'deposit', 'money in'],
    category: ['category'],
    account: ['account'],
  },
  balances: {
    name: ['name', 'account', 'account name'],
    type: ['type', 'kind', 'asset or liability'],
    amount: ['balance', 'amount', 'value'],
    date: ['date', 'as of'],
  },
}

const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Field per column, or null when the row doesn't look like a header (needs 2+ known names, or a lone exact "name" word). */
export function detectHeader(kind: BulkKind, cells: string[]): (Field | null)[] | null {
  const map = ALIASES[kind]
  const fields = cells.map((c) => {
    const n = normHeader(c)
    return Object.keys(map).find((f) => map[f].includes(n)) ?? null
  })
  const hits = fields.filter(Boolean).length
  if (cells.length === 1) return hits === 1 ? fields : null
  return hits >= 2 && hits >= Math.ceil(cells.length / 2) ? fields : null
}

interface RawRow {
  line: number
  raw: string
  /** Header-mapped values (spreadsheet / CSV with a header row). */
  named?: Partial<Record<Field, string>>
  /** Unlabelled parts: comma/tab separated, or the whole line as one part. */
  parts: string[]
}

type Built = { item: BulkItem } | { error: string }
const fail = (error: string): Built => ({ error })

// ---------- builders ----------

function buildTask(r: RawRow, ctx: BulkContext, todayISO: ISODate): Built {
  const now = ctx.now ?? new Date()
  const text = r.named ? (r.named.title ?? '') : r.parts.join(' ')
  const t = parseTask(text, { now, goals: ctx.goals })
  if (!t.title) return fail('No task title')
  let { due, priority, recurrence } = t
  let notes: string | undefined
  const n = r.named
  if (n) {
    if (n.due?.trim()) {
      due = parseLooseDate(n.due, todayISO)
      if (!due) return fail(`Can't read the date "${n.due}"`)
    }
    if (n.priority?.trim()) {
      const p = parsePriority(n.priority)
      if (!p) return fail(`Priority "${n.priority}" should be high, medium, low or 1-3`)
      priority = p
    }
    if (n.recurrence?.trim()) {
      const rc = parseRecurrence(n.recurrence)
      if (!rc) return fail(`Repeat "${n.recurrence}" should be daily, weekly or monthly`)
      recurrence = rc
    }
    notes = n.notes?.trim() || undefined
  }
  return { item: { kind: 'tasks', title: t.title, due, priority, recurrence, goalId: t.goalId, goalTitle: t.goalTitle, notes } }
}

function buildPerson(r: RawRow): Built {
  const n = r.named
  const name = (n ? n.name : r.parts[0])?.trim() ?? ''
  if (!name) return fail('No name')
  let relation = ''
  let cadenceDays: number | undefined
  let birthday: string | undefined
  const notes: string[] = []
  if (n) {
    relation = n.relation?.trim() ?? ''
    if (n.cadence?.trim()) {
      cadenceDays = parseCadence(n.cadence, true)
      if (cadenceDays == null) return fail(`Can't read the cadence "${n.cadence}" (try "every 30 days")`)
    }
    if (n.birthday?.trim()) {
      birthday = parseBirthday(n.birthday)
      if (!birthday) return fail(`"${n.birthday}" is not a valid birthday (use MM-DD)`)
    }
    if (n.notes?.trim()) notes.push(n.notes.trim())
  } else {
    let haveRelation = false
    for (const part of r.parts.slice(1)) {
      if (!part) continue
      const cad = parseCadence(part)
      if (cad != null && cadenceDays == null) { cadenceDays = cad; continue }
      if (/^every\b/i.test(part)) return fail(`Can't read "${part}" as a cadence (try "every 30 days")`)
      const bd = parseBirthday(part)
      if (bd && !birthday) { birthday = bd; continue }
      if (/^(?:b-?day|birthday|born)\b/i.test(part)) return fail(`"${part}" is not a valid birthday (use MM-DD)`)
      if (!haveRelation) { relation = part; haveRelation = true } else notes.push(part)
    }
  }
  return { item: { kind: 'people', name, relation, cadenceDays: cadenceDays ?? 30, birthday, notes: notes.join('; ') || undefined } }
}

function buildGoal(r: RawRow, todayISO: ISODate): Built {
  const n = r.named
  const title = (n ? n.title : r.parts[0])?.trim() ?? ''
  if (!title) return fail('No goal title')
  let area: Area | undefined
  let horizon: Goal['horizon'] | undefined
  let targetDate: ISODate | undefined
  const why: string[] = []
  if (n) {
    if (n.area?.trim()) {
      area = parseArea(n.area)
      if (!area) return fail(`Area "${n.area}" should be one of ${AREAS.join(', ')}`)
    }
    if (n.horizon?.trim()) {
      const h = n.horizon.trim().toLowerCase()
      if (h !== 'life' && h !== 'year' && h !== 'quarter') return fail(`Horizon "${n.horizon}" should be life, year or quarter`)
      horizon = h
    }
    if (n.targetDate?.trim()) {
      targetDate = parseLooseDate(n.targetDate, todayISO)
      if (!targetDate) return fail(`Can't read the date "${n.targetDate}"`)
    }
    if (n.why?.trim()) why.push(n.why.trim())
  } else {
    for (const part of r.parts.slice(1)) {
      if (!part) continue
      const a = parseArea(part)
      if (a && !area) { area = a; continue }
      const low = part.toLowerCase()
      if ((low === 'life' || low === 'year' || low === 'quarter') && !horizon) { horizon = low; continue }
      if (/^(by|due)\s/i.test(part)) {
        targetDate = parseLooseDate(part, todayISO)
        if (!targetDate) return fail(`Can't read the date "${part}"`)
        continue
      }
      const d = !targetDate && /\d/.test(part) ? parseLooseDate(part, todayISO) : undefined
      if (d) { targetDate = d; continue }
      why.push(part)
    }
  }
  return { item: { kind: 'goals', title, area: area ?? 'personal', horizon: horizon ?? 'year', targetDate, why: why.join('; ') || undefined } }
}

function buildHabit(r: RawRow): Built {
  const n = r.named
  let name = (n ? n.name : r.parts[0])?.trim() ?? ''
  let perWeek: number | undefined
  let area: Area | undefined
  const bad = (v: string) => fail(`"${v}" is not a number of days per week (1-7)`)
  const week = (s: string): number | undefined | 'bad' => {
    const t = s.trim().toLowerCase()
    if (/^(daily|every day)$/.test(t)) return 7
    if (/^(weekly|once a week)$/.test(t)) return 1
    const m = /^(\d)\s*(?:x|times|days?)?(?:\s*(?:\/|a|per)?\s*(?:week|wk))?$/.exec(t)
    if (!m) return undefined
    return +m[1] >= 1 && +m[1] <= 7 ? +m[1] : 'bad'
  }
  if (!name) return fail('No habit name')
  if (n) {
    if (n.area?.trim()) {
      area = parseArea(n.area)
      if (!area) return fail(`Area "${n.area}" should be one of ${AREAS.join(', ')}`)
    }
    if (n.perWeek?.trim()) {
      const w = week(n.perWeek)
      if (w === undefined || w === 'bad') return bad(n.perWeek)
      perWeek = w
    }
  } else {
    // "Meditate daily", "Run 3x week"
    const suf = /^(.*?\S)\s+(daily|every day|\d\s*x(?:\s*(?:\/|a|per)?\s*(?:week|wk))?)$/i.exec(name)
    if (suf) {
      const w = week(suf[2])
      if (w === 'bad') return bad(suf[2])
      if (w) { perWeek = w; name = suf[1].trim() }
    }
    for (const part of r.parts.slice(1)) {
      if (!part) continue
      const a = parseArea(part)
      if (a && !area) { area = a; continue }
      const w = week(part)
      if (w === 'bad') return bad(part)
      if (w && perWeek == null) { perWeek = w; continue }
      return fail(`Don't know what "${part}" is (use an area like health, or "5x week")`)
    }
  }
  return { item: { kind: 'habits', name, area: area ?? 'health', perWeek: perWeek ?? 7 } }
}

const CAL_RE = /^(\d{1,5})\s*(?:k?cals?|calories)?$/i

function buildMeal(r: RawRow, ctx: BulkContext, todayISO: ISODate): Built {
  const now = ctx.now ?? new Date()
  if (!r.named && r.parts.length <= 1) {
    const text = (r.parts[0] ?? '').trim()
    const c = parseCapture(/^(?:ate|had)\s/i.test(text) ? text : `ate ${text}`, { now })
    if (c.kind !== 'meal') return fail("Couldn't read that as a meal")
    return { item: { kind: 'meals', name: c.name, slot: c.slot, date: c.date, calories: c.calories } }
  }
  let name = ''
  let calories: number | undefined
  let slot: MealSlot | undefined
  let date: ISODate | undefined
  const n = r.named
  if (n) {
    name = n.name?.trim() ?? ''
    if (n.calories?.trim()) {
      const m = CAL_RE.exec(n.calories.trim())
      if (!m) return fail(`Calories "${n.calories}" should be a number`)
      calories = Number(m[1])
    }
    if (n.slot?.trim()) {
      const s = n.slot.trim().toLowerCase()
      if (!SLOT_WORDS.includes(s)) return fail(`Slot "${n.slot}" should be breakfast, lunch, dinner or snack`)
      slot = s as MealSlot
    }
    if (n.date?.trim()) {
      date = parseLooseDate(n.date, todayISO, 'past')
      if (!date) return fail(`Can't read the date "${n.date}"`)
    }
  } else {
    name = r.parts[0].trim()
    const extra: string[] = []
    for (const part of r.parts.slice(1)) {
      if (!part) continue
      const low = part.toLowerCase().replace(/^for\s+/, '')
      if (SLOT_WORDS.includes(low) && !slot) { slot = low as MealSlot; continue }
      const cm = CAL_RE.exec(part)
      if (cm && calories == null) { calories = Number(cm[1]); continue }
      const d = !date && /^(?:yesterday|yday|today|\d)/i.test(part) ? parseLooseDate(part, todayISO, 'past') : undefined
      if (d) { date = d; continue }
      extra.push(part)
    }
    if (extra.length) name = [name, ...extra].join(', ')
  }
  if (!name) return fail('No meal name')
  return { item: { kind: 'meals', name, slot: slot ?? slotForTime(now), date: date ?? todayISO, calories } }
}

function buildTransaction(r: RawRow, ctx: BulkContext, todayISO: ISODate): Built {
  const rules = ctx.rules ?? allRules([])
  const finish = (date: ISODate, amount: number, description: string, category?: string, account?: string): Built => {
    if (!description) return fail('No description')
    if (!amount) return fail('Amount is zero')
    const cat = category && CATEGORIES.find((c) => c.toLowerCase() === category.trim().toLowerCase())
    return { item: { kind: 'transactions', date, amount: Math.round(amount * 100) / 100, description, category: cat || categorize(description, amount, rules), account: account?.trim() || undefined } }
  }
  const n = r.named
  if (n) {
    const date = n.date?.trim() ? parseLooseDate(n.date, todayISO, 'past') : todayISO
    if (!date) return fail(`Can't read the date "${n.date}"`)
    let amount: number | undefined
    if (n.amount?.trim()) {
      amount = parseAmount(n.amount)
      if (amount == null) return fail(`Can't read the amount "${n.amount}"`)
    } else if (n.debit?.trim() || n.credit?.trim()) {
      const d = n.debit?.trim() ? parseAmount(n.debit) : 0
      const c = n.credit?.trim() ? parseAmount(n.credit) : 0
      if (d == null || c == null) return fail('Can\'t read the debit/credit amount')
      amount = Math.abs(c) - Math.abs(d)
    } else return fail('No amount')
    return finish(date, amount, (n.description ?? '').replace(/\s+/g, ' ').trim(), n.category, n.account)
  }
  // Unlabelled: unsigned amounts are money out, "+" is money in (same as the capture bar).
  if (r.parts.length > 1) {
    let date: ISODate | undefined
    let amtText: string | undefined
    const desc: string[] = []
    for (const p of r.parts) {
      if (!p) continue
      if (!date && /^\d{1,4}[-/]|^[a-z]{3,9}\.? \d/i.test(p)) {
        const d = parseLooseDate(p, todayISO, 'past')
        if (d) { date = d; continue }
      }
      if (parseAmount(p) != null) { if (amtText != null) desc.push(amtText); amtText = p; continue }
      desc.push(p)
    }
    if (amtText == null) return fail('No amount found')
    const a = parseAmount(amtText)!
    return finish(date ?? todayISO, /^\+/.test(amtText.trim()) ? Math.abs(a) : -Math.abs(a), desc.join(', ').replace(/\s+/g, ' ').trim())
  }
  const text = (r.parts[0] ?? '').trim()
  const c = parseCapture(text, { now: ctx.now })
  if (c.kind === 'transaction') return finish(c.date, c.amount, c.description)
  const q = parseQuickAdd(text)
  if (q) return finish(todayISO, q.dir === 'in' ? q.amount : -q.amount, q.description)
  const lead = /^([+-]?)\s*\$?(\d[\d,]*(?:\.\d{1,2})?)\s+(.+)$/.exec(text)
  if (lead) {
    const a = parseAmount(lead[2])
    if (a) return finish(todayISO, lead[1] === '+' ? a : -a, lead[3].trim())
  }
  return fail('Needs an amount, e.g. "Kroger 42.50" or "$12 lunch"')
}

function parseBalanceKind(s: string): 'asset' | 'liability' | undefined {
  const t = s.trim().toLowerCase()
  if (['asset', 'assets', 'a'].includes(t)) return 'asset'
  if (['liability', 'liabilities', 'l', 'debt', 'owe'].includes(t)) return 'liability'
  return undefined
}

function buildBalance(r: RawRow, todayISO: ISODate): Built {
  const n = r.named
  const [pName, pKind, pAmt, pDate] = r.parts.map((p) => p.trim())
  const name = ((n ? n.name : pName) ?? '').replace(/\s+/g, ' ').trim()
  const kindText = ((n ? n.type : pKind) ?? '').trim()
  const amtText = ((n ? n.amount : pAmt) ?? '').trim()
  const dateText = ((n ? n.date : pDate) ?? '').trim()
  if (!name) return fail('No account name')
  if (!kindText) return fail('Needs asset or liability')
  const accountKind = parseBalanceKind(kindText)
  if (!accountKind) return fail(`"${kindText}" should be asset or liability`)
  if (!amtText) return fail('No balance amount')
  const amount = parseAmount(amtText)
  if (amount == null) return fail(`Can't read the amount "${amtText}"`)
  const date = dateText ? parseLooseDate(dateText, todayISO, 'past') : todayISO
  if (!date) return fail(`Can't read the date "${dateText}"`)
  return { item: { kind: 'balances', name, accountKind, balance: Math.round(Math.abs(amount) * 100) / 100, date } }
}

// ---------- description + keys ----------

const money = (n: number) => Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export function describeItem(item: BulkItem): { title: string; chips: string[] } {
  switch (item.kind) {
    case 'tasks':
      return {
        title: item.title,
        chips: [
          item.due ? formatDate(item.due) : undefined,
          item.priority === 1 ? 'High' : item.priority === 3 ? 'Low' : undefined,
          item.recurrence !== 'none' ? cap(item.recurrence) : undefined,
          item.goalTitle,
        ].filter((x): x is string => !!x),
      }
    case 'people':
      return {
        title: item.name,
        chips: [
          item.relation || undefined,
          item.cadenceDays ? `Every ${item.cadenceDays} days` : 'No reminder',
          item.birthday ? `Birthday ${item.birthday}` : undefined,
        ].filter((x): x is string => !!x),
      }
    case 'goals':
      return { title: item.title, chips: [cap(item.area), item.targetDate ? `By ${formatDate(item.targetDate, { month: 'short', day: 'numeric', year: 'numeric' })}` : undefined].filter((x): x is string => !!x) }
    case 'habits':
      return { title: item.name, chips: [cap(item.area), item.perWeek === 7 ? 'Daily' : `${item.perWeek}x a week`] }
    case 'meals':
      return { title: item.name, chips: [cap(item.slot), item.calories != null ? `${item.calories} cal` : undefined, formatDate(item.date)].filter((x): x is string => !!x) }
    case 'balances':
      return { title: item.name, chips: [item.accountKind === 'asset' ? 'Asset' : 'Liability', money(item.balance), formatDate(item.date)] }
    case 'transactions':
      return { title: item.description, chips: [item.amount < 0 ? `Out ${money(item.amount)}` : `In ${money(item.amount)}`, formatDate(item.date), item.category] }
  }
}

export function itemKey(item: BulkItem): string {
  switch (item.kind) {
    case 'tasks': return `${item.title.toLowerCase()}|${item.due ?? ''}`
    case 'people': return item.name.toLowerCase()
    case 'goals': return item.title.toLowerCase()
    case 'habits': return item.name.toLowerCase()
    case 'meals': return `${item.date}|${item.slot}|${item.name.toLowerCase()}`
    case 'transactions': return `${item.date}|${item.amount.toFixed(2)}|${item.description.toLowerCase()}`
    case 'balances': return `${item.name.toLowerCase()}|${item.date}|${item.accountKind}`
  }
}

const DUP_REASON: Record<BulkKind, string> = {
  tasks: 'Already an open task',
  people: 'Already in People',
  goals: 'Already a goal',
  habits: 'Already a habit',
  meals: 'Already logged',
  transactions: 'Already recorded',
  balances: 'Already recorded for that date',
}

// ---------- entry point ----------

export function parseBulk(kind: BulkKind, text: string, ctx: BulkContext = {}): BulkResult {
  const todayISO = toISODate(ctx.now ?? new Date())
  const lines = text.split(/\r?\n/)
  const present = lines.map((raw, line) => ({ raw, line })).filter((l) => l.raw.trim() !== '')
  const sheet = present.some((l) => l.raw.includes('\t'))
  const delim: ',' | '\t' = sheet ? '\t' : ','
  const splitsOnComma = kind !== 'tasks' // tasks keep commas in titles

  let headerLine: number | undefined
  let headerFields: (Field | null)[] | null = null
  let headers: string[] | undefined
  if (present.length) {
    const first = present[0]
    const cells = splitCells(first.raw, delim)
    const f = detectHeader(kind, cells)
    if (f && (cells.length > 1 || present.length > 1)) {
      headerFields = f
      headerLine = first.line
      headers = cells.filter((_, i) => f[i])
    }
  }

  const existing = ctx.existing?.[kind] ?? new Set<string>()
  const seen = new Set<string>()
  const rows: BulkRow[] = []

  for (const { raw, line } of present) {
    if (line === headerLine) continue
    let rr: RawRow
    if (headerFields) {
      const cells = splitCells(raw, delim)
      const named: Partial<Record<Field, string>> = {}
      headerFields.forEach((f, i) => { if (f && cells[i] != null) named[f] = cells[i] })
      rr = { line, raw, named, parts: cells }
    } else if (sheet) {
      rr = { line, raw, parts: splitCells(raw, '\t') }
    } else {
      const stripped = raw.replace(BULLET, '').trim()
      rr = { line, raw, parts: splitsOnComma && stripped.includes(',') ? splitCells(stripped, ',') : [stripped] }
    }
    if (!rr.named && rr.parts.every((p) => !p)) continue
    const built: Built =
      kind === 'tasks' ? buildTask(rr, ctx, todayISO)
      : kind === 'people' ? buildPerson(rr)
      : kind === 'goals' ? buildGoal(rr, todayISO)
      : kind === 'habits' ? buildHabit(rr)
      : kind === 'meals' ? buildMeal(rr, ctx, todayISO)
      : kind === 'balances' ? buildBalance(rr, todayISO)
      : buildTransaction(rr, ctx, todayISO)
    if ('error' in built) {
      rows.push({ line, raw, status: 'error', reason: built.error, title: raw.trim().replace(/\t/g, '  '), chips: [] })
      continue
    }
    const item = built.item
    const d = describeItem(item)
    const key = itemKey(item)
    if (existing.has(key) || seen.has(key)) {
      rows.push({ line, raw, status: 'duplicate', reason: existing.has(key) ? DUP_REASON[kind] : 'Repeated above', ...d, item })
      continue
    }
    seen.add(key)
    rows.push({ line, raw, status: 'ok', ...d, item })
  }
  return { rows, mode: sheet || headerFields ? 'sheet' : 'lines', headers, headerLine }
}

export const okItems = (res: BulkResult): BulkItem[] => res.rows.filter((r) => r.status === 'ok' && r.item).map((r) => r.item!)

/** Drop one line from the pasted text. */
export function removeLine(text: string, line: number): string {
  const lines = text.split(/\r?\n/)
  lines.splice(line, 1)
  return lines.join('\n')
}
