// Full-screen writing surface. Sets data-focus on <html> (CSS hides the app chrome), restores on exit/unmount.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { composeTemplate, parseAnswers, type JournalTemplate } from './templates'
import { wordCount } from './stats'
import type { JournalPrefs } from './prefs'

interface Props {
  title: string
  text: string
  onChange: (text: string) => void
  /** null = saving, '' = nothing yet, else a time label */
  saved: string | null
  prefs: JournalPrefs
  onPref: (patch: Partial<JournalPrefs>) => void
  template?: JournalTemplate
  /** done = user chose Done (offer the closing ritual) */
  onExit: (done: boolean) => void
}

const MIRROR_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom', 'whiteSpace', 'overflowWrap', 'wordBreak', 'tabSize'] as const

/** Pixel y of the caret inside a textarea (content coordinates), measured with a hidden mirror. */
function caretY(ta: HTMLTextAreaElement): number {
  const mirror = document.createElement('div')
  const cs = getComputedStyle(ta)
  for (const p of MIRROR_PROPS) mirror.style[p] = cs[p]
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.width = `${ta.clientWidth}px`
  mirror.style.boxSizing = 'border-box'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.textContent = ta.value.slice(0, ta.selectionStart)
  const mark = document.createElement('span')
  mark.textContent = '​'
  mirror.appendChild(mark)
  document.body.appendChild(mirror)
  const y = mark.offsetTop
  mirror.remove()
  return y
}

export function FocusMode({ title, text, onChange, saved, prefs, onPref, template, onExit }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const [elapsed, setElapsed] = useState(0)
  const [steps, setSteps] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [goalDraft, setGoalDraft] = useState<string | null>(null)
  const [wordsAtStart] = useState(() => wordCount(text))

  // Chrome hiding + restore.
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-focus', '1')
    return () => el.removeAttribute('data-focus')
  }, [])

  // Fit to the visual viewport so the on-screen keyboard never covers the caret or footer.
  useLayoutEffect(() => {
    const vv = window.visualViewport
    const fit = () => {
      const el = root.current
      if (!el) return
      el.style.height = `${vv ? vv.height : window.innerHeight}px`
      el.style.transform = vv ? `translateY(${vv.offsetTop}px)` : ''
    }
    fit()
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => {
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
    }
  }, [])

  useEffect(() => {
    const ta = area.current
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
  }, [steps, step])

  useEffect(() => {
    if (!prefs.timer) return
    const t0 = Date.now() - elapsed * 1000
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line
  }, [prefs.timer])

  // Keep the caret line centered while typing.
  const center = () => {
    const ta = area.current
    if (!prefs.typewriter || !ta || steps) return
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 30
    ta.scrollTop = Math.max(0, caretY(ta) - ta.clientHeight / 2 + lh / 2)
  }
  useEffect(center, [text, prefs.typewriter]) // eslint-disable-line

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onExit(false); return }
    if (e.key === 'Tab') {
      // simple focus trap across the overlay controls
      const els = root.current?.querySelectorAll<HTMLElement>('button, input, textarea')
      if (!els?.length) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    if (steps && template && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); next() }
  }

  const words = wordCount(text)
  const pct = Math.min(100, Math.round((words / prefs.goal) * 100))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  const startSteps = () => {
    if (!template) return
    const a = parseAnswers(template, text)
    setAnswers(a)
    const firstEmpty = a.findIndex((x) => !x)
    setStep(firstEmpty < 0 ? 0 : firstEmpty)
    setSteps(true)
  }
  const setAnswer = (v: string) => {
    if (!template) return
    const a = template.sections.map((_, i) => (i === step ? v : answers[i] ?? ''))
    setAnswers(a)
    onChange(composeTemplate(template, a))
  }
  function next() {
    if (!template) return
    if (step < template.sections.length - 1) setStep(step + 1)
    else setSteps(false)
  }
  const commitGoal = () => {
    if (goalDraft == null) return
    const n = Math.round(Number(goalDraft))
    if (Number.isFinite(n) && n > 0) onPref({ goal: Math.min(5000, n) })
    setGoalDraft(null)
  }

  const section = template?.sections[step]
  return (
    <div ref={root} className="jr-focus" role="dialog" aria-modal="true" aria-label={`Writing focus, ${title}`} onKeyDown={onKey}>
      <div className="jr-focus-bar">
        <span className="jr-focus-title">{title}</span>
        <div className="jr-focus-tools">
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={prefs.typewriter} onClick={() => onPref({ typewriter: !prefs.typewriter })}>Typewriter</button>
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={prefs.timer} onClick={() => onPref({ timer: !prefs.timer })}>Timer</button>
          {template && !steps && <button type="button" className="btn btn-ghost btn-sm" onClick={startSteps}>Step through</button>}
          {template && steps && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSteps(false)}>Free edit</button>}
          <button type="button" className="btn btn-sm" onClick={() => onExit(false)}>Exit <span className="muted">Esc</span></button>
        </div>
      </div>
      <div className="jr-focus-progress" role="progressbar" aria-label="Daily word goal" aria-valuemin={0} aria-valuemax={prefs.goal} aria-valuenow={Math.min(words, prefs.goal)}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="jr-focus-main">
        {steps && section ? (
          <div className="jr-focus-col jr-step">
            <div className="jr-step-count">{step + 1} of {template!.sections.length} · {section.label}</div>
            <h2 className="jr-step-prompt">{section.prompt}</h2>
            <textarea ref={area} className="jr-focus-text jr-step-text" aria-label={section.label} value={answers[step] ?? ''} onChange={(e) => setAnswer(e.target.value)} />
            <div className="row jr-step-nav">
              <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={next}>{step === template!.sections.length - 1 ? 'Finish steps' : 'Next'}</button>
              <span className="small muted">Ctrl+Enter for next</span>
            </div>
          </div>
        ) : (
          <textarea
            ref={area}
            className={`jr-focus-text jr-focus-col ${prefs.typewriter ? 'tw' : ''}`}
            aria-label="Journal entry"
            placeholder="Write anything."
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyUp={center}
            onClick={center}
          />
        )}
      </div>
      <div className="jr-focus-foot">
        <span aria-live="polite">{words} / {goalDraft == null ? (
          <button type="button" className="jr-goal" onClick={() => setGoalDraft(String(prefs.goal))} aria-label={`Daily goal ${prefs.goal} words, change`}>{prefs.goal}</button>
        ) : (
          <input className="jr-goal-in" autoFocus inputMode="numeric" aria-label="Daily word goal" value={goalDraft} onChange={(e) => setGoalDraft(e.target.value.replace(/\D/g, ''))} onBlur={commitGoal} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitGoal() } }} />
        )} words{words >= prefs.goal ? ' · goal met' : ''}{words > wordsAtStart ? ` · +${words - wordsAtStart} this session` : ''}</span>
        {prefs.timer && <span className="mono" aria-label="Session time">{mm}:{ss}</span>}
        <span aria-live="polite">{saved === null ? 'Saving…' : saved ? `Saved ${saved}` : 'Saved'}</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onExit(true)}>Done</button>
      </div>
    </div>
  )
}
