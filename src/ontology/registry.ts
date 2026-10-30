// Ontology: a typed registry of the things Northstar knows about, how they link, and what you can do with them.
// Actions call the existing feature functions (never duplicate logic). Everything is on-device.
import { db, type Budget, type CalendarEvent, type Goal, type Habit, type HabitLog, type Interaction, type JournalEntry, type LearningItem, type LifeEvent, type Meal, type Person, type Review, type Task, type Transaction } from '../db'
import { archiveHabit, toggleCheckIn } from '../features/habits/habitData'
import { perWeekLabel, streak } from '../features/habits/stats'
import { wordCount } from '../features/journal/stats'
import { timeLabel } from '../features/planner/layout'
import { daysBetween, today } from '../lib/dates'
import { goalProgress, progressLabel } from '../features/goals/progress'
import { completeGoal, reopenGoal, setPaused } from '../features/goals/goalActions'
import { completeItem, startItem } from '../features/learning/learningData'
import { logContact, personStatus } from '../features/people/people'
import { merchantKey, merchantLabel } from '../features/finance/categories'
import { completeTask, reopenTask, togglePin } from '../features/tasks/taskActions'
import { RULE_META, type RuleId } from '../features/ops/proposals'

export type TypeKey = 'Task' | 'Goal' | 'Person' | 'Transaction' | 'Meal' | 'LearningItem' | 'Interaction' | 'LifeEvent' | 'Review' | 'Budget' | 'Habit' | 'HabitLog' | 'JournalEntry' | 'CalendarEvent'
export type Row = { id?: number } & Record<string, unknown>

export interface PropDef { name: string; type: string }
/** A link declared on the source type. `fk`: via holds the target id. `category`: via matches Budget.category. `ref`: via is refTable/refId. */
export interface LinkDef { name: string; label: string; to: TypeKey | '*'; via: string; mode: 'fk' | 'category' | 'ref' }
export interface ActionDef<T = Row> { id: string; label: string; when?: (o: T) => boolean; run: (o: T) => Promise<unknown> }
export interface FnDef<T = Row> { name: string; label: string; run: (o: T) => Promise<string | number> }
export interface AutomationDef { name: string; ruleId: RuleId | null; description: string }

export interface TypeDef<T = Row> {
  key: TypeKey
  label: string
  table: string
  title: (o: T) => string
  subtitle: (o: T) => string
  properties: PropDef[]
  links: LinkDef[]
  actions: ActionDef<T>[]
  functions: FnDef<T>[]
  automations: AutomationDef[]
}

const auto = (id: RuleId): AutomationDef => ({ name: RULE_META[id].label, ruleId: id, description: RULE_META[id].description })
const erase = <T>(d: TypeDef<T>) => d as unknown as TypeDef

const task = erase<Task>({
  key: 'Task', label: 'Task', table: 'tasks',
  title: (o) => o.title,
  subtitle: (o) => `${o.status}${o.due ? ` · due ${o.due}` : ''} · P${o.priority}`,
  properties: [
    { name: 'title', type: 'string' }, { name: 'status', type: "'open'|'done'" }, { name: 'due', type: 'date?' }, { name: 'priority', type: '1|2|3' },
    { name: 'recurrence', type: 'enum' }, { name: 'goalId', type: 'Goal.id?' }, { name: 'focusDate', type: 'date?' }, { name: 'doneAt', type: 'timestamp?' },
  ],
  links: [{ name: 'goalId', label: 'advances', to: 'Goal', via: 'goalId', mode: 'fk' }],
  actions: [
    { id: 'complete', label: 'Complete', when: (o) => o.status === 'open', run: completeTask },
    { id: 'reopen', label: 'Reopen', when: (o) => o.status === 'done', run: reopenTask },
    { id: 'pin', label: 'Pin / unpin focus', when: (o) => o.status === 'open', run: async (o) => { if (!(await togglePin(o))) throw new Error('Today’s focus is full') } },
  ],
  functions: [
    { name: 'daysOverdue', label: 'Days overdue', run: async (o) => (o.status === 'open' && o.due && o.due < today() ? daysBetween(o.due, today()) : 0) },
  ],
  automations: [auto('overdue-task')],
})

