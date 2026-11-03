// The engine's input: plain arrays read from Dexie. Read-only: nothing in the engine writes to the database.
import {
  db, getSetting, type BalanceSnapshot, type Budget, type Goal, type Habit, type HabitLog, type Interaction, type JournalEntry,
  type LearningItem, type LifeEvent, type Meal, type Person, type Review, type StudySession, type Task, type Transaction, type WeightEntry,
} from '../../../db'
import { TARGETS_KEY, type FoodTargets } from '../../food/foodData'
import { parseGameSettings, type GameSettings } from '../gameSettings'

export interface Snapshot {
  tasks: Task[]
  goals: Goal[]
  habits: Habit[]
  habitLogs: HabitLog[]
  weights: WeightEntry[]
  meals: Meal[]
  targets: FoodTargets
  journal: JournalEntry[]
  people: Person[]
  interactions: Interaction[]
  learning: LearningItem[]
  studySessions: StudySession[]
  transactions: Transaction[]
  budgets: Budget[]
  balances: BalanceSnapshot[]
  events: LifeEvent[]
  reviews: Review[]
  /** Active days per week needed (setting game.weekTarget). */
  weekTarget: number
  calm: boolean
}

export const emptySnapshot = (): Snapshot => ({
  tasks: [], goals: [], habits: [], habitLogs: [], weights: [], meals: [], targets: {}, journal: [], people: [], interactions: [],
  learning: [], studySessions: [], transactions: [], budgets: [], balances: [], events: [], reviews: [], weekTarget: 5, calm: false,
})

/** Event kinds the engine reads; filtering here keeps the rest of the timeline out of memory. */
const EVENT_KIND = /^(win|career\.win|workout\.logged|tx\.categorize|finance\.import|goal\.milestone|focus\..*)$/

export async function loadSnapshot(): Promise<Snapshot> {
  const [tasks, goals, habits, habitLogs, weights, meals, targets, journal, people, interactions, learning, studySessions, transactions, budgets, balances, events, reviews, settingRows] =
    await Promise.all([
      db.tasks.toArray(), db.goals.toArray(), db.habits.toArray(), db.habitLogs.toArray(), db.weights.toArray(), db.meals.toArray(),
      getSetting<FoodTargets>(TARGETS_KEY, {}), db.journal.toArray(), db.people.toArray(), db.interactions.toArray(), db.learning.toArray(),
      db.studySessions.toArray(), db.transactions.toArray(), db.budgets.toArray(), db.balances.toArray(),
      db.events.filter((e) => EVENT_KIND.test(e.kind)).toArray(), db.reviews.toArray(),
      db.settings.where('key').startsWith('game.').toArray(),
    ])
  const g: GameSettings = parseGameSettings(Object.fromEntries(settingRows.map((r) => [r.key, r.value])))
  return {
    tasks, goals, habits, habitLogs, weights, meals, targets: targets ?? {}, journal, people, interactions, learning, studySessions,
    transactions, budgets, balances, events, reviews, weekTarget: g.weekTarget, calm: g.calm,
  }
}
