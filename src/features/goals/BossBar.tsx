// The boss HP bar with its path of checkpoint flags. Game mode: the bar is the boss's remaining HP (drains from the right as
// progress grows) and flags sit at their progress positions, so a flag to the left of the fill edge is behind you.
// Calm mode: the same bar as a plain progress fill. Only transform animates.
import { useEffect, useState, type CSSProperties } from 'react'
import type { BossHp, Checkpoint } from './boss'

export function BossBar({ hp, flags, label, calm = false, showLabels = false }: { hp: BossHp; flags: Checkpoint[]; label: string; calm?: boolean; showLabels?: boolean }) {
  const target = calm ? hp.progress : hp.hp
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target))
    return () => cancelAnimationFrame(id)
  }, [target])
  const pct = Math.round(hp.progress * 100)
  return (
    <div className={`bossbar ${calm ? 'is-calm' : ''} ${showLabels && flags.length ? 'has-labels' : ''}`}>
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
