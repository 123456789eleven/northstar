// Season page parts: the quarter header (the top season goal with a coach note) and the swipeable story cards for the week,
// with a share card drawn on-device.
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
import { paceNote, seasonOf, storyOrder, type StoryId } from '../you/season'
import { weekDigest } from './summary'
import { buildShareModel, renderShareCard, saveShareCard } from './shareCard'
import { loadWeekNumbers, type NumberItem, type WeekSnapshot } from './weekNumbers'
import '../goals/quest.css'
import '../you/you.css'

export function SeasonHeader() {
  const d = today()
  const season = seasonOf(d)
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const data = useLiveQuery(() => loadMetricData(), [])
  const boss = useMemo(() => pickBosses(goals ?? [], 1)[0], [goals])
  const metric = boss?.metric && data ? goalMetric(boss, data) : null
  const loaded = goals !== undefined && tasks !== undefined
  const hp = boss && tasks ? bossHp(boss, tasks, metric) : null
  return (
    <section className="card ssn-head" aria-label="This season" data-testid="season-header">
      <div className="ssn-top">
        <span className="ssn-name">{season.name}</span>
        <span className="ssn-days">{season.daysLeft === 0 ? 'Last day of the season' : `${season.daysLeft} ${season.daysLeft === 1 ? 'day' : 'days'} left`}</span>
      </div>
      {!loaded ? <Skeleton lines={2} label="Loading season" /> : boss ? (
        <>
          <div className="ssn-boss-title">{boss.title}</div>
          <BossBar hp={hp!} flags={bossCheckpoints(boss, metric, data)} label={boss.title} calm />
          <div className="ssn-boss-meta">
            <span>{bossNumber(boss, tasks, metric)}</span>
            <span>{Math.round(hp!.progress * 100)}% done</span>
          </div>
          <p className="ssn-coach">{paceNote(hp!.progress, season.elapsed, season.daysLeft)}</p>
        </>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>No season goal yet. <Link to="/goals">Set one for this quarter</Link> and it shows up here.</p>
      )}
    </section>
  )
}

const TITLES: Record<StoryId, string> = { summary: 'The week', wins: 'Wins', slipped: 'Missed', numbers: 'Body and money', next: 'Next week' }

export function SeasonStories({ weekOf, snapshot, wins, focusNext, planned }: { weekOf: ISODate; snapshot?: WeekSnapshot; wins?: string; focusNext?: string; planned?: string }) {
  const res = useLiveQuery(async () => ({ weekOf, d: await weekDigest(weekOf), items: snapshot ? snapshot.items : await loadWeekNumbers(weekOf) }), [weekOf, snapshot])
  const [idx, setIdx] = useState(0)
  const [shareMsg, setShareMsg] = useState('')
  const [busy, setBusy] = useState(false)
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
        ) : <p className="small muted" style={{ margin: 0 }}>Nothing missed. Every task due this week is done.</p>
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

  const share = async () => {
    setBusy(true); setShareMsg('')
    try {
      const blob = await renderShareCard(buildShareModel({ weekOf, digest: d, items, wins, focusNext, planned }))
      if (!blob) { setShareMsg('This browser cannot draw the card.'); return }
      const r = await saveShareCard(blob, `northstar-week-${weekOf}.png`)
      setShareMsg(r === 'shared' ? 'Card ready to share.' : 'Card saved to your downloads.')
    } catch { setShareMsg('Could not make the card. Try again.') } finally { setBusy(false) }
  }
  const step = (n: number) => go(Math.max(0, Math.min(order.length - 1, idx + n)))

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
      <div className="story-actions">
        <button type="button" className="btn btn-sm story-step" aria-label="Previous card" disabled={idx <= 0} onClick={() => step(-1)}>Back</button>
        <button type="button" className="btn btn-sm story-step" aria-label="Next card" disabled={idx >= order.length - 1} onClick={() => step(1)}>Next</button>
        <button type="button" className="btn btn-primary btn-sm story-share" disabled={busy} onClick={() => void share()}>{busy ? 'Drawing...' : 'Share card'}</button>
        <span className="small muted" role="status">{shareMsg}</span>
      </div>
    </section>
  )
}
