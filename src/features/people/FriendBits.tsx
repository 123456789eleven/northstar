// Friend card pieces: warmth ring, quick actions (Message, Call, Plan a hangout, Log it) and the card used by the feed and details.
import { useState } from 'react'
import type { ISODate, Person } from '../../db'
import { useToast } from '../../components/toastContext'
import { saveCapture } from '../tasks/captureSave'
import { LogPanel, useLogKind } from './LogPanel'
import { contactWords, defaultHangoutDate, starterFor } from './starter'
import { firstName } from './tree'
import { isWarm, personWarmth } from './warmth'

export function WarmthRing({ p, now, size = 44 }: { p: Person; now: ISODate; size?: number }) {
  const w = personWarmth(p, now)
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  const warm = isWarm(p, now)
  const label = w === null ? 'No rhythm set' : `${Math.round(w * 100)}% warm`
  return (
    <svg className="fr-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${p.name}: ${label}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="fr-ring-track" />
      {w !== null && w > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} className={warm ? 'fr-ring-arc' : 'fr-ring-arc is-cool'} strokeDasharray={`${c * w} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      )}
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" className="fr-ring-initial">{p.name.trim().charAt(0).toUpperCase()}</text>
    </svg>
  )
}

export function FriendActions({ p, now }: { p: Person; now: ISODate }) {
  const log = useLogKind()
  const toast = useToast()
  const [mode, setMode] = useState<'none' | 'log' | 'plan'>('none')
  const [due, setDue] = useState(() => defaultHangoutDate(now))
  const f = firstName(p.name)

  const plan = async () => {
    const saved = await saveCapture({ kind: 'task', title: `Hang out with ${p.name}`, due, priority: 2, recurrence: 'none' })
    setMode('none')
    if (saved) toast({ message: `Hangout with ${f} is on your list.`, undo: saved.undo })
  }

  return (
    <div className="fr-actions">
      <div className="fr-buttons">
        <button type="button" className="btn btn-sm" onClick={() => log(p, 'text')} aria-label={`Message ${p.name}`}>Message</button>
        <button type="button" className="btn btn-sm" onClick={() => log(p, 'call')} aria-label={`Call ${p.name}`}>Call</button>
        <button type="button" className="btn btn-sm" aria-expanded={mode === 'plan'} onClick={() => setMode(mode === 'plan' ? 'none' : 'plan')} aria-label={`Plan a hangout with ${p.name}`}>Plan a hangout</button>
        <button type="button" className="btn btn-sm" aria-expanded={mode === 'log'} onClick={() => setMode(mode === 'log' ? 'none' : 'log')} aria-label={`Log it with ${p.name}`}>Log it</button>
      </div>
      {mode === 'plan' && (
        <div className="fr-plan">
          <label className="small muted" htmlFor={`fr-due-${p.id}`}>Pick a day</label>
          <input id={`fr-due-${p.id}`} className="input ppl-date" type="date" min={now} value={due} onChange={(e) => setDue(e.target.value || defaultHangoutDate(now))} />
          <button type="button" className="btn btn-primary btn-sm" onClick={plan}>Add to my tasks</button>
        </div>
      )}
      {mode === 'log' && <LogPanel person={p} onDone={() => setMode('none')} />}
    </div>
  )
}

export function FriendCard({ p, now, others, onOpen }: { p: Person; now: ISODate; others: Person[]; onOpen?: () => void }) {
  return (
    <article className="fr-card" data-testid="friend-card">
      <WarmthRing p={p} now={now} />
      <div className="fr-body">
        <div className="fr-head">
          {onOpen ? <button type="button" className="ppl-link fr-name" onClick={onOpen}>{p.name}</button> : <strong className="fr-name">{p.name}</strong>}
          <span className="fr-when">{contactWords(p, now)}</span>
        </div>
        <p className="fr-starter">{starterFor(p, now, others)}</p>
        <FriendActions p={p} now={now} />
      </div>
    </article>
  )
}
