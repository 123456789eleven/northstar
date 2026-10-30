// Optional demo dataset: a clearly fictional ~3-month life, dates relative to today so it never looks stale.
// Everything is inserted in ONE transaction inside withSyncSuppressed (never queued for sync). The id of every
// inserted row is recorded in the device-local setting `demo.ids`, so removal deletes exactly those rows.
import { db, type Area, type Goal, type LifeEvent, type Task } from '../db'
import { addDays, startOfWeek, today } from './dates'
import { withSyncSuppressed } from '../sync/outbox'

export const DEMO_KEY = 'demo.ids'

export interface DemoRecord {
  at: string
  ids: Record<string, number[]>
}

/** Tables a person fills by hand; used to tell whether real data already exists. */
const USER_TABLES = ['tasks', 'goals', 'habits', 'transactions', 'meals', 'people', 'journal', 'learning', 'calendar', 'reviews'] as const

export async function getDemoRecord(): Promise<DemoRecord | null> {
  const row = await db.settings.get(DEMO_KEY)
  return (row?.value as DemoRecord | undefined) ?? null
}

/** True when there is data that is not part of the demo set. */
export async function hasUserData(): Promise<boolean> {
  const rec = await getDemoRecord()
  for (const t of USER_TABLES) {
    if ((await db.table(t).count()) > (rec?.ids[t]?.length ?? 0)) return true
  }
  return false
}

// Small deterministic generator so the demo is stable between loads.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
const at = (date: string, hhmm = '12:00') => new Date(`${date}T${hhmm}:00`).toISOString()
const dom = (date: string) => Number(date.slice(8, 10))

