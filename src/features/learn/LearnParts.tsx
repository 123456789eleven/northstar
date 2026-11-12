// Learn tab (Money): a structured path through stocks, bonds and funds. All content is local; progress lives in the `learn.progress` setting.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSetting, logEvent, setSetting } from '../../db'
import { glossary, LESSONS, TRACKS, type LearnProgress, type Lesson, type Question } from './content'
import {
  completeLesson, isDone, nextLesson, normalizeProgress, overall, PASS_PCT, PROGRESS_KEY, recordQuiz,
  scoreQuiz, searchLessons, searchTerms, touch, trackStats, uncompleteLesson,
} from './logic'
import './learn.css'

type View = { kind: 'home' } | { kind: 'glossary' } | { kind: 'lesson'; id: string }

function useProgress() {
  const row = useLiveQuery(async () => ({ v: await getSetting<unknown>(PROGRESS_KEY, null) }), [])
  const progress = useMemo(() => normalizeProgress(row?.v), [row])
  const save = async (next: LearnProgress) => { await setSetting(PROGRESS_KEY, next) }
  return { progress, ready: row !== undefined, save }
}

export default function LearnTab() {
  const { progress, ready, save } = useProgress()
  const [view, setView] = useState<View>({ kind: 'home' })
  const topRef = useRef<HTMLDivElement>(null)
  const go = (v: View) => { setView(v); requestAnimationFrame(() => { topRef.current?.scrollIntoView({ block: 'start' }); topRef.current?.focus({ preventScroll: true }) }) }

  if (!ready) return <p className="muted" role="status">Loading</p>
  return (
    <div className="ln" ref={topRef} tabIndex={-1}>
      {view.kind === 'home' && <Home progress={progress} open={(id) => go({ kind: 'lesson', id })} glossary={() => go({ kind: 'glossary' })} />}
      {view.kind === 'glossary' && <Glossary back={() => go({ kind: 'home' })} />}
      {view.kind === 'lesson' && <LessonView key={view.id} id={view.id} progress={progress} save={save} go={go} />}
    </div>
  )
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg className="ln-ring" viewBox="0 0 80 80" role="img" aria-label={label}>
      <circle cx="40" cy="40" r={r} className="ln-ring-bg" />
      <circle cx="40" cy="40" r={r} className="ln-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 40 40)" />
      <text x="40" y="45" textAnchor="middle" className="ln-ring-t">{pct}%</text>
    </svg>
  )
}

function Home({ progress, open, glossary: openGlossary }: { progress: LearnProgress; open: (id: string) => void; glossary: () => void }) {
  const [q, setQ] = useState('')
  const total = overall(progress, LESSONS)
  const next = nextLesson(progress, LESSONS)
  const started = total.done > 0 || !!progress.last
  const found = useMemo(() => searchLessons(LESSONS, q), [q])
  const searching = q.trim().length > 0
  return (
    <>
      <section className="ln-hero" aria-labelledby="ln-hero-h">
        <div className="ln-hero-main">
          <p className="ln-eyebrow">{next ? (started ? 'Continue where you left off' : 'Start here') : 'Path complete'}</p>
          <h2 id="ln-hero-h" className="ln-hero-title">{next ? next.title : 'Every lesson is done'}</h2>
          <p className="muted">{next ? `${TRACKS.find((t) => t.id === next.track)!.title}, ${next.minutes} min read. ${next.summary}` : 'Revisit any lesson below, or retake a check.'}</p>
          {next && <button className="btn btn-primary" onClick={() => open(next.id)}>{started ? 'Continue lesson' : 'Start first lesson'}</button>}
        </div>
        <div className="ln-hero-side">
          <Ring pct={total.pct} label={`${total.done} of ${total.total} lessons complete`} />
          <p className="ln-count mn-num"><strong>{total.done}</strong> of {total.total} lessons</p>
        </div>
      </section>

      <div className="ln-bar">
        <label className="sr-only" htmlFor="ln-search">Search lessons</label>
        <input id="ln-search" className="input ln-search" type="search" placeholder="Search lessons" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-sm" onClick={openGlossary}>Glossary ({glossary.length})</button>
      </div>

      {searching ? (
        <section aria-label="Search results">
          {found.length === 0 ? <p className="muted">No lesson matches "{q}". Try a word like bond, fee or stop, or search the glossary.</p> : <LessonList lessons={found} progress={progress} open={open} />}
        </section>
      ) : (
        <div className="ln-tracks">
          {TRACKS.map((t) => {
            const s = trackStats(progress, LESSONS, t.id)
            return (
              <section key={t.id} className="ln-track" aria-labelledby={`ln-t-${t.id}`}>
                <header className="ln-track-head">
                  <h3 id={`ln-t-${t.id}`}>{t.title}</h3>
                  <span className={`ln-track-count mn-num ${s.complete ? 'is-complete' : ''}`}>{s.complete ? 'Complete' : `${s.done} of ${s.total}`}</span>
                </header>
                <p className="muted ln-track-blurb">{t.blurb}</p>
                <LessonList lessons={LESSONS.filter((l) => l.track === t.id)} progress={progress} open={open} />
              </section>
            )
          })}
        </div>
      )}
      <p className="ln-foot">Education, not advice.</p>
    </>
  )
}

