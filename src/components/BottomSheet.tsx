// Accessible dialog sheet: bottom sheet (phone) or right-hand panel (side). Focus trap, Esc, backdrop click, focus restore.
// Enters with a short slide + fade; Esc, backdrop and Close play the exit before unmounting (motion.ts useExit).
import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from './useFocusTrap'
import { useExit } from './motion'

export default function BottomSheet({ title, onClose, children, side = false }: { title: string; onClose: () => void; children: ReactNode; side?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [closing, requestClose] = useExit(onClose)
  useFocusTrap(ref, requestClose)
  // Portal to <body>: when opened from inside the sticky top bar (stacking context z-index 15) the sheet sat under the phone tab bar.
  return createPortal(
    <div className={`sheet-backdrop ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div ref={ref} className={`sheet ${side ? 'sheet-side' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        {!side && <div className="sheet-grab" aria-hidden />}
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={requestClose} aria-label={`Close ${title}`}>Close</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
