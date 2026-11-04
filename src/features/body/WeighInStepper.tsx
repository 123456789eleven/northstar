// Large inline weigh-in: type a weight or nudge by 0.1, one tap Save. Sits in the thumb zone on phone (sticky above the bottom bar).
import { useState, type FormEvent } from 'react'
import { useToast } from '../../components/toastContext'
import { formatDate, today } from '../../lib/dates'
import { logWeight } from './bodyData'

export default function WeighInStepper({ loggedToday, last, first = false }: { loggedToday?: number; last?: number; first?: boolean }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const [showDate, setShowDate] = useState(false)
  const t = today()
  const parsed = Number(text.trim().replace(/\s*lbs?$/i, ''))
  const base = text.trim() && Number.isFinite(parsed) ? parsed : (loggedToday ?? last ?? 150)

  const nudge = (d: number) => setText((Math.round((base + d) * 10) / 10).toFixed(1))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const r = await logWeight(date || t, parsed)
    if (!r) { toast({ message: 'Enter a weight between 50 and 700 lb' }); return }
    setText('')
    setDate('')
    setShowDate(false)
    toast({
      message: r.milestones.length ? `${r.updated ? 'Updated' : 'Logged'} ${r.weight} lb. Checkpoint: 7-day average passed ${r.milestones.at(-1)} lb` : `${r.updated ? 'Updated' : 'Logged'} ${r.weight} lb for ${r.date === t ? 'today' : formatDate(r.date)}`,
      undo: r.undo,
    })
  }

  return (
    <form className={`card wstep ${first ? 'is-first' : ''}`} onSubmit={submit}>
      <div className="wstep-row">
        <button type="button" className="btn wstep-btn" onClick={() => nudge(-0.1)} aria-label="Lower by 0.1 pound">-0.1</button>
        <div className="wstep-field">
          <input
            className="input wstep-input"
            inputMode="decimal"
            autoComplete="off"
            placeholder={loggedToday != null ? `Today: ${loggedToday} lb. Type to update` : last != null ? `Last: ${last} lb` : 'e.g. 136.4'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Weight in pounds"
          />
          <span className="wstep-unit" aria-hidden>lb</span>
        </div>
        <button type="button" className="btn wstep-btn" onClick={() => nudge(0.1)} aria-label="Raise by 0.1 pound">+0.1</button>
        <button className="btn btn-primary wstep-save" type="submit" disabled={!text.trim()}>{loggedToday != null ? 'Update' : 'Save'}</button>
      </div>
      <div className="wstep-more">
        {showDate ? (
          <input className="input" type="date" max={t} value={date || t} onChange={(e) => setDate(e.target.value)} aria-label="Date of weigh-in" />
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDate(true)}>Change date</button>
        )}
        <span className="faint">Or in the capture bar: <span className="mono">w 136.4</span></span>
      </div>
    </form>
  )
}
