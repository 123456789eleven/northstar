// The season goal progress bar with its path of checkpoint flags. The fill grows from the left; flags sit at their progress
// positions, so a flag to the left of the fill edge is behind you. Only transform animates. `calm` is accepted and ignored.
import { useEffect, useState, type CSSProperties } from 'react'
import type { BossHp, Checkpoint } from './boss'

export function BossBar({ hp, flags, label, showLabels = false }: { hp: BossHp; flags: Checkpoint[]; label: string; calm?: boolean; showLabels?: boolean }) {
  const target = hp.progress
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target))
    return () => cancelAnimationFrame(id)
  }, [target])
  const pct = Math.round(hp.progress * 100)
  return (
    <div className={`bossbar is-calm ${showLabels && flags.length ? 'has-labels' : ''}`}>
      <div className="bossbar-path" role="progressbar" aria-label={`${label}: ${pct}% done`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="bossbar-track">
          <div className="bossbar-fill" style={{ '--v': shown } as CSSProperties} />
        </div>
        {flags.map((f, i) => (
          <span key={i} className={`bossbar-flag ${f.reached ? 'is-reached' : ''}`} style={{ left: `${f.pos}%` }} title={`${f.label}${f.reached ? ' (reached)' : ''}`} />
        ))}
      </div>
      {showLabels && flags.length > 0 && (
        <div className="bossbar-labels" aria-hidden>
          {flags.map((f, i) => (
            <span key={i} className={`bossbar-label ${f.reached ? 'is-reached' : ''} ${f.pos >= 99 ? 'is-end' : ''}`} style={{ left: `${f.pos}%` }}>{f.label}</span>
          ))}
        </div>
      )}
    </div>
  )
}
