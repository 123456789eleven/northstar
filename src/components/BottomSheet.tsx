// Accessible dialog sheet: bottom sheet (phone) or a floating right-hand panel (side). Focus trap, Esc, backdrop click, focus
// restore. Liquid v2: it opens as a droplet from the control that opened it and closes back into it (droplet.ts); with no
// trigger, a second sheet already open or reduced motion it keeps the short CSS slide + fade (motion.ts useExit).
import { useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from './useFocusTrap'
import { useExit } from './motion'
import { useDroplet } from './droplet'
import { useLens } from '../lib/lens'
import './liquid-chrome.css'

export default function BottomSheet({ title, onClose, children, side = false }: { title: string; onClose: () => void; children: ReactNode; side?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLDivElement>(null)
  const [closing, requestExit] = useExit(onClose)
  const dropClose = useDroplet(ref, back, onClose)
  const requestClose = useCallback(() => dropClose(requestExit), [dropClose, requestExit])
  useFocusTrap(ref, requestClose)
  // Only one sheet is ever mounted at a time, so this never competes with the strip or the capture button for the lens budget.
  // registerLens disables itself during the droplet morph the same way the sheet's own is-morphing rule does (backdrop-filter
  // off while anything moves), so the two are complementary, not in conflict.
  useLens(ref, 'sheet')
  // Portal to <body>: when opened from inside the sticky top bar (stacking context z-index 15) the sheet sat under the phone tab bar.
  return createPortal(
    <div ref={back} className={`sheet-backdrop ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
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
