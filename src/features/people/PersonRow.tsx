// One person in the list. On touch screens, swipe right to mark contacted (Undo in the toast).
import { useRef, useState, type ReactNode } from 'react'
import type { Person } from '../../db'
import { cadenceLabel, personStatus } from './people'
import { relativeDay, today } from '../../lib/dates'

const THRESHOLD = 88

export function PersonRow({ p, onOpen, onContacted, onDetails, children }: { p: Person; onOpen: () => void; onContacted: () => void; onDetails: () => void; children?: ReactNode }) {
  const s = personStatus(p, today())
  const start = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null)
  const [dx, setDx] = useState(0)
  const reset = () => { start.current = null; setDx(0) }
  return (
    <div className="ppl-swipe">
      <span className="ppl-swipe-hint" aria-hidden style={{ opacity: Math.min(1, dx / THRESHOLD) }}>Contacted</span>
      <div
        className="ppl-row"
        data-focus-id={p.id}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onTouchStart={(e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, axis: null } }}
        onTouchMove={(e) => {
          const st = start.current
          if (!st) return
          const t = e.touches[0]
          const mx = t.clientX - st.x, my = t.clientY - st.y
          if (!st.axis && Math.hypot(mx, my) > 8) st.axis = Math.abs(mx) > Math.abs(my) * 1.4 ? 'x' : 'y'
          if (st.axis === 'x') setDx(Math.max(0, Math.min(140, mx)))
        }}
        onTouchEnd={() => { const fire = dx >= THRESHOLD; reset(); if (fire) onContacted() }}
        onTouchCancel={reset}
      >
        <button className="ppl-main" onClick={onOpen}>
          <span className="ppl-name">{p.name}</span>
          <span className="ppl-meta">
            {[p.relation, p.cadenceDays ? cadenceLabel(p.cadenceDays).toLowerCase() : null, p.lastContact ? `last ${relativeDay(p.lastContact).toLowerCase()}` : 'never contacted'].filter(Boolean).join(' · ')}
          </span>
        </button>
        <span className={s.overdue ? 'ppl-status is-due' : 'ppl-status'}>{s.text.replace(' · never logged', '')}</span>
        <button className="btn btn-sm ppl-act" onClick={onContacted} aria-label={`Contacted ${p.name} today`}>Contacted</button>
        <button className="btn btn-sm btn-ghost ppl-more" onClick={onDetails} aria-label={`Log details for ${p.name}`}>Details</button>
        {children}
      </div>
    </div>
  )
}