const goal = erase<Goal>({
  key: 'Goal', label: 'Goal', table: 'goals',
  title: (o) => o.title,
  subtitle: (o) => `${o.horizon} · ${o.area} · ${o.status}`,
  properties: [
    { name: 'title', type: 'string' }, { name: 'area', type: 'Area' }, { name: 'horizon', type: 'life|year|quarter' }, { name: 'status', type: 'active|done|paused' },
    { name: 'parentId', type: 'Goal.id?' }, { name: 'targetDate', type: 'date?' }, { name: 'milestones', type: 'Milestone[]' },
  ],
  links: [{ name: 'parentId', label: 'parent', to: 'Goal', via: 'parentId', mode: 'fk' }],
  actions: [
    { id: 'complete', label: 'Complete', when: (o) => o.status !== 'done', run: completeGoal },
    { id: 'reopen', label: 'Reopen', when: (o) => o.status === 'done', run: reopenGoal },
    { id: 'pause', label: 'Pause', when: (o) => o.status === 'active', run: (o) => setPaused(o, true) },
    { id: 'resume', label: 'Resume', when: (o) => o.status === 'paused', run: (o) => setPaused(o, false) },
  ],
  functions: [
    { name: 'progress', label: 'Progress', run: async (o) => { const p = goalProgress(o, await db.tasks.where('goalId').equals(o.id!).toArray()); return `${Math.round(p.pct)}% · ${progressLabel(p)}` } },
  ],
  automations: [auto('goal-drift')],
})

const person = erase<Person>({
  key: 'Person', label: 'Person', table: 'people',
  title: (o) => o.name,
  subtitle: (o) => `${o.relation}${o.cadenceDays ? ` · every ${o.cadenceDays}d` : ''}`,
  properties: [{ name: 'name', type: 'string' }, { name: 'relation', type: 'string' }, { name: 'cadenceDays', type: 'number' }, { name: 'lastContact', type: 'date?' }, { name: 'birthday', type: 'MM-DD?' }],
  links: [],
  actions: [
    { id: 'text', label: 'Log text', run: (o) => logContact(o, 'text') },
    { id: 'call', label: 'Log call', run: (o) => logContact(o, 'call') },
  ],
  functions: [{ name: 'contactStatus', label: 'Contact status', run: async (o) => personStatus(o).text }],
  automations: [auto('person-overdue')],
})

const transaction = erase<Transaction>({
  key: 'Transaction', label: 'Transaction', table: 'transactions',
  title: (o) => o.description,
  subtitle: (o) => `${o.date} · ${o.amount.toFixed(2)} · ${o.category}`,
  properties: [{ name: 'date', type: 'date' }, { name: 'amount', type: 'number' }, { name: 'description', type: 'string' }, { name: 'category', type: 'string' }, { name: 'account', type: 'string?' }, { name: 'importBatch', type: 'string?' }],
  links: [{ name: 'category', label: 'counts toward', to: 'Budget', via: 'category', mode: 'category' }],
  actions: [],
  functions: [{ name: 'merchant', label: 'Merchant', run: async (o) => merchantLabel(merchantKey(o.description)) }],
  automations: [auto('merchant-category')],
})

const meal = erase<Meal>({
  key: 'Meal', label: 'Meal', table: 'meals',
  title: (o) => o.name,
  subtitle: (o) => `${o.date} · ${o.slot}`,
  properties: [{ name: 'date', type: 'date' }, { name: 'slot', type: 'MealSlot' }, { name: 'name', type: 'string' }, { name: 'calories', type: 'number?' }, { name: 'protein', type: 'number?' }],
  links: [],
  actions: [],
  functions: [{ name: 'dayCalories', label: 'Calories that day', run: async (o) => (await db.meals.where('date').equals(o.date).toArray()).reduce((s, m) => s + (m.calories ?? 0), 0) }],
  automations: [],
})

const learning = erase<LearningItem>({
  key: 'LearningItem', label: 'Learning item', table: 'learning',
  title: (o) => o.title,
  subtitle: (o) => `${o.kind} · ${o.status} · ${Math.round(o.progress)}%`,
  properties: [{ name: 'title', type: 'string' }, { name: 'kind', type: 'course|cert|book|skill' }, { name: 'status', type: 'planned|active|done' }, { name: 'progress', type: '0-100' }, { name: 'goalId', type: 'Goal.id?' }],
  links: [{ name: 'goalId', label: 'supports', to: 'Goal', via: 'goalId', mode: 'fk' }],
  actions: [
    { id: 'start', label: 'Start', when: (o) => o.status === 'planned', run: startItem },
    { id: 'complete', label: 'Complete', when: (o) => o.status !== 'done', run: completeItem },
  ],
  functions: [{ name: 'minutesStudied', label: 'Minutes studied', run: async (o) => (await db.studySessions.where('itemId').equals(o.id!).toArray()).reduce((s, x) => s + x.minutes, 0) }],
  automations: [auto('study-streak')],
})

