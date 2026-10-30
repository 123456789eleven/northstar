import { useEffect, useRef, useState } from 'react'
import type { ISODate, JournalEntry } from '../../db'
import { saveEntry } from './journalData'
import { extractTags, wordCount } from './stats'

function Scale({ label, value, onPick }: { label: string; value?: number; onPick: (n: number | undefined) => void }) {
  return (
    <div className="jr-scale">
      <span className="small muted">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onPick(value === n ? undefined : n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Autosaving editor for one day's entry. Remount (key) per date. */
export function EntryEditor({ date, entry }: { date: ISODate; entry?: JournalEntry }) {
  const [text, setText] = useState(entry?.text ?? '')
  const [mood, setMood] = useState(entry?.mood)
  const [energy, setEnergy] = useState(entry?.energy)
  const [saved, setSaved] = useState<string | null>('')
  const pending = useRef<{ text: string; mood?: number; energy?: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const flush = () => {
    window.clearTimeout(timer.current)
    const p = pending.current
    if (!p) return
    pending.current = null
    // Only write text/mood/energy that exist, so an empty untouched day never creates a row.
    void saveEntry(date, { text: p.text, mood: p.mood, energy: p.energy }).then(() => setSaved(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })))
  }
  const queue = (next: { text: string; mood?: number; energy?: number }) => {
    pending.current = next
    setSaved(null)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 700)
  }
  // Flush on unmount so navigating away never loses a draft.
  useEffect(() => () => flush(), []) // eslint-disable-line

  const area = useRef<HTMLTextAreaElement>(null)
  // Desktop opens ready to type; on touch devices focusing would pop the keyboard unasked.
  useEffect(() => {
    if (window.matchMedia('(hover: hover)').matches) area.current?.focus()
  }, [])
  const tags = extractTags(text)
  return (
    <div className="stack">
      <textarea
        ref={area}
        className="textarea jr-text"
        value={text}
        placeholder="Write anything. Add #tags inline."
        aria-label="Journal entry"
        onChange={(e) => {
          setText(e.target.value)
          queue({ text: e.target.value, mood, energy })
        }}
        onBlur={flush}
      />
      <div className="jr-scales">
        <Scale label="Mood" value={mood} onPick={(n) => { setMood(n); queue({ text, mood: n, energy }) }} />
        <Scale label="Energy" value={energy} onPick={(n) => { setEnergy(n); queue({ text, mood, energy: n }) }} />
      </div>
      <div className="jr-foot">
        <span className="jr-tags">{tags.length ? tags.map((t) => `#${t}`).join(' ') : 'Stays on this device'}</span>
        <span aria-live="polite">{wordCount(text)} words · {saved === null ? 'Saving…' : saved ? `Saved ${saved}` : 'Saved'}</span>
      </div>
    </div>
  )
}
