// The quiet badges grid on Milestones. Earned: insignia, small gold mark, date. Unearned: outlined, one-line hint, progress.
import { useState, type CSSProperties } from 'react'
import { Modal } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import type { Badge, BadgeGroup } from './badges'
import { BadgeMarkSvg } from './marks'
import './badges.css'

const GROUPS: BadgeGroup[] = ['Body', 'Money', 'Career and learning', 'Consistency']
const FULL: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }

export function BadgeSheet({ b, onClose }: { b: Badge; onClose: () => void }) {
  return (
    <Modal title={b.title} onClose={onClose}>
      <div className={`bdg-sheet ${b.earned ? 'is-earned' : ''}`}>
        <span className="bdg-mark bdg-mark-lg"><BadgeMarkSvg mark={b.mark} size={72} />{b.earned && <i className="bdg-gold" aria-hidden />}</span>
        <p className="bdg-meaning">{b.meaning}</p>
        <p className="bdg-how mono">
          {b.earned
            ? `Earned${b.earnedAt ? ` on ${formatDate(b.earnedAt, { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.`
            : `${b.have} of ${b.need}. ${b.hint}`}
        </p>
        <div className="row bdg-actions"><button type="button" className="btn" onClick={onClose}>Close</button></div>
      </div>
    </Modal>
  )
}

/** The shelf: every badge as one mark. Earned ones light gold in sequence; tap one for what it means. */
export function BadgeShelf({ badges }: { badges: Badge[] }) {
  const [open, setOpen] = useState<Badge | null>(null)
  let n = 0
  return (
    <>
      <ul className="bdg-shelf" aria-label="Badges">
        {GROUPS.flatMap((g) => badges.filter((b) => b.group === g)).map((b) => (
          <li key={b.id} style={{ '--i': b.earned ? n++ : 0 } as CSSProperties}>
            <button
              type="button"
              className={`bdg-mini ${b.earned ? 'is-earned' : ''}`}
              onClick={() => setOpen(b)}
              title={b.earned ? b.title : `${b.title}: ${b.have} of ${b.need}`}
              data-testid="badge"
              data-earned={b.earned}
              aria-label={b.earned ? `${b.title}, earned${b.earnedAt ? ` ${formatDate(b.earnedAt, FULL)}` : ''}` : `${b.title}, not yet: ${b.have} of ${b.need}`}
            >
              <span className="bdg-mark"><BadgeMarkSvg mark={b.mark} size={30} />{b.earned && <i className="bdg-gold" aria-hidden />}</span>
              <span className="bdg-mini-t">{b.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <BadgeSheet b={open} onClose={() => setOpen(null)} />}
    </>
  )
}
