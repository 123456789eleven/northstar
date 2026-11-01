// Closing ritual: mood, energy, up to 3 tags, optional tomorrow top 3 as tasks. Everything is optional.
import { useRef, useState } from 'react'
import { addDays, today } from '../../lib/dates'
import { parseTask } from '../../lib/capture'
import { saveCapture } from '../tasks/captureSave'
import { useToast } from '../../components/toastContext'
import { Scale } from './Scale'
import { extractTags, wordCount } from './stats'
import { toggleTag } from './insights'

interface Props {
  date: string
  text: string
  mood?: number
  energy?: number
  tagChoices: string[]
  /** streak including this entry */
  streak: number
  onText: (t: string) => void
  onMood: (n: number | undefined) => void
  onEnergy: (n: number | undefined) => void
  onClose: () => void
}

export function FinishPanel({ date, text, mood, energy, tagChoices, streak, onText, onMood, onEnergy, onClose }: Props) {
  const toast = useToast()
  const [tops, setTops] = useState(['', '', ''])
  const [done, setDone] = useState<{ tasks: number } | null>(null)
  const head = useRef<HTMLHeadingElement>(null)
  const inText = extractTags(text)
  const picked = tagChoices.filter((t) => inText.includes(t)).length

  const finish = async () => {
    const lines = tops.map((x) => x.trim()).filter(Boolean)
    const undos: (() => Promise<unknown>)[] = []
    for (const line of lines) {
      const parsed = parseTask(line)
      if (!parsed.due) parsed.due = addDays(today(), 1)
      const saved = await saveCapture(parsed)
      if (saved) undos.push(saved.undo)
    }
    if (undos.length) {
      toast({ message: `${undos.length} ${undos.length === 1 ? 'task' : 'tasks'} due tomorrow`, undo: async () => { for (const u of undos) await u() } })
    }
    setDone({ tasks: undos.length })
    window.setTimeout(() => head.current?.focus(), 0)
  }

  if (done) {
    return (
      <div className="jr-finish stack" role="region" aria-label="Day finished">
        <h3 className="jr-finish-h" ref={head} tabIndex={-1}>Day closed</h3>
        <div className="jr-finish-stats">
          <div><div className="jr-big">{streak}</div><div className="small muted">day streak</div></div>
          <div><div className="jr-big">{wordCount(text)}</div><div className="small muted">words today</div></div>
          {done.tasks > 0 && <div><div className="jr-big">{done.tasks}</div><div className="small muted">for tomorrow</div></div>}
        </div>
        <div><button type="button" className="btn btn-sm" onClick={onClose}>Close</button></div>
      </div>
    )
  }

  return (
    <div className="jr-finish stack" role="region" aria-label="Finish today">
      <div className="row jr-finish-top">
        <h3 className="jr-finish-h">Finish {date === today() ? 'today' : 'this day'}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Skip</button>
      </div>
      <div className="jr-scales">
        <Scale label="Mood" value={mood} onPick={onMood} />
        <Scale label="Energy" value={energy} onPick={onEnergy} />
      </div>
      <div>
        <div className="small muted jr-finish-label">Tags (up to 3)</div>
        <div className="row wrap" role="group" aria-label="Tags">
          {tagChoices.map((t) => {
            const on = inText.includes(t)
            return (
              <button key={t} type="button" className={`chip jr-chip ${on ? 'chip-accent' : ''}`} aria-pressed={on} disabled={!on && picked >= 3} onClick={() => onText(toggleTag(text, t))}>#{t}</button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="small muted jr-finish-label">Tomorrow&apos;s top 3 (becomes tasks due tomorrow)</div>
        <div className="stack" style={{ gap: 6 }}>
          {tops.map((v, i) => (
            <input key={i} className="input" aria-label={`Tomorrow priority ${i + 1}`} placeholder={`${i + 1}. e.g. send the report`} value={v} onChange={(e) => setTops(tops.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => void finish()}>Close the day</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Skip</button>
      </div>
    </div>
  )
}
