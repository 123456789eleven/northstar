// Two macro rings (calories, protein) that fill through the day, with the numbers to go under them.
// A subtle pulse plays once when a ring reaches its target (no confetti); reduced motion removes it.
import { useEffect, useRef, useState } from 'react'
import { useNumberRoll } from '../../components/motion'
import { Ring } from '../game/ui/Ring'
import { justReached, ringFill } from './ringMath'

function MacroRing({ label, unit, value, target, ready, size, stroke, hero }: { label: string; unit: string; value: number; target: number; ready: boolean; size: number; stroke: number; hero?: boolean }) {
  const r = ringFill(value, target)
  const shown = useNumberRoll(Math.round(value))
  const prev = useRef<number | null>(null)
  const [pulse, setPulse] = useState(false)
  // A small pop on the number each time it grows (a logged meal), derived while rendering.
  const [seen, setSeen] = useState(value)
  const [pop, setPop] = useState(0)
  if (seen !== value) {
    if (ready && value > seen) setPop(pop + 1)
    setSeen(value)
  }
  useEffect(() => {
    if (!ready) return
    const fire = justReached(prev.current, value, target)
    prev.current = value
    if (!fire) return
    const on = window.setTimeout(() => setPulse(true), 0)
    const off = window.setTimeout(() => setPulse(false), 900)
    return () => { window.clearTimeout(on); window.clearTimeout(off) }
  }, [value, target, ready])
  return (
    <div className={`mring ${hero ? 'is-hero' : 'is-side'} ${pulse ? 'is-pulse' : ''} ${r.reached ? 'is-met' : ''}`} data-testid={`ring-${label.toLowerCase()}`}>
      <Ring value={r.fill} size={size} stroke={stroke} tone={r.reached ? 'reward' : undefined} label={`${label}: ${Math.round(value).toLocaleString()} of ${target.toLocaleString()} ${unit}`}>
        <span className="mring-center">
          <span key={pop} className={`mring-big mono${pop ? ' tick-pop' : ''}`} data-testid={`ring-${label.toLowerCase()}-value`}>{shown.toLocaleString()}</span>
          <span className="mring-of">of {target.toLocaleString()} {unit}</span>
        </span>
      </Ring>
      <div className="mring-label">{label}</div>
      <div className="mring-left" data-testid={`ring-${label.toLowerCase()}-left`}>
        {r.reached ? (r.over > 0 ? `Target met, ${r.over.toLocaleString()} ${unit} over` : 'Target met') : `${r.left.toLocaleString()} ${unit} to go`}
      </div>
    </div>
  )
}

export default function MacroRings({ targets, totals, ready, size = 128 }: { targets: { calories?: number; protein?: number }; totals: { calories: number; protein: number }; ready: boolean; size?: number }) {
  const stroke = Math.round(size / 11.6)
  return (
    <div className="mrings">
      {targets.calories ? <MacroRing label="Calories" unit="kcal" value={totals.calories} target={targets.calories} ready={ready} size={size} stroke={stroke} hero /> : null}
      {targets.protein ? <MacroRing label="Protein" unit="g" value={totals.protein} target={targets.protein} ready={ready} size={size} stroke={stroke} /> : null}
    </div>
  )
}