function LessonList({ lessons, progress, open }: { lessons: Lesson[]; progress: LearnProgress; open: (id: string) => void }) {
  return (
    <ul className="ln-list">
      {lessons.map((l) => {
        const done = isDone(progress, l.id)
        return (
          <li key={l.id}>
            <button className="ln-row" onClick={() => open(l.id)} aria-label={`${l.title}, ${l.minutes} minutes${done ? ', complete' : ''}`}>
              <span className={`ln-dot ${done ? 'is-done' : ''}`} aria-hidden="true">{done ? '✓' : ''}</span>
              <span className="ln-row-text"><span className="ln-row-title">{l.title}</span><span className="ln-row-sub">{l.summary}</span></span>
              <span className="ln-row-min mn-num" aria-hidden="true">{l.minutes} min</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Glossary({ back }: { back: () => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => searchTerms(glossary, q), [q])
  return (
    <section aria-labelledby="ln-gl-h" className="ln-read">
      <button className="btn btn-sm btn-ghost ln-back" onClick={back}>All lessons</button>
      <h2 id="ln-gl-h" className="ln-title">Glossary</h2>
      <p className="muted">{glossary.length} terms, in plain language.</p>
      <label className="sr-only" htmlFor="ln-gl-q">Search the glossary</label>
      <input id="ln-gl-q" className="input ln-search" type="search" placeholder="Search terms" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? <p className="muted">No term matches "{q}".</p> : (
        <dl className="ln-gl" aria-live="polite">
          {list.map((t) => <div key={t.id} className="ln-gl-item"><dt>{t.term}</dt><dd>{t.def}</dd></div>)}
        </dl>
      )}
      <p className="ln-foot">Education, not advice.</p>
    </section>
  )
}

function LessonView({ id, progress, save, go }: { id: string; progress: LearnProgress; save: (p: LearnProgress) => Promise<void>; go: (v: View) => void }) {
  const idx = LESSONS.findIndex((l) => l.id === id)
  const lesson = LESSONS[idx]
  const done = isDone(progress, id)
  const track = TRACKS.find((t) => t.id === lesson?.track)
  const prev = LESSONS[idx - 1]
  const next = LESSONS[idx + 1]
  // Remember where the reader is so the home hero can continue from here.
  useEffect(() => { if (lesson && progress.last !== id) void save(touch(progress, id)) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!lesson || !track) return <p className="muted">That lesson no longer exists. <button className="btn btn-sm" onClick={() => go({ kind: 'home' })}>All lessons</button></p>

  const markDone = async () => {
    const { progress: p2, newlyComplete } = completeLesson(progress, LESSONS, id, new Date().toISOString())
    await save(p2)
    for (const tid of newlyComplete) {
      const t = TRACKS.find((x) => x.id === tid)!
      await logEvent({ area: 'learning', kind: 'learn.track', title: `Finished the ${t.title} track`, milestone: true, refKey: `learn.track.${tid}` })
    }
  }
  const terms = lesson.terms.map((tid) => glossary.find((g) => g.id === tid)).filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <article className="ln-read" aria-labelledby="ln-title">
      <button className="btn btn-sm btn-ghost ln-back" onClick={() => go({ kind: 'home' })}>All lessons</button>
      <p className="ln-eyebrow">{track.title}, lesson {LESSONS.filter((l) => l.track === lesson.track).findIndex((l) => l.id === id) + 1} &middot; {lesson.minutes} min read{done ? ' · complete' : ''}</p>
      <h2 id="ln-title" className="ln-title">{lesson.title}</h2>
      <p className="ln-lede">{lesson.summary}</p>

      {lesson.body.map((s, i) => (
        <section key={i} className="ln-sec">
          {s.h && <h3>{s.h}</h3>}
          {s.p?.map((p, j) => <p key={j}>{p}</p>)}
          {s.list && <ul>{s.list.map((x, j) => <li key={j}>{x}</li>)}</ul>}
        </section>
      ))}

      <aside className="ln-example" aria-labelledby="ln-ex-h">
        <h3 id="ln-ex-h">{lesson.example.title}</h3>
        <ol>{lesson.example.lines.map((l, i) => <li key={i} className="mn-num">{l}</li>)}</ol>
      </aside>

      <section className="ln-sec ln-wrong" aria-labelledby="ln-wrong-h">
        <h3 id="ln-wrong-h">What can go wrong</h3>
        <ul>{lesson.wrong.map((w, i) => <li key={i}>{w}</li>)}</ul>
      </section>

      {terms.length > 0 && (
        <section className="ln-sec" aria-labelledby="ln-terms-h">
          <h3 id="ln-terms-h">Key terms</h3>
          <dl className="ln-gl ln-gl-tight">{terms.map((t) => <div key={t.id} className="ln-gl-item"><dt>{t.term}</dt><dd>{t.def}</dd></div>)}</dl>
        </section>
      )}

      {lesson.tool && <p className="ln-tool"><Link className="btn btn-sm" to={lesson.tool.to}>{lesson.tool.label}</Link> <span className="muted">Opens the Money page.</span></p>}

      <Quiz questions={lesson.quiz} best={progress.lessons[id]?.best} onScored={(pct) => save(recordQuiz(progress, id, pct))} />

      <div className="ln-complete">
        {done ? (
          <>
            <p role="status" className="ln-done-note">Marked complete.</p>
            <button className="btn btn-sm btn-ghost" onClick={() => save(uncompleteLesson(progress, id))}>Mark as not done</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={markDone}>Mark complete</button>
        )}
      </div>

      <nav className="ln-pager" aria-label="Lesson navigation">
        {prev ? <button className="btn" onClick={() => go({ kind: 'lesson', id: prev.id })}><span className="muted">Previous</span> {prev.title}</button> : <span />}
        {next ? <button className="btn" onClick={() => go({ kind: 'lesson', id: next.id })}><span className="muted">Next</span> {next.title}</button> : <span />}
      </nav>
      <p className="ln-foot">Education, not advice.</p>
    </article>
  )
}

function Quiz({ questions, best, onScored }: { questions: Question[]; best?: number; onScored: (pct: number) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null))
  const finished = answers.every((a) => a !== null)
  const score = scoreQuiz(questions, answers)
  const pick = (qi: number, oi: number) => {
    if (answers[qi] !== null) return
    const next = answers.map((a, i) => (i === qi ? oi : a))
    setAnswers(next)
    if (next.every((a) => a !== null)) onScored(scoreQuiz(questions, next).pct)
  }
  return (
    <section className="ln-sec ln-quiz" aria-labelledby="ln-quiz-h">
      <h3 id="ln-quiz-h">Check your understanding</h3>
      {best !== undefined && <p className="muted mn-num">Best score {best}%</p>}
      {questions.map((q, qi) => {
        const a = answers[qi]
        return (
          <fieldset key={qi} className="ln-q">
            <legend>{qi + 1}. {q.q}</legend>
            {q.options.map((o, oi) => {
              const chosen = a === oi
              const state = a === null ? '' : oi === q.answer ? 'is-right' : chosen ? 'is-wrong' : ''
              return (
                <label key={oi} className={`ln-opt ${state} ${chosen ? 'is-chosen' : ''}`}>
                  <input type="radio" name={`q${qi}`} checked={chosen} disabled={a !== null} onChange={() => pick(qi, oi)} />
                  <span>{o}</span>
                </label>
              )
            })}
            {a !== null && <p className="ln-why" role="status"><strong>{a === q.answer ? 'Correct.' : 'Not quite.'}</strong> {q.why}</p>}
          </fieldset>
        )
      })}
      {finished && (
        <div className="ln-score" role="status">
          <p className="mn-num"><strong>{score.correct} of {score.total}</strong> correct. {score.passed ? 'Passed.' : `The pass mark is ${PASS_PCT}%. Review the lesson and try again.`}</p>
          <button className="btn btn-sm" onClick={() => { setAnswers(questions.map(() => null)) }}>Retake check</button>
        </div>
      )}
    </section>
  )
}
