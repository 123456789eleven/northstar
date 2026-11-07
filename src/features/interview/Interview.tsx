// The Interview page (/interview). First visit: a short guided flow, one section at a time in big type. After that (or with
// ?full=1, which You links to) the full version: every section as a tab. Answers save as you leave each field; "Apply" writes the real records.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../../db'
import { Card, Field, PageHeader, PageSkeleton, Progress, Tabs } from '../../components/ui'
import { applyAnswers, hasAnything } from './apply'
import { allQuestions, answersAsText, isAnswered, PROFILE_KEY, progress, SECTIONS, type Answers, type Question } from './questions'
import './interview.css'

function QuestionField({ q, value, onChange }: { q: Question; value: Answers[string] | undefined; onChange: (v: Answers[string] | undefined) => void }) {
  const hint = <>{q.why}{q.unit && q.type === 'number' ? ` (${q.unit})` : ''}</>
  if (q.type === 'choice') {
    return (
      <Field label={q.label} hint={q.why}>
        <div className="iv-chips" role="group" aria-label={q.label}>
          {q.options!.map((o) => <button key={o} type="button" className="chip" aria-pressed={value === o} onClick={() => onChange(value === o ? undefined : o)}>{o}</button>)}
        </div>
      </Field>
    )
  }
  if (q.type === 'multi') {
    const cur = Array.isArray(value) ? value : []
    return (
      <Field label={q.label} hint={q.why}>
        <div className="iv-chips" role="group" aria-label={q.label}>
          {q.options!.map((o) => <button key={o} type="button" className="chip" aria-pressed={cur.includes(o)} onClick={() => onChange(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])}>{o}</button>)}
        </div>
      </Field>
    )
  }
  if (q.type === 'long') {
    return <Field label={q.label} hint={hint}><textarea className="input" rows={3} defaultValue={typeof value === 'string' ? value : ''} onBlur={(e) => onChange(e.target.value)} /></Field>
  }
  if (q.type === 'number') {
    return <Field label={q.label} hint={hint}><input className="input" inputMode="decimal" defaultValue={typeof value === 'number' ? String(value) : ''} onBlur={(e) => { const n = Number(e.target.value.replace(/[$,\s]/g, '')); onChange(e.target.value.trim() && Number.isFinite(n) ? n : undefined) }} /></Field>
  }
  return <Field label={q.label} hint={hint}><input className="input" placeholder={q.placeholder} defaultValue={typeof value === 'string' ? value : ''} onBlur={(e) => onChange(e.target.value)} /></Field>
}

function ApplyCard({ answers }: { answers: Answers }) {
  const [msg, setMsg] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const apply = async () => {
    setBusy(true)
    try { const r = await applyAnswers(answers); setMsg(r.length ? r : ['Nothing new to apply yet. Answer a few questions first.']) } finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(answersAsText(answers)); setMsg(['Copied. Paste it into a chat to get advice from your own answers.']) } catch { setMsg(['Copy failed. Your browser blocked clipboard access.']) }
  }
  return (
    <Card title="Put it to work" sub="Creates goals, people, targets and your VTI holding from what you answered. Safe to run again: nothing is duplicated.">
      <div className="row iv-actions">
        <button className="btn btn-primary" disabled={busy || !hasAnything(answers)} onClick={apply}>Apply my answers</button>
        <button className="btn" disabled={!hasAnything(answers)} onClick={copy}>Copy answers</button>
      </div>
      {msg.length > 0 && <ul className="iv-result" role="status">{msg.map((m) => <li key={m}>{m}</li>)}</ul>}
      <p className="small faint" style={{ margin: 0 }}>{allQuestions().length} questions in total. Long answers are kept as notes and not turned into records.</p>
    </Card>
  )
}

/** First visit: one section at a time, big type. Skip anything; nothing is lost if you leave. */
function Guided({ answers, set, onFull }: { answers: Answers; set: (id: string, v: Answers[string] | undefined) => void; onFull: () => void }) {
  const [i, setI] = useState(0)
  const [done, setDone] = useState(false)
  const section = SECTIONS[i]
  const last = i === SECTIONS.length - 1
  if (done) {
    return (
      <div className="stack iv-guided">
        <PageHeader title="That is enough to start" sub="Your answers are saved on this device. Apply them now, or finish the rest any time from You." />
        <ApplyCard answers={answers} />
        <div className="row iv-actions"><button className="btn" onClick={onFull}>Open the full interview</button></div>
      </div>
    )
  }
  return (
    <div className="stack iv-guided">
      <p className="iv-step small muted" aria-live="polite">Section {i + 1} of {SECTIONS.length}</p>
      <Progress value={((i + 1) / SECTIONS.length) * 100} label="Interview progress" />
      <h1 className="iv-big">{section.title}</h1>
      <p className="iv-lede">{section.blurb}</p>
      <div className="stack iv-form iv-form-big" key={section.id}>
        {section.questions.map((q) => <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />)}
      </div>
      <div className="row iv-actions iv-nav">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        <button className="btn btn-primary" onClick={() => (last ? setDone(true) : setI(i + 1))}>{last ? 'Finish' : 'Next'}</button>
        <button className="btn btn-ghost" onClick={onFull}>Show every section</button>
      </div>
    </div>
  )
}

function Full({ answers, set }: { answers: Answers; set: (id: string, v: Answers[string] | undefined) => void }) {
  const [tab, setTab] = useState(SECTIONS[0].id)
  const p = progress(answers)
  const section = SECTIONS.find((s) => s.id === tab)!
  return (
    <div className="stack">
      <PageHeader title="Interview" sub={`${p.done} of ${p.total} answered. Skip anything. Answers stay on this device.`} />
      <Card>
        <Progress value={p.total ? (p.done / p.total) * 100 : 0} label="Interview progress" />
        <Tabs value={tab} onChange={setTab} options={SECTIONS.map((s) => ({ value: s.id, label: `${s.title} ${p.bySection[s.id].done}/${p.bySection[s.id].total}` }))} />
      </Card>
      <Card title={section.title} sub={section.blurb}>
        <div className="stack iv-form">
          {section.questions.map((q) => <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />)}
        </div>
      </Card>
      <ApplyCard answers={answers} />
    </div>
  )
}

function Inner({ saved, startGuided }: { saved: Answers; startGuided: boolean }) {
  const [draft, setDraft] = useState<Answers | null>(null)
  const [guided, setGuided] = useState(startGuided)
  const answers = draft ?? saved
  const set = (id: string, v: Answers[string] | undefined) => {
    const next = { ...answers }
    if (v === undefined || !isAnswered(v)) delete next[id]
    else next[id] = v
    setDraft(next)
    void setSetting(PROFILE_KEY, next)
  }
  return guided ? <Guided answers={answers} set={set} onFull={() => setGuided(false)} /> : <Full answers={answers} set={set} />
}

export default function Interview() {
  const saved = useLiveQuery(() => getSetting<Answers>(PROFILE_KEY, {}), [])
  const [params] = useSearchParams()
  if (!saved) return <PageSkeleton strip={false} rows={5} />
  // Decided once, when the answers first load: the first visit (nothing answered, no ?full=1) is the guided flow.
  return <Inner saved={saved} startGuided={params.get('full') !== '1' && progress(saved).done === 0} />
}
