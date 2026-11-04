// Journal hero: this week's writing days vs the weekly target, and today's words vs the daily goal.
import type { JournalEntry } from '../../db'
import { Ring } from '../game/ui/Ring'
import { startOfWeek, today } from '../../lib/dates'
import { fraction, weekDaysWritten } from './constellation'
import { wordCount } from './stats'

export function WritingHero({ entries, goal, target, streak }: { entries: JournalEntry[]; goal: number; target: number; streak: number }) {
  const t = today()
  const days = weekDaysWritten(entries, startOfWeek(t), t)
  const todayWords = wordCount(entries.find((e) => e.date === t)?.text ?? '')
  return (
    <section className="card jr-hero" aria-label="Writing progress" data-testid="journal-hero">
      <div className="jr-hero-item">
        <Ring value={fraction(days, target)} size={56} stroke={4} tone="mind" label={`${days} of ${target} writing days this week`}>
          <span className="jr-hero-num">{days}</span>
        </Ring>
        <span className="jr-hero-text">
          <span className="jr-hero-label">Writing days this week</span>
          <span className="small muted">{days >= target ? 'Weekly target met' : `${target - days} more to reach ${target}`}{streak > 1 ? ` · ${streak}-day run` : ''}</span>
        </span>
      </div>
      <div className="jr-hero-item">
        <Ring value={fraction(todayWords, goal)} size={56} stroke={4} tone="mind" label={`${todayWords} of ${goal} words today`}>
          <span className="jr-hero-num">{Math.round(fraction(todayWords, goal) * 100)}</span>
        </Ring>
        <span className="jr-hero-text">
          <span className="jr-hero-label">Today's words</span>
          <span className="small muted"><span className="mono">{todayWords}</span> of {goal}</span>
        </span>
      </div>
    </section>
  )
}
