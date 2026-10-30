// Accessible dialog sheet: bottom sheet (phone) or right-hand panel (side). Focus trap, Esc, backdrop click, focus restore.
import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from './useFocusTrap'

export default function BottomSheet({ title, onClose, children, side = false }: { title: string; onClose: () => void; children: ReactNode; side?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, onClose)
  // Portal to <body>: when opened from inside the sticky top bar (stacking context z-index 15) the sheet sat under the phone tab bar.
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`sheet ${side ? 'sheet-side' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        {!side && <div className="sheet-grab" aria-hidden />}
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={`Close ${title}`}>Close</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
