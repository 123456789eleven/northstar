// Bank, Academy floor: the next lesson and a ring per track (finishing a lesson fills its track ring), the paper practice
// account, the trade journal and calculators. Lessons, the glossary, practice, journal and tools open as views on this floor.
// Education only: simulated money, no advice, no trades.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageSkeleton } from '../components/ui'
import { db } from '../db'
import { money } from '../lib/dates'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { BankView, useView, useViewHref } from '../features/bank/bankNav'
import { Ring } from '../features/game/ui/Ring'
import { LESSONS, TRACKS } from '../features/learn/content'
import { Glossary, LessonsIndex, LessonView, useProgress, type View } from '../features/learn/LearnParts'
import { nextLesson, overall, trackStats } from '../features/learn/logic'
import AccountPanel from '../features/practice/AccountPanel'
import JournalPanel, { type DraftSeed } from '../features/practice/JournalPanel'
import ToolsPanel from '../features/practice/ToolsPanel'
import { usePaper } from '../features/practice/usePaper'
import '../features/finance/money.css'
import '../features/practice/practice.css'
import '../features/learn/learn.css'
import '../features/bank/bank.css'

const TOOLS = ['Growth', 'Position size', 'Bonds', 'DCA']

function PracticeCard({ href }: { href: string }) {
  const { model } = usePaper()
  if (!model) return <FloorCard title="Practice account"><p className="bk-empty">Loading</p></FloorCard>
  const s = model.summary
  return (
    <FloorCard title="Practice account" action={<Link className="btn btn-sm" to={href}>Trade</Link>}>
      <dl className="ac-stats">
        <div><dt>Equity</dt><dd>{money(s.equity)}</dd></div>
        <div><dt>Since start</dt><dd className={model.total < 0 ? 'warn' : model.total > 0 ? 'fg-ahead' : ''}>{model.total >= 0 ? '+' : '-'}{money(Math.abs(model.total))}</dd></div>
      </dl>
      <p className="bk-fine">{s.positions.length ? `${s.positions.length} open ${s.positions.length === 1 ? 'position' : 'positions'}.` : 'No open positions.'} Simulated money.</p>
    </FloorCard>
  )
}

function JournalCard({ href }: { href: string }) {
  const n = useLiveQuery(() => db.tradeJournal.count(), [])
  return (
    <FloorCard title="Trade journal" action={<Link className="btn btn-sm" to={href}>Write</Link>}>
      <p className="vt-big-line mn-num"><strong>{n ?? 0}</strong> <span className="muted small">{n === 1 ? 'entry' : 'entries'}</span></p>
      <p className="bk-fine">Thesis before the trade, review after.</p>
    </FloorCard>
  )
}

function ToolsCard({ href }: { href: string }) {
  return (
    <FloorCard title="Calculators" action={<Link className="btn btn-ghost btn-sm" to={href}>Open</Link>}>
      <div className="ac-tools">{TOOLS.map((t) => <Link key={t} className="chip" to={href}>{t}</Link>)}</div>
    </FloorCard>
  )
}

export default function Academy() {
  const view = useView()
  const href = useViewHref()
  const navigate = useNavigate()
  const { state, search } = useLocation()
  const { progress, ready, save } = useProgress()
  const id = new URLSearchParams(search).get('id')
  useEffect(() => { window.scrollTo(0, 0) }, [view, id])

  if (view === 'practice') {
    return (
      <BankView title="Practice account" back="Academy">
        <div className="pr">
          <p className="pr-banner">Paper account: simulated money. No real trades.</p>
          <AccountPanel onJournal={(tradeId, symbol) => navigate(href('journal'), { state: { seed: { tradeId, symbol } } })} />
        </div>
      </BankView>
    )
  }
  if (view === 'journal') {
    const seed = ((state as { seed?: DraftSeed } | null)?.seed ?? null) as DraftSeed
    return <BankView title="Trade journal" back="Academy"><div className="pr"><JournalPanel seed={seed} clearSeed={() => navigate(href('journal'), { replace: true, state: null })} /></div></BankView>
  }
  if (view === 'tools') return <BankView title="Calculators" back="Academy"><div className="pr"><ToolsPanel /></div></BankView>
  if (!ready) return <PageSkeleton rows={3} />
  const open = (lessonId: string) => navigate(href('lesson', { id: lessonId }))
  if (view === 'glossary') return <BankView title="Glossary" back="Academy"><div className="ln"><Glossary /></div></BankView>
  if (view === 'lessons') return <BankView title="All lessons" back="Academy"><LessonsIndex progress={progress} open={open} /></BankView>
  if (view === 'lesson' && id) {
    const lesson = LESSONS.find((l) => l.id === id)
    const st = lesson ? trackStats(progress, LESSONS, lesson.track) : null
    const go = (v: View) => (v.kind === 'lesson' ? open(v.id) : navigate(href(v.kind === 'glossary' ? 'glossary' : null)))
    return (
      <BankView
        title={lesson ? TRACKS.find((t) => t.id === lesson.track)!.title : 'Lesson'}
        back="Academy"
        action={st && (
          <Ring value={st.total ? st.done / st.total : 0} size={40} stroke={4} tone={st.complete ? 'reward' : undefined} label={`${st.done} of ${st.total} lessons in this track`}>
            <span className="mn-num small">{st.done}</span>
          </Ring>
        )}
      >
        <div className="ln"><LessonView key={id} id={id} progress={progress} save={save} go={go} /></div>
      </BankView>
    )
  }

  const total = overall(progress, LESSONS)
  const next = nextLesson(progress, LESSONS)
  const started = total.done > 0 || !!progress.last
  const hero = (
    <section className="card floor-hero ac-hero" aria-label="Lessons">
      <div className="ac-next">
        <span className="stat-label">{next ? (started ? 'Up next' : 'Start here') : 'Path complete'}</span>
        <h2>{next ? next.title : 'Every lesson done'}</h2>
        {next && <span className="small muted">{TRACKS.find((t) => t.id === next.track)!.title}, {next.minutes} min</span>}
        <div className="row">
          {next && <Link className="btn btn-primary" to={href('lesson', { id: next.id })}>{started ? 'Continue' : 'Start lesson'}</Link>}
          <span className="small muted mn-num">{total.done} of {total.total} lessons</span>
        </div>
      </div>
      <ul className="ac-tracks" aria-label="Tracks">
        {TRACKS.map((t) => {
          const s = trackStats(progress, LESSONS, t.id)
          return (
            <li key={t.id}>
              <Link className="ac-track" to={href('lessons')} aria-label={`${t.title}: ${s.done} of ${s.total}`}>
                <Ring value={s.total ? s.done / s.total : 0} size={56} stroke={5} tone={s.complete ? 'reward' : undefined}>
                  <span className="mn-num small">{s.done}/{s.total}</span>
                </Ring>
                <span>{t.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )

  return (
    <FloorView
      label="Academy"
      className="bk ac"
      hero={hero}
      support={[<PracticeCard key="pr" href={href('practice')} />, <JournalCard key="jr" href={href('journal')} />, <ToolsCard key="tl" href={href('tools')} />]}
      more={
        <>
          <FloorMore
            floor="Academy"
            items={[
              { id: 'lessons', label: 'All lessons', value: `${total.done}/${total.total}`, to: href('lessons') },
              { id: 'glossary', label: 'Glossary', to: href('glossary') },
            ]}
          />
          <p className="bk-fine">Education, not advice.</p>
        </>
      }
    />
  )
}
