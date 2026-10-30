// Northstar data layer. Everything lives on-device in IndexedDB — nothing leaves the browser.
// Every module writes its own tables and also calls logEvent() so History stays a single timeline.
import Dexie, { type EntityTable } from 'dexie'

export type Area = 'career' | 'health' | 'finance' | 'learning' | 'relationships' | 'personal'
export const AREAS: Area[] = ['career', 'health', 'finance', 'learning', 'relationships', 'personal']

/** ISO date string, YYYY-MM-DD (local time). */
export type ISODate = string
/** ISO timestamp string. */
export type ISOTime = string

export interface Task {
  id?: number
  title: string
  notes?: string
  due?: ISODate
  priority: 1 | 2 | 3 // 1 = high
  status: 'open' | 'done'
  doneAt?: ISOTime
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  /** Original day-of-month for monthly tasks (31 stays 31 after a short month clamps it). */
  recurDay?: number
  goalId?: number
  /** Pinned into today's top 3. Stores the date it was pinned for. */
  focusDate?: ISODate
  createdAt: ISOTime
}

export interface Milestone {
  id: string
  title: string
  done: boolean
}

export interface Goal {
  id?: number
  title: string
  area: Area
  horizon: 'life' | 'year' | 'quarter'
  parentId?: number
  why?: string
  targetDate?: ISODate
  status: 'active' | 'done' | 'paused'
  milestones: Milestone[]
  createdAt: ISOTime
  completedAt?: ISOTime
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Meal {
  id?: number
  date: ISODate
  slot: MealSlot
  name: string
  calories?: number
  protein?: number
  notes?: string
}

export interface FavoriteMeal {
  id?: number
  name: string
  slot?: MealSlot
  calories?: number
  protein?: number
  uses: number
}

export interface Transaction {
  id?: number
  date: ISODate
  /** Negative = money out, positive = money in. */
  amount: number
  description: string
  category: string
  account?: string
  importBatch?: string
}

export interface Budget {
  id?: number
  category: string
  monthlyLimit: number
}

export interface BalanceSnapshot {
  id?: number
  date: ISODate
  name: string
  kind: 'asset' | 'liability'
  balance: number
}

export interface LearningItem {
  id?: number
  title: string
  kind: 'course' | 'certification' | 'book' | 'skill'
  provider?: string
  url?: string
  status: 'planned' | 'active' | 'done'
  /** 0–100 */
  progress: number
  goalId?: number
  startedAt?: ISODate
  completedAt?: ISODate
  createdAt: ISOTime
}

export interface StudySession {
  id?: number
  itemId: number
  date: ISODate
  minutes: number
  note?: string
}

export interface Person {
  id?: number
  name: string
  relation: string
  /** Desired days between contacts; 0 = no reminder. */
  cadenceDays: number
  lastContact?: ISODate
  /** MM-DD */
  birthday?: string
  notes?: string
}

export interface Interaction {
  id?: number
  personId: number
  date: ISODate
  kind: 'call' | 'text' | 'in-person' | 'other'
  note?: string
}

export interface LifeEvent {
  id?: number
  at: ISOTime
  area: Area | 'tasks' | 'food'
  kind: string
  title: string
  refTable?: string
  refId?: number
  /** String reference for things keyed by a string id (e.g. a CSV import batch). */
  refKey?: string
  /** Shown on the Achievements wall. */
  milestone: boolean
}

export interface Review {
  id?: number
  /** Monday of the reviewed week. */
  weekOf: ISODate
  wins: string
  struggles: string
  focusNext: string
  /** 1–5 per area */
  ratings: Partial<Record<Area, number>>
  createdAt: ISOTime
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('northstar') as Dexie & {
  tasks: EntityTable<Task, 'id'>
  goals: EntityTable<Goal, 'id'>
  meals: EntityTable<Meal, 'id'>
  favoriteMeals: EntityTable<FavoriteMeal, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  budgets: EntityTable<Budget, 'id'>
  balances: EntityTable<BalanceSnapshot, 'id'>
  learning: EntityTable<LearningItem, 'id'>
  studySessions: EntityTable<StudySession, 'id'>
  people: EntityTable<Person, 'id'>
  interactions: EntityTable<Interaction, 'id'>
  events: EntityTable<LifeEvent, 'id'>
  reviews: EntityTable<Review, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  tasks: '++id, status, due, goalId, focusDate, doneAt',
  goals: '++id, status, area, horizon, parentId',
  meals: '++id, date, slot',
  favoriteMeals: '++id, name, uses',
  transactions: '++id, date, category, importBatch',
  budgets: '++id, &category',
  balances: '++id, date, name',
  learning: '++id, status, kind, goalId',
  studySessions: '++id, itemId, date',
  people: '++id, name, lastContact',
  interactions: '++id, personId, date',
  events: '++id, at, area, milestone',
  reviews: '++id, &weekOf',
  settings: '&key',
})

export async function logEvent(e: Omit<LifeEvent, 'id' | 'at' | 'milestone'> & { at?: ISOTime; milestone?: boolean }) {
  return db.events.add({ milestone: false, at: new Date().toISOString(), ...e })
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return (row?.value as T) ?? fallback
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

// v2: drop the 'milestone' index on events — booleans aren't valid IndexedDB keys, so it never matched.
db.version(2).stores({
  events: '++id, at, area',
})