/** Adds the demo set. Returns false (and changes nothing) if it is already loaded. */
export async function loadDemo(): Promise<boolean> {
  return withSyncSuppressed(db, () =>
    db.transaction('rw', db.tables, async () => {
      if (await getDemoRecord()) return false
      const t0 = today()
      const d = (n: number) => addDays(t0, n)
      const ids: Record<string, number[]> = {}
      const add = async <T extends object>(table: string, rows: T[]): Promise<number[]> => {
        const out = (await db.table(table).bulkAdd(rows as never[], { allKeys: true })) as number[]
        ids[table] = [...(ids[table] ?? []), ...out]
        return out
      }
      const events: Omit<LifeEvent, 'id'>[] = []
      const ev = (date: string, area: LifeEvent['area'], kind: string, title: string, refTable?: string, refId?: number, milestone = false, refKey?: string) =>
        events.push({ at: at(date), area, kind, title, refTable, refId, refKey, milestone })
      const created = at(d(-85))

      // Goals: two chains (life -> year -> quarter) plus one finished quarter goal.
      const ms = (...t: [string, boolean][]) => t.map(([title, done], i) => ({ id: `m${i + 1}`, title, done }))
      const goalRows: Omit<Goal, 'id'>[] = [
        { title: 'Lead a benefits team', area: 'career', horizon: 'life', why: 'Shape how a team supports people through hard transitions.', status: 'active', milestones: [], createdAt: created },
        { title: 'Move into a team lead role', area: 'career', horizon: 'year', targetDate: d(150), status: 'active', milestones: ms(['Shadow a team lead for a month', true], ['Lead one process improvement', false], ['Apply for a lead opening', false]), createdAt: created },
        { title: 'Earn the compliance certification', area: 'career', horizon: 'quarter', targetDate: d(40), status: 'active', milestones: ms(['Finish the core modules', true], ['Pass the practice exam', false], ['Book the exam', false]), createdAt: created },
        { title: 'Stay healthy and rested', area: 'health', horizon: 'life', status: 'active', milestones: [], createdAt: created },
        { title: 'Run a 10k in the spring', area: 'health', horizon: 'year', targetDate: d(120), status: 'active', milestones: ms(['Run 5k without stopping', true], ['Run 8k', false], ['Register for a race', false]), createdAt: created },
        { title: 'Run three times a week', area: 'health', horizon: 'quarter', targetDate: d(35), status: 'active', milestones: ms(['Two weeks in a row', true], ['Four weeks in a row', false]), createdAt: created },
        { title: 'Learn the new case-tracking tool', area: 'career', horizon: 'quarter', status: 'done', milestones: ms(['Complete training', true], ['Handle ten cases alone', true]), createdAt: created, completedAt: at(d(-30)) },
      ]
      const [gLife, gYear, gCert, gHealth, gRun10, gRun3, gTool] = await add('goals', goalRows)
      await db.goals.update(gYear, { parentId: gLife })
      await db.goals.update(gCert, { parentId: gYear })
      await db.goals.update(gTool, { parentId: gYear })
      await db.goals.update(gRun10, { parentId: gHealth })
      await db.goals.update(gRun3, { parentId: gRun10 })
      ev(d(-60), 'career', 'goal.milestone', 'Finish the core modules (Earn the compliance certification)', 'goals', gCert)
      ev(d(-45), 'health', 'goal.milestone', 'Two weeks in a row (Run three times a week)', 'goals', gRun3)
      ev(d(-30), 'career', 'goal.done', 'Learn the new case-tracking tool', 'goals', gTool, true)

      // Tasks
      const T = (title: string, due: string | undefined, priority: Task['priority'], extra: Partial<Task> = {}): Omit<Task, 'id'> => ({
        title, due, priority, status: 'open', recurrence: 'none', createdAt: at(d(-20)), ...extra,
      })
      const done = (title: string, ago: number, extra: Partial<Task> = {}) =>
        T(title, d(-ago), 2, { status: 'done', doneAt: at(d(-ago), '16:30'), ...extra })
      const taskRows: Omit<Task, 'id'>[] = [
        T('Reconcile open election notices', d(-3), 1, { goalId: gCert }),
        T('Reply to Priya about the carrier question', d(-1), 2),
        T('Renew car registration', d(-5), 2),
        T('Send the monthly status report', d(0), 1, { recurrence: 'monthly', recurDay: dom(d(0)) }),
        T('Study session: election timelines', d(0), 2, { goalId: gCert }),
        T('Update the process checklist', d(1), 2, { goalId: gYear }),
        T('Practice exam, section 2', d(3), 1, { goalId: gCert }),
        T('Book dentist appointment', d(2), 3),
        T('Run, easy 5k', d(1), 2, { goalId: gRun3, recurrence: 'weekly' }),
        T('Water the plants', d(0), 3, { recurrence: 'weekly' }),
        T('Review the week and plan the next', d(2), 2, { recurrence: 'weekly' }),
        T('Draft a one-page proposal for a faster intake process', d(8), 1, { goalId: gYear }),
        T('Ask Sam for feedback on my last presentation', d(5), 2, { goalId: gYear }),
        T('Pay the credit card', d(4), 1, { recurrence: 'monthly', recurDay: dom(d(4)) }),
        T('Meal prep for Monday', d(2), 3),
        T('Register for the 10k', d(14), 2, { goalId: gRun10 }),
        T('Clean out the inbox', d(-2), 3),
        T('Call the insurance agent about renters coverage', d(6), 3),
        T('Read two chapters of the leadership book', d(3), 3),
        T('Plan a weekend trip', undefined, 3),
        T('Organize the shared compliance folder', undefined, 3, { goalId: gYear }),
        done('Submit quarterly audit sample', 1, { goalId: gCert }),
        done('Schedule the practice exam', 6, { goalId: gCert }),
        done('Buy running shoes', 12, { goalId: gRun3 }),
        done('Back up the laptop', 20),
      ]
      const tids = await add('tasks', taskRows)
      for (const i of [21, 22, 23, 24]) ev(taskRows[i].due!, 'tasks', 'task.done', taskRows[i].title, 'tasks', tids[i])

      // Habits and six weeks of check-ins
      const habitRows = [
        { name: 'Walk 20 minutes', area: 'health' as Area, perWeek: 5, createdAt: at(d(-45)) },
        { name: 'Study for 30 minutes', area: 'learning' as Area, perWeek: 4, goalId: gCert, createdAt: at(d(-45)) },
        { name: "Write down tomorrow's top 3", area: 'career' as Area, perWeek: 5, createdAt: at(d(-45)) },
        { name: 'Read before bed', area: 'personal' as Area, perWeek: 7, createdAt: at(d(-45)) },
      ]
      const hids = await add('habits', habitRows)
      const r = rng(7)
      const hl: { habitId: number; date: string }[] = []
      const rate = [0.7, 0.6, 0.65, 0.45]
      hids.forEach((habitId, i) => {
        for (let n = 0; n < 42; n++) if (r() < rate[i] + (n < 14 ? 0.15 : 0)) hl.push({ habitId, date: d(-n) })
      })
      await add('habitLogs', hl)
      ev(d(-20), 'health', 'habit.streak', 'Walk 20 minutes: 7-day streak', 'habits', hids[0], true, 'demo-streak')

      // Transactions
      const tx: { date: string; amount: number; description: string; category: string; account: string }[] = []
      const T1 = (n: number, amount: number, description: string, category: string, account = 'Checking') => tx.push({ date: d(-n), amount, description, category, account })
      for (let k = 0; k < 7; k++) T1(2 + k * 14, 2450, 'Paycheck', 'Income')
      for (let k = 0; k < 3; k++) {
        T1(3 + k * 30, -1380, 'Rent', 'Housing')
        T1(8 + k * 30, -95, 'Electric and internet', 'Utilities')
        T1(10 + k * 30, -15.99, 'Streaming service', 'Subscriptions')
        T1(12 + k * 30, -11.5, 'Music subscription', 'Subscriptions')
        T1(15 + k * 30, -120, 'Gym membership', 'Health', 'Credit card')
        T1(20 + k * 30, -200, 'Transfer to savings', 'Savings')
      }
      const shops: [string, string, number, number][] = [
        ['Grocery store', 'Groceries', 28, 95], ['Corner cafe', 'Dining', 6, 18], ['Pizza night', 'Dining', 20, 45],
        ['Fuel', 'Transport', 30, 55], ['Pharmacy', 'Health', 8, 30], ['Bookshop', 'Shopping', 12, 40], ['Ride share', 'Transport', 10, 24],
      ]
      const rr = rng(21)
      while (tx.length < 82) {
        const s = shops[Math.floor(rr() * shops.length)]
        const amt = -Math.round((s[2] + rr() * (s[3] - s[2])) * 100) / 100
        T1(Math.floor(rr() * 88), amt, s[0], s[1], rr() < 0.4 ? 'Credit card' : 'Checking')
      }
      await add('transactions', tx)

      const existing = new Set((await db.budgets.toArray()).map((b) => b.category))
      const bRows = [{ category: 'Dining', monthlyLimit: 250 }, { category: 'Groceries', monthlyLimit: 450 }].filter((b) => !existing.has(b.category))
      if (bRows.length) {
        const bids = await add('budgets', bRows)
        ev(d(-60), 'finance', 'finance.budget', `Set first budget: ${bRows[0].category} $${bRows[0].monthlyLimit}/mo`, 'budgets', bids[0])
      }
      const bal = (n: number, name: string, kind: 'asset' | 'liability', balance: number) => ({ date: d(-n), name, kind, balance })
      const balIds = await add('balances', [
        bal(60, 'Checking', 'asset', 3100), bal(30, 'Checking', 'asset', 3550), bal(0, 'Checking', 'asset', 4020),
        bal(60, 'Savings', 'asset', 5200), bal(30, 'Savings', 'asset', 5600), bal(0, 'Savings', 'asset', 6050),
        bal(60, 'Credit card', 'liability', 1400), bal(30, 'Credit card', 'liability', 980), bal(0, 'Credit card', 'liability', 760),
      ])
      ev(d(0), 'finance', 'finance.networth-high', 'New net worth high: $9,310', 'balances', balIds[8], true)

      // Meals: 14 days
      const menu: Record<string, [string, number, number][]> = {
        breakfast: [['Oatmeal with berries', 320, 12], ['Greek yogurt and granola', 280, 18], ['Eggs and toast', 350, 20]],
        lunch: [['Chicken grain bowl', 540, 38], ['Turkey sandwich', 460, 28], ['Lentil soup and bread', 430, 22]],
        dinner: [['Salmon, rice and greens', 620, 42], ['Veggie stir fry with tofu', 510, 26], ['Pasta with turkey meatballs', 680, 40], ['Sheet-pan chicken and vegetables', 560, 44]],
        snack: [['Apple and peanut butter', 210, 6], ['Cheese and crackers', 190, 8]],
      }
      const meals: { date: string; slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'; name: string; calories: number; protein: number }[] = []
      for (let n = 0; n < 14; n++) {
        for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
          if (slot === 'snack' && n % 2) continue
          const opts = menu[slot]
          const [name, calories, protein] = opts[(n * 3 + slot.length) % opts.length]
          meals.push({ date: d(-n), slot, name, calories, protein })
        }
      }
      await add('meals', meals)
      await add('favoriteMeals', [
        { name: 'Oatmeal with berries', slot: 'breakfast', calories: 320, protein: 12, uses: 9 },
        { name: 'Chicken grain bowl', slot: 'lunch', calories: 540, protein: 38, uses: 7 },
        { name: 'Salmon, rice and greens', slot: 'dinner', calories: 620, protein: 42, uses: 5 },
        { name: 'Apple and peanut butter', slot: 'snack', calories: 210, protein: 6, uses: 6 },
      ])

      // Learning
      const lids = await add('learning', [
        { title: 'Compliance certification', kind: 'certification', provider: 'Industry association', status: 'active', progress: 55, goalId: gCert, startedAt: d(-60), createdAt: at(d(-60)) },
        { title: 'Leading without authority', kind: 'course', provider: 'Online course', status: 'active', progress: 30, goalId: gYear, startedAt: d(-30), createdAt: at(d(-30)) },
        { title: 'Spreadsheet analysis for operations', kind: 'skill', status: 'planned', progress: 0, createdAt: at(d(-10)) },
        { title: 'Crucial Conversations', kind: 'book', status: 'done', progress: 100, startedAt: d(-80), completedAt: d(-40), createdAt: at(d(-80)) },
      ])
      const sess: { itemId: number; date: string; minutes: number; note?: string }[] = []
      for (let n = 1; n < 40; n += 3 + (n % 3)) sess.push({ itemId: lids[n % 2], date: d(-n), minutes: 25 + (n % 4) * 10, note: n % 5 === 0 ? 'Reviewed notes' : undefined })
      await add('studySessions', sess)
      ev(d(-60), 'learning', 'learning-started', 'Started Compliance certification', 'learning', lids[0])
      ev(d(-40), 'learning', 'learning-done', 'Finished Crucial Conversations', 'learning', lids[3], true)

      // People
      const P = (name: string, relation: string, cadenceDays: number, birthday?: string, notes?: string) => ({ name, relation, cadenceDays, birthday, notes })
      const pids = await add('people', [
        P('Sam', 'Manager', 14, undefined, 'Weekly one-on-one on Thursdays.'),
        P('Priya', 'Coworker', 21, '03-14'),
        P('Marcus', 'Mentor', 30, undefined, 'Ask about moving into leadership.'),
        P('Elena', 'Sister', 7, '09-02'),
        P('Dad', 'Family', 10),
        P('Jordan', 'Close friend', 14, '11-21'),
        P('Aisha', 'Friend', 30),
        P('Tom', 'Former coworker', 60),
      ])
      type Kind = 'call' | 'text' | 'in-person' | 'other'
      const raw: [number, number, Kind, string?][] = [
        [0, 4, 'in-person', 'One-on-one: talked about stretch projects'], [0, 18, 'in-person'], [1, 9, 'text'], [1, 33, 'in-person', 'Lunch'],
        [2, 26, 'call', 'Got advice on the lead application'], [3, 2, 'call'], [3, 8, 'text'], [4, 15, 'call'],
        [5, 5, 'in-person', 'Dinner'], [5, 21, 'text'], [6, 52, 'text'], [7, 80, 'other', 'Sent a note'],
      ]
      const inter = raw.map(([p, ago, kind, note]) => ({ personId: pids[p], date: d(-ago), kind, note }))
      await add('interactions', inter)
      for (const pid of pids) {
        const last = inter.filter((i) => i.personId === pid).map((i) => i.date).sort().pop()
        if (last) await db.people.update(pid, { lastContact: last })
      }

      // Journal
      const jt: [number, number, number, string, string[]][] = [
        [1, 4, 3, 'Good one-on-one with Sam. Feeling clearer about what a lead needs to show.', ['work']],
        [3, 3, 3, 'Slow day, a pile of notices. Took a walk at lunch and it helped.', ['work', 'health']],
        [5, 5, 4, 'Ran 5k without stopping. Dinner with Jordan.', ['health']],
        [8, 2, 2, 'Rough night of sleep. Kept the day small.', []],
        [11, 4, 4, 'Finished the core modules. Small win, worth noting.', ['learning']],
        [14, 3, 3, 'Quiet weekend. Cleaned up the budget.', ['money']],
        [19, 4, 3, 'Called Elena. We should plan the trip.', ['family']],
        [26, 3, 4, 'Marcus gave a useful frame: show the work before the title.', ['work']],
        [33, 2, 2, 'Behind on tasks. Re-prioritized and cut two things.', ['work']],
        [41, 4, 4, 'First week of the walking habit. It felt easy.', ['health']],
      ]
      const jids = await add('journal', jt.map(([n, mood, energy, text, tags]) => ({ date: d(-n), mood, energy, text, tags, createdAt: at(d(-n), '21:00') })))
      jids.slice(0, 5).forEach((id, i) => ev(d(-jt[i][0]), 'personal', 'journal.entry', 'Journal entry', 'journal', id, false, d(-jt[i][0])))

      // Calendar: this and next week
      const w = startOfWeek(t0)
      const C = (off: number, title: string, start?: string, end?: string, location?: string) => ({ title, date: addDays(w, off), start, end, allDay: !start, location })
      await add('calendar', [
        C(0, 'Team standup', '09:30', '09:45'), C(0, 'Intake process review', '14:00', '15:00'), C(1, 'Team standup', '09:30', '09:45'),
        C(1, 'Study block', '12:30', '13:15'), C(2, 'Team standup', '09:30', '09:45'), C(2, 'Lunch with Priya', '12:00', '13:00', 'Cafe on 5th'),
        C(3, 'One-on-one with Sam', '10:00', '10:30'), C(3, 'Run with Jordan', '18:00', '19:00'), C(4, 'Month-end reporting', '13:00', '14:30'),
        C(5, 'Farmers market', '10:00', '11:00'), C(7, 'Team standup', '09:30', '09:45'), C(8, 'Practice exam, section 2', '18:30', '20:00'),
        C(9, 'Dentist', '08:15', '09:00'), C(10, 'One-on-one with Sam', '10:00', '10:30'), C(11, 'Call with Marcus', '17:30', '18:00'),
        C(12, 'Elena visits'),
      ])

      // Review (the weekly review is unique per week: skip if the user already has one)
      const weekOf = addDays(w, -7)
      if (!(await db.reviews.where('weekOf').equals(weekOf).first())) {
        const [rid] = await add('reviews', [{ weekOf, wins: 'Finished the core modules. Ran three times.', struggles: 'Too many meetings Wednesday and Thursday.', focusNext: 'Practice exam, section 2. One concrete process proposal.', ratings: { career: 4, health: 4, finance: 3, learning: 4, relationships: 3, personal: 3 }, createdAt: at(addDays(w, -1), '18:00') }])
        ev(addDays(w, -1), 'personal', 'review.done', `Reviewed the week of ${weekOf}`, 'reviews', rid)
      }

      // Manual wins on the timeline
      ev(d(-70), 'career', 'win', 'Handled my first escalated case alone', undefined, undefined, true)
      ev(d(-12), 'personal', 'manual', 'Paid the credit card down by $600')

      await add('events', events)
      await db.settings.put({ key: DEMO_KEY, value: { at: new Date().toISOString(), ids } satisfies DemoRecord })
      return true
    }),
  )
}