const interaction = erase<Interaction>({
  key: 'Interaction', label: 'Interaction', table: 'interactions',
  title: (o) => `${o.kind} on ${o.date}`,
  subtitle: (o) => o.note ?? '',
  properties: [{ name: 'personId', type: 'Person.id' }, { name: 'date', type: 'date' }, { name: 'kind', type: 'call|text|in-person|other' }, { name: 'note', type: 'string?' }],
  links: [{ name: 'personId', label: 'with', to: 'Person', via: 'personId', mode: 'fk' }],
  actions: [],
  functions: [{ name: 'daysAgo', label: 'Days ago', run: async (o) => daysBetween(o.date, today()) }],
  automations: [],
})

const lifeEvent = erase<LifeEvent>({
  key: 'LifeEvent', label: 'Life event', table: 'events',
  title: (o) => o.title,
  subtitle: (o) => `${o.at.slice(0, 10)} · ${o.kind}`,
  properties: [{ name: 'at', type: 'timestamp' }, { name: 'area', type: 'Area' }, { name: 'kind', type: 'string' }, { name: 'refTable', type: 'string?' }, { name: 'refId', type: 'number?' }, { name: 'milestone', type: 'boolean' }],
  links: [{ name: 'refTable/refId', label: 'about', to: '*', via: 'refTable', mode: 'ref' }],
  actions: [],
  functions: [{ name: 'ageDays', label: 'Age in days', run: async (o) => daysBetween(o.at.slice(0, 10), today()) }],
  automations: [],
})

const review = erase<Review>({
  key: 'Review', label: 'Review', table: 'reviews',
  title: (o) => `Week of ${o.weekOf}`,
  subtitle: (o) => o.wins.slice(0, 60),
  properties: [{ name: 'weekOf', type: 'date' }, { name: 'wins', type: 'string' }, { name: 'struggles', type: 'string' }, { name: 'focusNext', type: 'string' }, { name: 'ratings', type: 'Area->1-5' }],
  links: [],
  actions: [],
  functions: [{ name: 'avgRating', label: 'Average rating', run: async (o) => { const v = Object.values(o.ratings).filter((x): x is number => typeof x === 'number'); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0 } }],
  automations: [],
})

const budget = erase<Budget>({
  key: 'Budget', label: 'Budget', table: 'budgets',
  title: (o) => o.category,
  subtitle: (o) => `$${o.monthlyLimit}/mo`,
  properties: [{ name: 'category', type: 'string' }, { name: 'monthlyLimit', type: 'number' }],
  links: [],
  actions: [],
  functions: [{
    name: 'spentThisMonth', label: 'Spent this month',
    run: async (o) => { const m = today().slice(0, 7); return Math.round(-(await db.transactions.where('category').equals(o.category).filter((t) => t.date.slice(0, 7) === m && t.amount < 0).toArray()).reduce((s, t) => s + t.amount, 0)) },
  }],
  automations: [auto('budget-over')],
})

const habit = erase<Habit>({
  key: 'Habit', label: 'Habit', table: 'habits',
  title: (o) => o.name,
  subtitle: (o) => `${perWeekLabel(o.perWeek)} · ${o.area}${o.archived ? ' · archived' : ''}`,
  properties: [{ name: 'name', type: 'string' }, { name: 'area', type: 'Area' }, { name: 'perWeek', type: '1-7' }, { name: 'goalId', type: 'Goal.id?' }, { name: 'archived', type: 'boolean?' }],
  links: [{ name: 'goalId', label: 'supports', to: 'Goal', via: 'goalId', mode: 'fk' }],
  actions: [
    { id: 'check-in', label: 'Check in today', when: (o) => !o.archived, run: async (o) => { if (!(await db.habitLogs.where('[habitId+date]').equals([o.id!, today()]).first())) await toggleCheckIn(o, today()) } },
    { id: 'archive', label: 'Archive', when: (o) => !o.archived, run: (o) => archiveHabit(o, true) },
    { id: 'restore', label: 'Restore', when: (o) => !!o.archived, run: (o) => archiveHabit(o, false) },
  ],
  functions: [{
    name: 'streak', label: 'Current streak',
    run: async (o) => { const s = streak(new Set((await db.habitLogs.where('habitId').equals(o.id!).toArray()).map((l) => l.date)), today(), o.perWeek); return `${s.count} ${s.unit}${s.count === 1 ? '' : 's'}` },
  }],
  automations: [],
})

