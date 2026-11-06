// Season page parts: the quarter header (boss bar of the top quarter goal) and the phone story cards for the week.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ISODate } from '../../db'
import { Skeleton } from '../../components/ui'
import { formatDate, money, today } from '../../lib/dates'
import { bossCheckpoints, bossHp, bossNumber, pickBosses } from '../goals/boss'
import { BossBar } from '../goals/BossBar'
import { goalMetric } from '../progress/metrics'
import { loadMetricData } from '../progress/metricsData'
import { usePlayerState } from '../game/ui/playerContext'
import { seasonOf, storyOrder, type StoryId } from '../you/season'
import { weekDigest } from './summary'
import { loadWeekNumbers, type NumberItem, type WeekSnapshot } from './weekNumbers'
import '../goals/quest.css'
import '../you/you.css'

export function SeasonHeader() {
  const calm = usePlayerState().calm
  const d = today()
  const season = seasonOf(d)
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const data = useLiveQuery(() => loadMetricData(), [])
  const boss = useMemo(() => pickBosses(goals ?? [], 1)[0], [goals])
  const metric = boss?.metric && data ? goalMetric(boss, data) : null
  const loaded = goals !== undefined && tasks !== undefined
  return (
    <section className="card ssn-head" aria-label="This season" data-testid="season-header">
      <div className="ssn-top">
        <span className="ssn-name">{season.name}</span>
        <span className="ssn-days">{season.daysLeft === 0 ? 'Last day of the season' : `${season.daysLeft} ${season.daysLeft === 1 ? 'day' : 'days'} left`}</span>
      </div>
      {!loaded ? <Skeleton lines={2} label="Loading season" /> : boss ? (
        <>
          <div className="ssn-boss-title">{boss.title}</div>
          <BossBar hp={bossHp(boss, tasks, metric)} flags={bossCheckpoints(boss, metric, data)} label={boss.title} calm={calm} />
          <div className="ssn-boss-meta">
            <span>{bossNumber(boss, tasks, metric)}</span>
            <span>{calm ? `${Math.round(bossHp(boss, tasks, metric).progress * 100)}% done` : `Boss HP ${Math.round(bossHp(boss, tasks, metric).hp * 100)}%`}</span>
          </div>
        </>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>No quarter goal yet. <Link to="/goals">Create this season&apos;s boss</Link> and it shows up here.</p>
      )}
    </section>
  )
}

const TITLES: Record<StoryId, string> = { summary: 'The week', wins: 'Wins', slipped: 'Slipped', numbers: 'Body and money', next: 'Next week' }

export function SeasonStories({ weekOf, snapshot, wins, focusNext, planned }: { weekOf: ISODate; snapshot?: WeekSnapshot; wins?: string; focusNext?: string; planned?: string }) {
  const res = useLiveQuery(async () => ({ weekOf, d: await weekDigest(weekOf), items: snapshot ? snapshot.items : await loadWeekNumbers(weekOf) }), [weekOf, snapshot])
  const [idx, setIdx] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const ready = !!res && res.weekOf === weekOf
  const d = ready ? res.d : undefined
  const items: NumberItem[] = ready ? res.items : []
  const bodyMoney = items.filter((i) => ['weight', 'workouts', 'spend'].includes(i.key))
  const winLines = [...(d?.milestones.map((m) => m.title) ?? []), ...(wins ? wins.split('\n').filter(Boolean) : [])]
  const order = storyOrder({ wins: winLines.length > 0, slipped: (d?.slipped.length ?? 0) > 0, numbers: bodyMoney.some((i) => !i.empty) })

  useEffect(() => {
    const el = track.current
    if (!el) return
    const on = () => setIdx(Math.round(el.scrollLeft / Math.max(1, (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth)))
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [ready])

  if (!d) return <section className="card story" aria-busy="true"><Skeleton lines={4} label="Loading the week" /></section>

  const body = (id: StoryId) => {
    switch (id) {
      case 'summary':
        return (
          <>
            <div className="story-big">{d.tasksDone}</div>
            <div className="small muted">{d.tasksDone === 1 ? 'task' : 'tasks'} completed</div>
            <div className="story-mini small">
              <span>{d.mealDays} of 7 days with meals</span>
              <span>{d.studyMinutes} min studied</span>
              <span>{d.peopleContacted} {d.peopleContacted === 1 ? 'person' : 'people'} reached</span>
              <span>{d.hasMoney ? `${money(d.spent)} spent` : 'No spending logged'}</span>
            </div>
          </>
        )
      case 'wins':
        return winLines.length ? <ul className="story-list">{winLines.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}</ul> : <p className="small muted" style={{ margin: 0 }}>No milestones yet this week. Add what went well in the form below.</p>
      case 'slipped':
        return d.slipped.length ? (
          <ul className="story-list">{d.slipped.slice(0, 5).map((t) => <li key={t.id}><span className="faint small">{formatDate(t.due!)} </span>{t.title}</li>)}</ul>
        ) : <p className="small muted" style={{ margin: 0 }}>Nothing slipped. Every task due this week is done.</p>
      case 'numbers':
        return bodyMoney.length ? (
          <ul className="story-list">{bodyMoney.map((i) => <li key={i.key}><b>{i.label}</b> {i.empty ? <span className="faint small">{i.note}</span> : <>{i.value} <span className="faint small">{i.note}</span></>}</li>)}</ul>
        ) : <p className="small muted" style={{ margin: 0 }}>No body or money numbers for this week.</p>
      case 'next':
        return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{focusNext || planned || 'Write one line about next week in the form below.'}</p>
    }
  }

  const go = (i: number) => {
    const el = track.current
    const card = el?.children[i] as HTMLElement | undefined
    if (el && card) el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return (
    <section className="story" aria-label="Week story" data-testid="story-cards">
      <div className="story-track" ref={track} tabIndex={0} role="group" aria-label="Week story cards, scroll sideways">
        {order.map((id) => (
          <article key={id} className="card story-card" data-story={id} aria-label={TITLES[id]}>
            <h3>{TITLES[id]}</h3>
            {body(id)}
          </article>
        ))}
      </div>
      <div className="story-dots" role="group" aria-label="Story cards">
        {order.map((id, i) => <button key={id} type="button" className="story-dot" aria-label={`Show ${TITLES[id]}`} aria-current={idx === i ? 'true' : undefined} onClick={() => go(i)} />)}
      </div>
    </section>
  )
}
