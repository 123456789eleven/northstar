// A hub landing card: the whole card links to the page; inside, a live preview of what is there.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ModuleTile from '../../components/ModuleTile'
import type { IconName } from '../../components/Icons'

export function HubCard({ to, icon, title, stat, sub, children }: { to: string; icon: IconName; title: string; stat?: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <Link to={to} className="card card-interactive hub-card">
      <span className="hub-card-head">
        <ModuleTile icon={icon} />
        <span className="hub-card-name">
          <span className="hub-card-title">{title}</span>
          {sub && <span className="hub-card-sub">{sub}</span>}
        </span>
        {stat != null && <span className="hub-card-stat">{stat}</span>}
      </span>
      {children && <span className="hub-card-body">{children}</span>}
    </Link>
  )
}

export function HubList({ items, empty }: { items: Array<{ key: string | number; label: ReactNode; meta?: ReactNode }>; empty: ReactNode }) {
  if (!items.length) return <span className="hub-empty">{empty}</span>
  return (
    <span className="hub-list">
      {items.map((i) => (
        <span key={i.key} className="hub-li"><span className="hub-li-label">{i.label}</span>{i.meta != null && <span className="hub-li-meta">{i.meta}</span>}</span>
      ))}
    </span>
  )
}
