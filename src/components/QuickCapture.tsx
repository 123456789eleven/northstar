// Global quick-capture bar. One line of text -> task / expense / meal / win.
// Focus with "/" or Ctrl+K. Parser lives in lib/capture.ts.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { describeCapture, parseCapture, type CaptureGoal } from '../lib/capture'
import { saveCapture, type Saved } from '../features/tasks/captureSave'
import { openBulk } from '../features/bulk/openBulk'
import '../features/tasks/tasks.css'

export default function QuickCapture({ autoFocus = false }: { autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<Saved | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const timer = useRef<number | undefined>(undefined)

  const goals = useLiveQuery(
    async () =>
      (await db.goals.where('status').equals('active').toArray()).map(
        (g): CaptureGoal => ({ id: g.id!, title: g.title, area: g.area, horizon: g.horizon }),
      ),
    [],
  )

  const parsed = useMemo(() => parseCapture(text, { goals: goals ?? [] }), [text, goals])
  const preview = describeCapture(parsed)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        ref.current?.focus()
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function submit() {
    const result = await saveCapture(parsed)
    if (!result) return
    setText('')
    setSaved(result)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(null), 6000)
  }

  async function undo() {
    if (!saved) return
    await saved.undo()
    setSaved(null)
    window.clearTimeout(timer.current)
  }

  return (
    <div className="qc">
      <div className="qc-box">
        <input
          ref={ref}
          autoFocus={autoFocus}
          className="qc-input"
          value={text}
          placeholder="Capture: call mom fri !1 #career"
          aria-label="Quick capture"
          onChange={(e) => {
            setText(e.target.value)
            if (saved) setSaved(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            } else if (e.key === 'Escape') {
              setText('')
              e.currentTarget.blur()
            }
          }}
        />
        {text.trim() && preview.length > 0 ? (
          <div className="qc-preview" aria-live="polite">
            {preview.map((p, i) => (
              <span key={i} className={`chip ${i === 0 ? 'chip-accent' : ''}`} title={p}>
                {p}
              </span>
            ))}
          </div>
        ) : saved ? (
          <div className="qc-saved" aria-live="polite">
            {saved.label}
            <button className="btn btn-ghost btn-sm" onClick={() => void undo()}>
              Undo
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="btn btn-ghost btn-sm qc-many" onClick={() => openBulk()}>
              Add many
            </button>
            <span className="qc-kbd" aria-hidden>
              /
            </span>
          </>
        )}
      </div>
    </div>
  )
}
