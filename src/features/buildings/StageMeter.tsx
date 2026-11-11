// Stage meter: the building's five windows, lit by real things you did (stage.ts). Tap it to see what lights each window.
// A window that lights while you watch pops once (spring); all five lit turn gold, the one earned colour.
import { useEffect, useId, useRef, useState } from 'react'
import { STAGES, type BuildingStage } from './stage'

export default function StageMeter({ stage, building }: { stage: BuildingStage; building: string }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(stage.stage)
  const [fresh, setFresh] = useState<number[]>([])
  if (seen !== stage.stage) {
    setFresh(stage.stage > seen ? Array.from({ length: stage.stage - seen }, (_, i) => seen + i) : [])
    setSeen(stage.stage)
  }
  const ref = useRef<HTMLDivElement>(null)
  const pop = useId()
  useEffect(() => {
    if (!open) return
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  const full = stage.stage >= STAGES
  return (
    <div className={`stage-meter${full ? ' is-full' : ''}`} ref={ref} data-testid="stage-meter" data-stage={stage.stage}>
      <button
        type="button"
        className="stage-btn"
        aria-expanded={open}
        aria-controls={pop}
        aria-label={`${building} stage ${stage.stage} of ${STAGES}. ${stage.line}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="stage-windows" aria-hidden="true">
          {Array.from({ length: STAGES }, (_, i) => (
            <i key={i} className={`stage-win${i < stage.stage ? ' is-lit' : ''}${fresh.includes(i) ? ' is-new' : ''}`} />
          ))}
        </span>
        <span className="stage-num mono" aria-hidden="true">{stage.stage}/{STAGES}</span>
      </button>
      {open && (
        <div className="stage-pop" id={pop} role="dialog" aria-label={`${building} stage`}>
          <ol className="stage-list">
            {stage.steps.map((s) => (
              <li key={s.id} className={s.done ? 'is-done' : ''}>
                <i className={`stage-win${s.done ? ' is-lit' : ''}`} aria-hidden="true" />
                <span>{s.label}</span>
                <span className="sr-only">{s.done ? ', lit' : ', not yet'}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
