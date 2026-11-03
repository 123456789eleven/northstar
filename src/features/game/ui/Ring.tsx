// SVG progress ring. The fill springs to its value (soft overshoot, --ease-spring-soft) when it mounts and when it changes.
// Only stroke-dashoffset of a <= 64px SVG circle animates: paint-only, no layout. Reduced motion: the transition is 0ms.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { SkillId } from '../types'

export interface RingProps {
  /** 0..1 */
  value: number
  size?: number
  stroke?: number
  /** Skill hue, 'reward' (gold) or undefined (accent violet). */
  tone?: SkillId | 'reward'
  /** Accessible label; without it the ring is decorative. */
  label?: string
  children?: ReactNode
  className?: string
}

export function Ring({ value, size = 40, stroke = 3, tone, label, children, className = '' }: RingProps) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(v))
    return () => cancelAnimationFrame(id)
  }, [v])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const style = { width: size, height: size, '--ring-c': tone ? (tone === 'reward' ? 'var(--reward)' : `var(--skill-${tone})`) : undefined } as CSSProperties
  return (
    <span className={`ring ${className}`} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden focusable="false">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          opacity={shown > 0 ? 1 : 0}
        />
      </svg>
      {children != null && <span className="ring-center" aria-hidden>{children}</span>}
    </span>
  )
}

/** Level number inside its progress ring (XP into the level). `size` 20-24 for rail pips, 40-56 for headers. */
export function LevelBadge({ level, progress, size = 40, tone, label }: { level: number; progress: number; size?: number; tone?: SkillId | 'reward'; label?: string }) {
  return (
    <Ring value={progress} size={size} stroke={size <= 24 ? 2 : 3} tone={tone} label={label ?? `Level ${level}`} className={`level-badge ${size <= 24 ? 'is-pip' : size <= 32 ? 'is-sm' : ''}`}>
      <span className="level-num">{level}</span>
    </Ring>
  )
}
