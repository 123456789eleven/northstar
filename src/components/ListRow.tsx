// ListRow: leading + title + meta line + trailing. 44px on phone, 36px desktop. Pass onClick to make the row a button.
import type { ReactNode } from 'react'

export default function ListRow({ leading, title, meta, trailing, onClick, selected }: { leading?: ReactNode; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; onClick?: () => void; selected?: boolean }) {
  const inner = (
    <>
      {leading && <span className="lr-lead">{leading}</span>}
      <span className="lr-main">
        <span className="lr-title">{title}</span>
        {meta && <span className="lr-meta">{meta}</span>}
      </span>
      {trailing && <span className="lr-trail">{trailing}</span>}
    </>
  )
  return onClick ? (
    <button type="button" className={`list-row lr-btn ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected}>{inner}</button>
  ) : (
    <div className={`list-row ${selected ? 'selected' : ''}`}>{inner}</div>
  )
}
