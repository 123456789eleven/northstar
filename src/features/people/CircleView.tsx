// The circle: concentric orbits by contact cadence, one dot per person. Glow fades gently as the cadence approaches;
// past it a soft violet ring appears (never red, no guilt copy). Tap a dot to open the person.
import { useMemo } from 'react'
import type { Person } from '../../db'
import { today } from '../../lib/dates'
import { ORBITS, glowFor, layoutCircle } from './circle'
import { personStatus } from './people'

export function CircleView({ people, onOpen, selectedId }: { people: Person[]; onOpen: (id: number) => void; selectedId?: number | null }) {
  const now = today()
  const byId = useMemo(() => new Map(people.map((p) => [p.id!, p])), [people])
  const L = useMemo(() => layoutCircle(people.map((p) => ({ id: p.id!, cadenceDays: p.cadenceDays }))), [people])
  const R = L.radius
  return (
    <div className="ppl-circle" data-testid="people-circle">
      <svg viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} role="group" aria-label="Your circle, by how often you keep in touch" className="ppl-svg">
        {L.orbits.map((o) => <circle key={o.key} className="ppl-orbit" r={o.r} />)}
        <circle className="ppl-you" r={9} aria-hidden />
        {L.dots.map((d) => {
          const p = byId.get(d.id)!
          const g = glowFor(p, now)
          const st = personStatus(p, now)
          return (
            <g
              key={d.id}
              className={`ppl-dot ${g.overdue ? 'is-overdue' : ''} ${selectedId === d.id ? 'is-selected' : ''}`}
              transform={`translate(${d.x} ${d.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${p.name}, ${st.text}`}
              data-person={d.id}
              onClick={() => onOpen(d.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(d.id) } }}
            >
              <title>{p.name}</title>
              <circle className="ppl-halo" r={L.dotR * 1.8} style={{ opacity: g.glow * 0.3 }} />
              <circle className="ppl-core" r={L.dotR} style={{ opacity: 0.4 + 0.6 * g.glow }} />
              {g.overdue && <circle className="ppl-due-ring" r={L.dotR + 2.5} />}
              <circle className="ppl-hit" r={L.dotR + 4} />
            </g>
          )
        })}
      </svg>
      <ul className="ppl-legend small" aria-label="Orbits">
        {L.orbits.map((o, i) => <li key={o.key}><span className="ppl-legend-ring" style={{ opacity: 0.4 + i * 0.15 }} aria-hidden />{ORBITS[i].label} <span className="mono muted">{o.count}</span></li>)}
      </ul>
    </div>
  )
}
