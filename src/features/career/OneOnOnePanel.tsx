import { useState } from 'react'
import { Card, Empty, Field } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { formatDate, today } from '../../lib/dates'
import { closeCommitment, makeTaskFromCommitment, savePrefs, saveOneOnOne, useClosed, useOneOnOnes, usePrefs } from './careerData'
import { commitmentKey, type OneOnOneDraft } from './oneOnOne'

const BLANK: OneOnOneDraft = { topics: '', mine: '', theirs: '', feedback: '' }

export function OneOnOnePanel() {
  const toast = useToast()
  const notes = useOneOnOnes()
  const closed = useClosed()
  const prefs = usePrefs()
  const [date, setDate] = useState(today())
  const [d, setD] = useState<OneOnOneDraft>(BLANK)
  const set = (k: keyof OneOnOneDraft, v: string) => setD((x) => ({ ...x, [k]: v }))
  const empty = !Object.values(d).some((v) => v.trim())

  const save = async () => {
    const undo = await saveOneOnOne(date, d)
    if (!undo) return
    setD(BLANK)
    toast({ message: '1:1 saved to your journal.', undo })
  }
  const makeTask = async (key: string, text: string) => {
    const undo = await makeTaskFromCommitment(key, text)
    toast({ message: 'Task added', undo })
  }
  const done = async (key: string) => {
    const undo = await closeCommitment(key)
    toast({ message: 'Marked done', undo })
  }

  return (
    <div className="stack">
      <Card title="New 1:1 note" sub="Saved in your journal with the tag #1on1, so it shows up in Journal search.">
        <div className="stack">
          <div className="car-form-grid">
            <Field label="1:1 date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Next 1:1">
              <input className="input" type="date" value={prefs?.nextOneOnOne ?? ''} onChange={(e) => prefs && savePrefs({ ...prefs, nextOneOnOne: e.target.value })} />
            </Field>
          </div>
          <Field label="Topics"><textarea className="textarea" rows={2} value={d.topics} onChange={(e) => set('topics', e.target.value)} /></Field>
          <Field label="Commitments I made" hint="One per line."><textarea className="textarea" rows={2} value={d.mine} onChange={(e) => set('mine', e.target.value)} /></Field>
          <Field label="Commitments they made" hint="One per line."><textarea className="textarea" rows={2} value={d.theirs} onChange={(e) => set('theirs', e.target.value)} /></Field>
          <Field label="Feedback received"><textarea className="textarea" rows={2} value={d.feedback} onChange={(e) => set('feedback', e.target.value)} /></Field>
          <div><button className="btn btn-primary" type="button" disabled={empty} onClick={save}>Save 1:1</button></div>
        </div>
      </Card>

      <Card title="Past 1:1s">
        {!notes?.length ? (
          <Empty title="No 1:1 notes yet">Write down what you each committed to after your next 1:1. It takes two minutes and settles every later argument.</Empty>
        ) : (
          <ul className="car-list">
            {notes.map((n, i) => {
              const items = [
                ...n.me.map((t) => ({ who: 'me' as const, t })),
                ...n.them.map((t) => ({ who: 'them' as const, t })),
              ]
              const open = items.filter((c) => !closed?.has(commitmentKey(n.date, c.who, c.t)))
              return (
                <li key={`${n.date}-${i}`} className="car-note">
                  <div className="row-between">
                    <strong>{formatDate(n.date)}</strong>
                    <span className="muted small">{open.length} open</span>
                  </div>
                  {n.topics.length > 0 && <p className="muted small">{n.topics.join(' / ')}</p>}
                  {open.map((c) => {
                    const key = commitmentKey(n.date, c.who, c.t)
                    return (
                      <div key={key} className="car-commit">
                        <span><span className="chip">{c.who === 'me' ? 'Me' : 'Them'}</span> {c.t}</span>
                        {c.who === 'me' ? (
                          <button className="btn btn-sm" type="button" onClick={() => makeTask(key, c.t)} aria-label={`Make task: ${c.t}`}>Make task</button>
                        ) : (
                          <button className="btn btn-sm" type="button" onClick={() => done(key)} aria-label={`Mark done: ${c.t}`}>Done</button>
                        )}
                      </div>
                    )
                  })}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
