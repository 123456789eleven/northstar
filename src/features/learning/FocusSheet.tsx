// Calm focus-run sheet + header chip. Count up, optional 25/45/60 target, pause, stop (logs minutes with Undo).
import { useState } from 'react'
import BottomSheet from '../../components/BottomSheet'
import { useToast } from '../../components/toastContext'
import { Ring } from '../game/ui/Ring'
import { elapsedMs, formatClock, TARGETS, targetProgress } from './focusRun'
import { focusDispatch, stopFocusRun, useFocusRun } from './focusStore'
import { fmtMinutes } from './learningData'
import { useTicker } from './useTicker'

/** Small chip for the page header: shows the running clock, opens the sheet. Renders nothing when idle. */
export function FocusChip({ onOpen }: { onOpen: () => void }) {
  const run = useFocusRun()
  const now = useTicker(run.phase === 'running')
  if (run.phase === 'idle') return null
  const t = now
  return (
    <button type="button" className="chip chip-accent focus-chip" onClick={onOpen} aria-label={`Focus run ${run.phase}, ${formatClock(elapsedMs(run, t))}. Open`} data-testid="focus-chip">
      <span className={`focus-dot ${run.phase === 'running' ? 'is-live' : ''}`} aria-hidden />
      <span className="mono">{formatClock(elapsedMs(run, t))}</span>
    </button>
  )
}

export function FocusSheet({ itemId, title, onClose }: { itemId: number; title: string; onClose: () => void }) {
  const run = useFocusRun()
  const toast = useToast()
  const [target, setTarget] = useState<number | null>(null)
  const now = useTicker(run.phase === 'running')
  const mine = run.phase !== 'idle' && run.itemId === itemId
  const other = run.phase !== 'idle' && run.itemId !== itemId
  const t = now
  const ms = elapsedMs(run, t)
  const p = targetProgress(run, t)
  const tMin = run.phase !== 'idle' ? run.targetMin : target

  const stop = async () => {
    const r = await stopFocusRun()
    onClose()
    if (!r) return
    const total = r.parts.reduce((n, x) => n + x.minutes, 0)
    toast(total > 0 ? { message: `Logged ${fmtMinutes(total)} on ${title}`, undo: r.undo } : { message: 'Under a minute: nothing logged' })
  }

  return (
    <BottomSheet title="Focus" onClose={onClose}>
      <div className="focus-sheet" data-testid="focus-sheet">
        <p className="focus-title">{title}</p>
        {other ? (
          <p className="small muted">A focus run is already going on another item. Stop it first.</p>
        ) : (
          <>
            <div className="focus-clock-wrap">
              <Ring value={mine ? p : 0} size={168} stroke={5} tone="mind" label={mine && tMin ? `${Math.round(p * 100)}% of ${tMin} minutes` : undefined} />
              <span className="focus-clock mono" role="timer" aria-label="Elapsed focus time">{formatClock(mine ? ms : 0)}</span>
            </div>
            <div className="row focus-targets" role="group" aria-label="Target length">
              <button type="button" className="chip jr-chip" aria-pressed={tMin == null} onClick={() => { setTarget(null); if (mine) focusDispatch({ type: 'target', targetMin: null }) }}>No target</button>
              {TARGETS.map((m) => (
                <button key={m} type="button" className="chip jr-chip" aria-pressed={tMin === m} onClick={() => { setTarget(m); if (mine) focusDispatch({ type: 'target', targetMin: m }) }}>{m} min</button>
              ))}
            </div>
            {mine && run.targetMin != null && p >= 1 && <p className="small muted" aria-live="polite">Target reached. Keep going or stop when you like.</p>}
            <div className="row focus-actions">
              {!mine && <button type="button" className="btn btn-primary" onClick={() => focusDispatch({ type: 'start', itemId, targetMin: target, now: Date.now() })}>Begin</button>}
              {mine && run.phase === 'running' && <button type="button" className="btn" onClick={() => focusDispatch({ type: 'pause', now: Date.now() })}>Pause</button>}
              {mine && run.phase === 'paused' && <button type="button" className="btn btn-primary" onClick={() => focusDispatch({ type: 'resume', now: Date.now() })}>Resume</button>}
              {mine && <button type="button" className="btn" onClick={() => void stop()}>Stop and log</button>}
            </div>
            <p className="small muted">Keeps running if you leave this page. No notifications.</p>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
