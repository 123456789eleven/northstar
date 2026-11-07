// Honest pace copy for the weight path. Pure: numbers in, one plain sentence out.
import { HEALTHY_RATE } from './model'

const lb = (n: number) => (Math.round(Math.abs(n) * 10) / 10).toFixed(1)

export interface PaceInput {
  /** Signed lb per week over the last 4 weeks, null when there is too little data. */
  rate: number | null
  current: number
  goal: number
  /** lb per week needed to land on the goal date, null when there is no future goal date. */
  neededRate: number | null
  /** Human date fragment when the current pace reaches the goal, e.g. "about Mar 3". */
  projected?: string
}

export function paceNote({ rate, current, goal, neededRate, projected }: PaceInput): { tone: 'ok' | 'slow' | 'flat' | 'idle' | 'done'; text: string } {
  const dir = Math.sign(goal - current)
  if (dir === 0 || Math.abs(goal - current) < 0.05) return { tone: 'done', text: 'At goal weight.' }
  if (rate == null) return { tone: 'idle', text: 'Two weeks of weigh-ins will show your pace.' }
  const toward = rate * dir
  const verb = dir > 0 ? 'Gaining' : 'Losing'
  if (toward < 0.1) {
    const need = neededRate ? ` Reaching ${goal} lb by your date needs ${lb(neededRate)} lb/wk.` : ''
    return { tone: 'flat', text: `Trend is flat or moving away: ${rate > 0 ? '+' : rate < 0 ? '-' : ''}${lb(rate)} lb/wk.${need}` }
  }
  const when = projected ? ` ${goal} lb ${projected}.` : ''
  if (neededRate && toward < neededRate * 0.85) {
    return { tone: 'slow', text: `${verb} ${lb(rate)} lb/wk.${when} Your date needs ${lb(neededRate)} lb/wk.` }
  }
  const fast = toward > HEALTHY_RATE + 0.5 ? ` That is faster than the ${HEALTHY_RATE} lb/wk guide.` : ''
  return { tone: 'ok', text: `${verb} ${lb(rate)} lb/wk.${when}${fast}` }
}
