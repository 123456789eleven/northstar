import { useEffect, useMemo, useRef, useState } from 'react'
import type { ISODate, JournalEntry } from '../../db'
import { today } from '../../lib/dates'
import { saveEntry } from './journalData'
import { extractTags, wordCount, wordStreak } from './stats'
import { Scale } from './Scale'
import { FocusMode } from './FocusMode'
import { FinishPanel } from './FinishPanel'
import { TEMPLATES, composeTemplate, firstAnswerOffset, getTemplate, type JournalTemplate } from './templates'
import { dailyPrompt } from './prompts'
import { tagCounts, tagSuggestions } from './insights'
import type { JournalPrefs } from './prefs'

interface Props {
  date: ISODate
  entry?: JournalEntry
  entries: JournalEntry[]
  prefs: JournalPrefs
  onPref: (patch: Partial<JournalPrefs>) => void
}

/** Autosaving editor for one day's entry. Remount (key) per date. */
export function EntryEditor({ date, entry, entries, prefs, onPref }: Props) {
  const [text, setText] = useState(entry?.text ?? '')
  const [mood, setMood] = useState(entry?.mood)
  const [energy, setEnergy] = useState(entry?.energy)
  const [saved, setSaved] = useState<string | null>('')
  const [focus, setFocus] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [tplId, setTplId] = useState<string | undefined>()
  const [skip, setSkip] = useState(0)
  const pending = useRef<{ text: string; mood?: number; energy?: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const focusBtn = useRef<HTMLButtonElement>(null)

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

  const change = (t: string) => { setText(t); queue({ text: t, mood, energy }) }
  const pickMood = (n: number | undefined) => { setMood(n); queue({ text, mood: n, energy }) }
  const pickEnergy = (n: number | undefined) => { setEnergy(n); queue({ text, mood, energy: n }) }

  const area = useRef<HTMLTextAreaElement>(null)
  // Desktop opens ready to type; on touch devices focusing would pop the keyboard unasked.
  useEffect(() => {
    if (window.matchMedia('(hover: hover)').matches) area.current?.focus()
  }, [])

  const applyTemplate = (t: JournalTemplate) => {
    setTplId(t.id)
    const scaffold = composeTemplate(t)
    change(scaffold)
    window.setTimeout(() => {
      const ta = area.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(firstAnswerOffset(t), firstAnswerOffset(t))
    }, 0)
  }

  const tpl = getTemplate(tplId)
  const tags = extractTags(text)
  const empty = !text.trim()
  const prompt = dailyPrompt(date, skip)
  const words = wordCount(text)
  const streak = useMemo(
    () => wordStreak([...entries.filter((e) => e.date !== date), { date, text }], today()),
    [entries, date, text],
  )
  const choices = useMemo(() => tagSuggestions(tagCounts(entries)), [entries])

  const exitFocus = (done: boolean) => {
    flush()
    setFocus(false)
    if (done) setFinishing(true)
    window.setTimeout(() => (done ? undefined : focusBtn.current?.focus()), 0)
  }

  return (
    <div className="stack">
      {empty && !focus && (
        <div className="jr-start">
          <div className="jr-prompt">
            <span className="jr-prompt-text">{prompt.text}</span>
            <span className="row jr-prompt-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkip(skip + 1)}>Another prompt</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { change(`${prompt.text}\n\n`); window.setTimeout(() => { area.current?.focus(); area.current?.setSelectionRange(9999, 9999) }, 0) }}>Write to this</button>
            </span>
          </div>
          <div className="row wrap" role="group" aria-label="Guided entries">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="chip jr-chip" title={t.hint} onClick={() => applyTemplate(t)}>{t.name}</button>
            ))}
            <button type="button" className="chip jr-chip" onClick={() => area.current?.focus()}>Free write</button>
          </div>
        </div>
      )}
      <textarea
        ref={area}
        className="textarea jr-text"
        value={text}
        placeholder="Write anything. Add #tags inline."
        aria-label="Journal entry"
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
      />
      {finishing ? (
        <FinishPanel
          date={date}
          text={text}
          mood={mood}
          energy={energy}
          tagChoices={choices}
          streak={streak}
          onText={change}
          onMood={pickMood}
          onEnergy={pickEnergy}
          onClose={() => setFinishing(false)}
        />
      ) : (
        <div className="jr-scales">
          <Scale label="Mood" value={mood} onPick={pickMood} />
          <Scale label="Energy" value={energy} onPick={pickEnergy} />
        </div>
      )}
      <div className="jr-foot">
        <span className="jr-tags">{tags.length ? tags.map((t) => `#${t}`).join(' ') : 'Stays on this device'}</span>
        <span aria-live="polite">{words} words · {saved === null ? 'Saving…' : saved ? `Saved ${saved}` : 'Saved'}</span>
      </div>
      <div className="row jr-actions">
        <button ref={focusBtn} type="button" className="btn btn-sm" onClick={() => setFocus(true)} aria-haspopup="dialog">Focus</button>
        {!finishing && words > 0 && <button type="button" className="btn btn-sm" onClick={() => setFinishing(true)}>Finish {date === today() ? 'today' : 'day'}</button>}
      </div>
      {focus && (
        <FocusMode
          title={date === today() ? 'Today' : date}
          text={text}
          onChange={change}
          saved={saved}
          prefs={prefs}
          onPref={onPref}
          template={tpl}
          onExit={exitFocus}
        />
      )}
    </div>
  )
}
