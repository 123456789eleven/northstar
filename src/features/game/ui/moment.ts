// Which one-second moment (if any) a change in player state earns. Pure, so it is unit-tested (moment.test.ts).
import type { PlayerState } from '../types'

export interface Moment { id: number; kicker: string; title: string; sub: string }
export interface Base { level: number; skills: Record<string, number>; cleared: boolean }

/** No baseline (first loaded state) or Calm mode = never. Priority: level-up, skill-up, day cleared. */
export function momentFor(b: Base | null, p: Pick<PlayerState, 'level' | 'skills' | 'cleared' | 'calm'>): Omit<Moment, 'id'> | null {
  if (!b || p.calm) return null
  const skill = p.skills.find((s) => s.level > (b.skills[s.id] ?? s.level))
  if (p.level > b.level) return { kicker: 'Level up', title: `Level ${p.level}`, sub: skill ? `${skill.label} reached level ${skill.level}` : 'Your constellation grew brighter' }
  if (skill) return { kicker: 'Skill up', title: `${skill.label} ${skill.level}`, sub: `${skill.label} reached level ${skill.level}` }
  if (p.cleared && !b.cleared) return { kicker: 'Day cleared', title: 'Every quest done', sub: 'Anything else today is a bonus' }
  return null
}

