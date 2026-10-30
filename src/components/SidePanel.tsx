// SidePanel: detail/review panel. Desktop with `inline`: sticky column in the page layout. Otherwise a side sheet; on phone a bottom sheet.
import type { ReactNode } from 'react'
import BottomSheet from './BottomSheet'
import { useMedia, PHONE_QUERY } from './useMedia'

export default function SidePanel({ title, onClose, children, inline = false }: { title: string; onClose: () => void; children: ReactNode; inline?: boolean }) {
  const phone = useMedia(PHONE_QUERY)
  if (inline && !phone) {
    return (
      <aside className="side-panel" aria-label={title}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={`Close ${title}`}>Close</button>
        </div>
        <div className="sheet-body">{children}</div>
      </aside>
    )
  }
  return <BottomSheet title={title} onClose={onClose} side={!phone}>{children}</BottomSheet>
}
