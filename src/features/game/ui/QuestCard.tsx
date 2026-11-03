// One daily quest. Quests complete themselves from real data; when one flips to done while you watch, the card plays a
// <= 900 ms moment: the check draws, the ring pulses, the XP counts up. Tap the card to skip it. Never plays on load
// (a card that mounts already done is shown done). Reduced motion (OS or Settings > Game) = instant.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { prefersReducedMotion, useNumberRoll } from '../../../components/motion'
import type { Quest } from '../types'
import { celebrate } from './feedback'
import { Ring } from './Ring'

const MOMENT_MS = 900

function useCompletion(done: boolean) {
  // Derived during render (React's "previous value" pattern): play only on a false -> true change seen by this card.
  const [prevDone, setPrevDone] = useState(done)
  const [playing, setPlaying] = useState(false)
  if (done !== prevDone) {
    setPrevDone(done)
    setPlaying(done && !prefersReducedMotion())
  }
  const was = useRef(done)
  useEffect(() => {
    if (!was.current && done) celebrate('tick')
    was.current = done
  }, [done])
  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => setPlaying(false), MOMENT_MS)
    return () => window.clearTimeout(t)
  }, [playing])
  return [playing, () => setPlaying(false)] as const
}

export function XpChip({ xp, rolling = false }: { xp: number; rolling?: boolean }) {
  const n = useNumberRoll(xp, 600, rolling ? 0 : xp)
  return <span className="xp-chip"><span className="mono">+{n}</span> XP</span>
}

export function QuestCard({ quest, compact = false }: { quest: Quest; compact?: boolean }) {
  const [playing, skip] = useCompletion(quest.done)
  const pct = quest.done ? 1 : quest.progress && quest.progress.target > 0 ? quest.progress.value / quest.progress.target : 0
  const onClick = (e: MouseEvent) => { if (playing) { e.preventDefault(); skip() } }
  const body = (
    <>
      <Ring value={pct} size={compact ? 32 : 40} stroke={compact ? 2.5 : 3} tone={quest.skill} className={`quest-ring ${playing ? 'is-pulsing' : ''}`}>
        {quest.done ? (
          <svg className={`quest-check ${playing ? 'is-drawing' : ''}`} viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3.5 8.5l3 3 6-6.5" pathLength={1} />
          </svg>
        ) : (
          <span className="quest-dot" />
        )}
      </Ring>
      <span className="quest-main">
        <span className="quest-title">{quest.title}</span>
        {quest.hint && !compact && <span className="quest-hint">{quest.hint}</span>}
        <span className="sr-only">{quest.done ? ' (done)' : ' (not done yet)'}</span>
      </span>
      {playing || !quest.done ? <XpChip key={playing ? 'roll' : 'still'} xp={quest.xp} rolling={playing} /> : <span className="xp-chip is-earned"><span className="mono">+{quest.xp}</span> XP</span>}
    </>
  )
  const cls = `quest ${compact ? 'is-compact' : ''} ${quest.done ? 'is-done' : ''} ${playing ? 'is-completing' : ''}`
  const style = { '--q-c': `var(--skill-${quest.skill})` } as CSSProperties
  return quest.href ? (
    <Link className={cls} style={style} to={quest.href} onClick={onClick} data-quest={quest.kind}>{body}</Link>
  ) : (
    <div className={cls} style={style} onClick={onClick} data-quest={quest.kind}>{body}</div>
  )
}
