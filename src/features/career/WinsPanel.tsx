import { useState } from 'react'
import { Empty } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { formatDate } from '../../lib/dates'
import { addWin, removeWin } from './careerData'
import { TAG_LABEL, WIN_TAGS, formatImpact, type WinTag } from './impact'
import type { Win } from './leadership'

export function QuickWin({ onLogged, bare = false }: { onLogged?: () => void; bare?: boolean }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [tags, setTags] = useState<WinTag[]>([])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = await addWin(text, tags)
    if (!r) return
    setText('')
    setTags([])
    onLogged?.()
    toast({ message: 'Win logged. It is in your case.', undo: r.undo })
  }
  const flip = (t: WinTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  return (
    <form className={`${bare ? '' : 'card '}car-quick`} onSubmit={submit}>
      <div className="car-quick-row">
        <input
          className="input"
          aria-label="Log a win"
          placeholder="What went well? One line"
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="done"
        />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>Log win</button>
      </div>
      <div className="car-tags" role="group" aria-label="Win tags">
        {WIN_TAGS.map((t) => (
          <button key={t} type="button" className={`chip car-tag ${tags.includes(t) ? 'chip-accent' : ''}`} aria-pressed={tags.includes(t)} onClick={() => flip(t)}>
            {TAG_LABEL[t]}
          </button>
        ))}
      </div>
      <p className="muted small car-hint">Add a number: #impact 3h/week</p>
    </form>
  )
}

export function WinsList({ wins, limit = 50 }: { wins: Win[]; limit?: number }) {
  const toast = useToast()
  if (!wins.length) return <Empty title="No wins yet">Log your first one above. Small ones count.</Empty>
  const remove = async (w: Win) => {
    const undo = await removeWin(w.id)
    if (undo) toast({ message: 'Win removed', undo })
  }
  return (
    <ul className="car-list" aria-label="Wins">
      {wins.slice(0, limit).map((w) => (
        <li key={w.id} className="car-win">
          <div className="car-win-main">
            <span className="car-win-title">{w.title}</span>
            <span className="car-win-meta">
              <span className="muted small">{formatDate(w.date)}</span>
              {w.impact && <span className="chip chip-accent">{formatImpact(w.impact)}</span>}
              {w.tags.map((t) => <span key={t} className="chip">{TAG_LABEL[t]}</span>)}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" aria-label={`Remove win: ${w.title}`} onClick={() => remove(w)}>Remove</button>
        </li>
      ))}
    </ul>
  )
}
