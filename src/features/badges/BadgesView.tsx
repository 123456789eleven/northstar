// The quiet badges grid on Milestones. Earned: insignia, small gold mark, date. Unearned: outlined, one-line hint, progress.
import { useState } from 'react'
import { Empty, Modal, Skeleton } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import type { Badge, BadgeGroup } from './badges'
import { BadgeMarkSvg } from './marks'
import { useBadges } from './useBadges'
import './badges.css'

const GROUPS: BadgeGroup[] = ['Body', 'Money', 'Career and learning', 'Consistency']
const FULL: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }

function Tile({ b, onOpen }: { b: Badge; onOpen: (b: Badge) => void }) {
  return (
    <li>
      <button
        type="button"
        className={`bdg ${b.earned ? 'is-earned' : ''}`}
        onClick={() => onOpen(b)}
        data-testid="badge"
        data-earned={b.earned}
        aria-label={b.earned ? `${b.title}, earned${b.earnedAt ? ` ${formatDate(b.earnedAt, FULL)}` : ''}` : `${b.title}, not yet: ${b.have} of ${b.need}`}
      >
        <span className="bdg-mark"><BadgeMarkSvg mark={b.mark} />{b.earned && <i className="bdg-gold" aria-hidden />}</span>
        <span className="bdg-title">{b.title}</span>
        <span className="bdg-sub">{b.earned ? (b.earnedAt ? formatDate(b.earnedAt, FULL) : 'Earned') : b.hint}</span>
        {!b.earned && <span className="bdg-prog mono">{b.have} of {b.need}</span>}
      </button>
    </li>
  )
}

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

export function BadgesView() {
  const badges = useBadges()
  const [open, setOpen] = useState<Badge | null>(null)
  if (!badges) return <Skeleton rows={4} label="Loading badges" />
  if (badges.length === 0) return <Empty title="No badges yet">Log a weigh-in, a workout or a budget and the first one appears here.</Empty>
  const earned = badges.filter((b) => b.earned).length
  return (
    <section className="bdg-view" aria-label="Badges">
      <p className="bdg-count"><span className="bdg-count-n">{earned}</span> of {badges.length} earned</p>
      {GROUPS.map((g) => (
        <div key={g} className="bdg-group">
          <h3 className="bdg-group-h">{g}</h3>
          <ul className="bdg-grid">{badges.filter((b) => b.group === g).map((b) => <Tile key={b.id} b={b} onOpen={setOpen} />)}</ul>
        </div>
      ))}
      {open && <BadgeSheet b={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