const habitLog = erase<HabitLog>({
  key: 'HabitLog', label: 'Habit check-in', table: 'habitLogs',
  title: (o) => `Check-in ${o.date}`,
  subtitle: (o) => o.date,
  properties: [{ name: 'habitId', type: 'Habit.id' }, { name: 'date', type: 'date' }],
  links: [{ name: 'habitId', label: 'checks in', to: 'Habit', via: 'habitId', mode: 'fk' }],
  actions: [],
  functions: [{ name: 'daysAgo', label: 'Days ago', run: async (o) => daysBetween(o.date, today()) }],
  automations: [],
})

const journalEntry = erase<JournalEntry>({
  key: 'JournalEntry', label: 'Journal entry', table: 'journal',
  // Titles never include the entry text.
  title: (o) => `Journal ${o.date}`,
  subtitle: (o) => `${wordCount(o.text)} words${o.mood ? ` · mood ${o.mood}` : ''}`,
  properties: [{ name: 'date', type: 'date' }, { name: 'text', type: 'string (private)' }, { name: 'mood', type: '1-5?' }, { name: 'energy', type: '1-5?' }, { name: 'tags', type: 'string[]?' }],
  links: [],
  actions: [],
  functions: [{ name: 'wordCount', label: 'Word count', run: async (o) => wordCount(o.text) }],
  automations: [],
})

const calendarEvent = erase<CalendarEvent>({
  key: 'CalendarEvent', label: 'Calendar event', table: 'calendar',
  title: (o) => o.title,
  subtitle: (o) => `${o.date} · ${timeLabel(o)}`,
  properties: [{ name: 'title', type: 'string' }, { name: 'date', type: 'date' }, { name: 'allDay', type: 'boolean' }, { name: 'start', type: 'HH:MM?' }, { name: 'end', type: 'HH:MM?' }, { name: 'location', type: 'string?' }],
  links: [],
  actions: [],
  functions: [{ name: 'daysUntil', label: 'Days until', run: async (o) => daysBetween(today(), o.date) }],
  automations: [],
})

export const TYPE_LIST: TypeDef[] = [goal, task, learning, budget, transaction, person, interaction, meal, review, lifeEvent, habit, habitLog, journalEntry, calendarEvent]
export const REGISTRY = Object.fromEntries(TYPE_LIST.map((t) => [t.key, t])) as Record<TypeKey, TypeDef>

export const typeForTable = (table: string): TypeDef | undefined => TYPE_LIST.find((t) => t.table === table)

export interface LinkGroup {
  link: LinkDef
  direction: 'out' | 'in'
  /** Type of the objects in this group. */
  type: TypeKey
  objects: Row[]
}

const LIMIT = 50

/** Linked objects in both directions: what this object points at, and what points at it. */
export async function resolveLinks(type: TypeKey, obj: Row): Promise<LinkGroup[]> {
  const def = REGISTRY[type]
  const groups: LinkGroup[] = []

  for (const link of def.links) {
    let targetType: TypeDef | undefined
    let objects: Row[] = []
    if (link.mode === 'fk') {
      targetType = REGISTRY[link.to as TypeKey]
      const id = obj[link.via]
      const found = typeof id === 'number' ? await db.table(targetType.table).get(id) : undefined
      objects = found ? [found] : []
    } else if (link.mode === 'category') {
      targetType = REGISTRY[link.to as TypeKey]
      objects = await db.table(targetType.table).where('category').equals(obj[link.via] as string).toArray()
    } else {
      targetType = typeof obj.refTable === 'string' ? typeForTable(obj.refTable) : undefined
      const found = targetType && typeof obj.refId === 'number' ? await db.table(targetType.table).get(obj.refId) : undefined
      objects = found ? [found] : []
    }
    if (targetType) groups.push({ link, direction: 'out', type: targetType.key, objects })
  }

  if (obj.id != null) {
    for (const src of TYPE_LIST) {
      for (const link of src.links) {
        let objects: Row[] = []
        if (link.mode === 'fk' && link.to === type) {
          objects = await db.table(src.table).where(link.via).equals(obj.id).limit(LIMIT).toArray()
        } else if (link.mode === 'category' && link.to === type) {
          objects = await db.table(src.table).where(link.via).equals(obj.category as string).limit(LIMIT).toArray()
        } else if (link.mode === 'ref' && src.key !== type) {
          objects = (await timelineFor({ table: def.table, id: obj.id }, LIMIT)) as unknown as Row[]
        } else continue
        groups.push({ link, direction: 'in', type: src.key, objects })
      }
    }
  }
  return groups
}

/** The events logged about an object, newest first. */
export async function timelineFor(ref: { table: string; id: number }, limit = 100): Promise<LifeEvent[]> {
  const rows = await db.events.filter((e) => e.refTable === ref.table && e.refId === ref.id).toArray()
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}
