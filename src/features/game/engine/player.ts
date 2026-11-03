// Pure: Snapshot -> PlayerState (minus `loading`). Memoized by snapshot identity so re-renders are free.
import type { ISODate } from '../../../db'
import type { PlayerState, SkillId, SkillState } from '../types'
import { SKILLS } from '../types'
import { deriveFull } from './derive'
import { levelInfo } from './levels'
import { generateQuests } from './quests'
import type { Snapshot } from './snapshot'

export type PlayerData = Omit<PlayerState, 'loading'>

const cache = new WeakMap<Snapshot, { today: ISODate; data: PlayerData }>()

export function buildPlayer(s: Snapshot, today: ISODate): PlayerData {
  const hit = cache.get(s)
  if (hit && hit.today === today) return hit.data
  const { gains, streak } = deriveFull(s, today)
  const total: Record<SkillId, number> = { body: 0, money: 0, mind: 0, career: 0, people: 0 }
  const todaySkill: Record<SkillId, number> = { body: 0, money: 0, mind: 0, career: 0, people: 0 }
  let all = 0
  let todayXp = 0
  for (const g of gains) {
    total[g.skill] += g.xp
    all += g.xp
    if (g.date === today) { todaySkill[g.skill] += g.xp; todayXp += g.xp }
  }
  const skills: SkillState[] = SKILLS.map((k) => ({ ...k, ...levelInfo(total[k.id]), todayXp: todaySkill[k.id] }))
  const quests = s.calm ? [] : generateQuests(s, today, gains)
  const questsDone = quests.filter((q) => q.done).length
  const data: PlayerData = {
    ...levelInfo(all),
    calm: s.calm,
    skills,
    quests,
    questsDone,
    cleared: quests.length > 0 && questsDone === quests.length,
    streak: { target: streak.target, daysThisWeek: streak.daysThisWeek, weekDots: streak.weekDots, restTokens: streak.restTokens, weeksInRow: streak.weeksInRow },
    todayXp,
    recent: s.calm ? [] : gains.slice(-20).reverse().map(({ id, at, skill, xp, reason }) => ({ id, at, skill, xp, reason })),
  }
  cache.set(s, { today, data })
  return data
}
