// Floor layout (BUILDINGS_PLAN.md rules): one hero, at most three supporting items, then a single "More" row that opens
// one sheet listing everything else. Every building's floors use these so they read the same.
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from '../../components/BottomSheet'
import { PHONE_QUERY, useMedia } from '../../components/useMedia'
import './floor.css'

export interface MoreItem {
  id: string
  /** Under 4 words. */
  label: string
  /** Optional figure or state on the right ("3,000 kcal"). */
  value?: ReactNode
  /** Opens inside the sheet, with Back. A function gets `close` (e.g. to close after picking a day). */
  panel?: ReactNode | ((close: () => void) => ReactNode)
  /** Goes to a route. */
  to?: string
  /** Runs and closes the sheet (opens a modal, copies a day...). */
  onSelect?: () => void
}

export function FloorMore({ floor, items }: { floor: string; items: MoreItem[] }) {
  const phone = useMedia(PHONE_QUERY)
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<string | null>(null)
  const current = items.find((i) => i.id === panel)
  const close = () => { setOpen(false); setPanel(null) }
  return (
    <>
      <button type="button" className="floor-more" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="floor-more">
        <span>More</span>
        <span className="floor-more-list">{items.map((i) => i.label).join(' · ')}</span>
        <span className="floor-more-chev" aria-hidden="true">›</span>
      </button>
      {open && (
        <BottomSheet title={current ? current.label : `${floor}: more`} onClose={close} side={!phone}>
          {current ? (
            <div className="stack floor-panel">
              <button type="button" className="btn btn-ghost btn-sm floor-back" onClick={() => setPanel(null)}>‹ Back</button>
              {typeof current.panel === 'function' ? current.panel(close) : current.panel}
            </div>
          ) : (
            <ul className="floor-more-items">
              {items.map((i) => (
                <li key={i.id}>
                  {i.to ? (
                    <Link className="floor-more-item" to={i.to} onClick={close}><span>{i.label}</span>{i.value != null && <span className="floor-more-val">{i.value}</span>}<span aria-hidden="true">›</span></Link>
                  ) : (
                    <button
                      type="button"
                      className="floor-more-item"
                      onClick={() => { if (i.panel) setPanel(i.id); else { close(); i.onSelect?.() } }}
                    >
                      <span>{i.label}</span>{i.value != null && <span className="floor-more-val">{i.value}</span>}<span aria-hidden="true">›</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </BottomSheet>
      )}
    </>
  )
}

/** One floor: a hidden h1 (the frame head shows the name), the hero, up to three supporting items, the More row. */
export function FloorView({ label, hero, support = [], more, className = '' }: { label: string; hero: ReactNode; support?: ReactNode[]; more?: ReactNode; className?: string }) {
  const items = support.filter(Boolean).slice(0, 3)
  return (
    <div className={`floor ${className}`}>
      <h1 className="sr-only">{label}</h1>
      {hero}
      {items.length > 0 && <div className={`floor-support n-${items.length}`}>{items}</div>}
      {more}
    </div>
  )
}

/** A supporting item: a quiet card with a short title (under 4 words) and an optional control on the right. */
export function FloorCard({ title, action, children, className = '', label }: { title: string; action?: ReactNode; children: ReactNode; className?: string; label?: string }) {
  return (
    <section className={`card floor-card ${className}`} aria-label={label ?? title}>
      <div className="floor-card-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  )
}