/** Deletes exactly the rows the demo inserted (and anything that hangs off them). Returns rows removed. */
export async function removeDemo(): Promise<number> {
  return withSyncSuppressed(db, () =>
    db.transaction('rw', db.tables, async () => {
      const rec = await getDemoRecord()
      if (!rec) return 0
      const ids = rec.ids
      let n = 0
      // Rows the user attached to demo rows.
      const by = async (table: string, field: string, parents: number[] | undefined) => {
        if (!parents?.length) return
        const keys = (await db.table(table).where(field).anyOf(parents).primaryKeys()) as number[]
        ids[table] = [...new Set([...(ids[table] ?? []), ...keys])]
      }
      await by('habitLogs', 'habitId', ids.habits)
      await by('interactions', 'personId', ids.people)
      await by('studySessions', 'itemId', ids.learning)
      // Events produced by activity on demo rows.
      const evKeys = new Set(ids.events ?? [])
      for (const e of await db.events.toArray()) {
        if (e.refTable && e.refId != null && ids[e.refTable]?.includes(e.refId)) evKeys.add(e.id!)
      }
      ids.events = [...evKeys]
      for (const [table, keys] of Object.entries(ids)) {
        if (!keys.length) continue
        await db.table(table).bulkDelete(keys)
        n += keys.length
      }
      await db.settings.delete(DEMO_KEY)
      return n
    }),
  )
}

export async function demoCounts(): Promise<{ loadedAt: string; rows: number } | null> {
  const rec = await getDemoRecord()
  if (!rec) return null
  return { loadedAt: rec.at, rows: Object.values(rec.ids).reduce((a, k) => a + k.length, 0) }
}
