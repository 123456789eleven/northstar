// Turns Interview answers into real records through the same write paths the pages use. Safe to run repeatedly:
// goals, habits, people and learning items are de-duplicated by name, holdings and settings are upserted.
import { db, setSetting } from '../../db'
import { money, today } from '../../lib/dates'
import { applyFoodTargets, logWeight, saveBodySetting, validWeight } from '../body/bodyData'
import { addGoal, addHabit, addLearning, addPerson } from '../onboarding/setupActions'
import { CADENCE_DAYS, isAnswered, lines, type Answers } from './questions'

const num = (v: Answers[string] | undefined): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined)
const str = (v: Answers[string] | undefined): string => (typeof v === 'string' ? v.trim() : '')
const ISO = /^\d{4}-\d{2}-\d{2}$/

export async function applyAnswers(a: Answers): Promise<string[]> {
  const done: string[] = []

  const height = num(a.height)
  if (height) { await saveBodySetting('height', height); done.push('Height saved') }
  const goal = num(a.goalWeight)
  if (goal && validWeight(goal)) { await saveBodySetting('goal', goal); done.push(`Weight goal ${goal} lb`) }
  const weight = num(a.weight)
  if (weight && validWeight(weight)) {
    await saveBodySetting('startWeight', weight)
    if (!(await db.weights.where('date').equals(today()).count())) { await logWeight(today(), weight); done.push(`First weigh-in logged: ${weight} lb`) }
  }
  const train = num(a.trainDays)
  if (train) {
    const days = Math.min(7, Math.round(train))
    await saveBodySetting('trainDays', days)
    if ((await addHabit({ name: 'Lift', area: 'health', perWeek: days })) === 'added') done.push(`Lift habit, ${days} days a week`)
  }
  const calories = num(a.calories)
  const protein = num(a.protein)
  if (calories || protein) { await applyFoodTargets({ ...(calories ? { calories } : {}), ...(protein ? { protein } : {}) }); done.push('Food targets set') }

  const wk = num(a.weekTarget)
  if (wk) { await setSetting('game.weekTarget', Math.min(7, Math.max(1, Math.round(wk)))); done.push('Weekly streak target set') }

  const role = str(a.targetRole)
  if (role) {
    const by = str(a.targetBy)
    if ((await addGoal(`Become ${role}`, 'year', 'career', ISO.test(by) ? by : undefined)) === 'added') done.push(`Goal: Become ${role}`)
  }
  const skills = lines(a.careerSkills, 6)
  let learned = 0
  for (const s of skills) if ((await addLearning(s, 'skill')) === 'added') learned++
  if (learned) done.push(`${learned} learning item${learned === 1 ? '' : 's'}`)

  const emergency = num(a.emergency)
  if (emergency && (await addGoal(`Emergency fund of ${money(emergency)}`, 'year', 'finance')) === 'added') done.push('Goal: emergency fund')

  const shares = num(a.vtiShares)
  if (shares) {
    const account = str(a.vtiAccount) || 'Roth IRA'
    const price = num(a.vtiPrice)
    const row = (await db.holdings.where('ticker').equals('VTI').toArray()).find((h) => h.account === account)
    if (row) await db.holdings.update(row.id!, { shares, ...(price ? { price, priceDate: today() } : {}) })
    else await db.holdings.add({ account, ticker: 'VTI', shares, ...(price ? { price, priceDate: today() } : {}) })
    done.push(`VTI: ${shares} shares in ${account}`)
  }

  const days = CADENCE_DAYS[str(a.cadence)] ?? 30
  let people = 0
  for (const n of lines(a.circle, 5)) if ((await addPerson({ name: n, relation: 'Friend', cadenceDays: days })) === 'added') people++
  const sponsor = str(a.sponsor)
  if (sponsor && (await addPerson({ name: sponsor, relation: 'Mentor', cadenceDays: 30 })) === 'added') people++
  if (people) done.push(`${people} ${people === 1 ? 'person' : 'people'} added`)

  return done
}

export const hasAnything = (a: Answers) => Object.values(a).some(isAnswered)
