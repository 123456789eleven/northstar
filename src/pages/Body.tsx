// Gym, Weigh-in floor: hero (7-day average, one-tap weigh-in, path with 5 lb flags, pace), then the chart and the flags.
// Goal settings and calorie guidance sit behind More. The weigh-in log is the chart's table view.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import ChartFrame from '../components/ChartFrame'
import DataTable from '../components/DataTable'
import { PageSkeleton } from '../components/ui'
import { useToast } from '../components/toastContext'
import { db } from '../db'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { GoalPanel, GuidanceCard } from '../features/body/BodyPanels'
import { readBodySettings, removeWeight } from '../features/body/bodyData'
import { checkpointFlags, ghostLine } from '../features/body/pathModel'
import { paceNote } from '../features/body/pace'
import WeighInHero from '../features/body/WeighInHero'
import WeightPath from '../features/body/WeightPath'
import { averageAt, movingAverage, projectDate, weeklyRate } from '../features/body/model'
import { addDays, daysBetween, formatDate, today } from '../lib/dates'
import '../features/body/body.css'
import '../features/goals/quest.css'
import '../features/goals/season.css'
import '../features/body/body2.css'
import '../features/body/gym.css'

const fmtLong = (d: string) => formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' })

export default function Body() {
  const toast = useToast()
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])
  const settingRows = useLiveQuery(() => db.settings.where('key').startsWith('body.').toArray(), [])
  const meals = useLiveQuery(() => db.meals.where('date').between(addDays(today(), -27), today(), true, true).toArray(), [])
  const [range, setRange] = useState<30 | 90 | 0>(90)

  const s = useMemo(() => readBodySettings(settingRows ?? []), [settingRows])
  const w = useMemo(() => weights ?? [], [weights])
  const series = useMemo(() => movingAverage(w), [w])
  const intake = useMemo(() => {
    const by = new Map<string, number>()
    for (const m of meals ?? []) if (m.calories) by.set(m.date, (by.get(m.date) ?? 0) + m.calories)
    return [...by.values()]
  }, [meals])

  if (!weights || !settingRows || !meals) return <PageSkeleton rows={4} />

  const t = today()
  const latest = w.at(-1)
  const current = latest ? (averageAt(w, t) ?? series.at(-1)!.avg) : null
  const weekAgo = averageAt(w, addDays(t, -7))
  const change = current != null && weekAgo != null ? current - weekAgo : null
  const rate = weeklyRate(w, t)
  const start = s.startWeight ?? w[0]?.weight ?? s.goal
  const toGo = current != null ? Math.abs(s.goal - current) : null
  const projNow = current != null ? projectDate(current, s.goal, rate, t) : null
  const goalDateRate = current != null && s.goalDate && s.goalDate > t && toGo ? (toGo / daysBetween(t, s.goalDate)) * 7 : null
  const flags = current != null ? checkpointFlags(w, start, s.goal, current) : []
  const ghost = current != null ? ghostLine(current, s.goal, t, s.goalDate) : { points: [], endDate: null, makesTarget: true }
  const shown = range ? series.filter((p) => p.date >= addDays(t, -range)) : series
  const when = projNow && projNow !== t ? `about ${fmtLong(projNow)}` : undefined
  const pace = current != null ? paceNote({ rate, current, goal: s.goal, neededRate: goalDateRate, projected: when }) : null

  const more = (
    <FloorMore
      floor="Weigh-in"
      items={[
        { id: 'goal', label: 'Goal and date', value: `${s.goal} lb`, panel: <GoalPanel s={s} firstWeight={w[0]?.weight} /> },
        { id: 'guide', label: 'Calorie guidance', panel: <GuidanceCard s={s} weights={w} rate={rate} weight={current} intake={intake} remaining={toGo ?? 0} goalDateRate={goalDateRate} /> },
        { id: 'kitchen', label: 'Food targets', to: '/food' },
      ]}
    />
  )

  const hero = (
    <WeighInHero
      current={current}
      start={start}
      goal={s.goal}
      flags={flags}
      change={change}
      pace={pace}
      toGo={toGo}
      loggedToday={w.find((x) => x.date === t)?.weight}
      last={latest?.weight}
    />
  )

  if (current == null) return <FloorView label="Weigh-in" className="gym-floor" hero={hero} more={more} />

  const chart = (
    <ChartFrame
      key="chart"
      title="Weight path"
      hasData={series.length > 0}
      controls={
        <div className="row" style={{ gap: 6 }}>
          {([30, 90, 0] as const).map((r) => (
            <button key={r} className="btn btn-sm" aria-pressed={range === r} onClick={() => setRange(r)}>{r === 0 ? 'All' : `${r}d`}</button>
          ))}
        </div>
      }
      legend={[{ label: '7-day average', color: 'var(--accent)' }, { label: 'Healthy pace', color: 'var(--ink-2)' }, { label: 'Weigh-ins', color: 'var(--accent-line)' }]}
      table={
        <DataTable
          label="Weigh-ins"
          rows={[...series].reverse().slice(0, 60)}
          rowKey={(r) => r.date}
          columns={[
            { key: 'date', header: 'Date', primary: true, render: (r) => fmtLong(r.date) },
            { key: 'w', header: 'Weight (lb)', align: 'right', value: true, render: (r) => r.weight.toFixed(1) },
            { key: 'a', header: '7-day avg', align: 'right', render: (r) => r.avg.toFixed(1) },
            {
              key: 'x', header: '', render: (r) => (
                <button className="btn btn-ghost body-tbl-x" aria-label={`Remove ${r.date}`} onClick={async () => {
                  const row = w.find((x) => x.date === r.date)
                  const undo = row?.id != null ? await removeWeight(row.id) : null
                  if (undo) toast({ message: 'Weigh-in removed', undo })
                }}>&times;</button>
              ),
            },
          ]}
        />
      }
    >
      <WeightPath data={shown.length ? shown : series} flags={flags} ghost={ghost} goal={s.goal} />
    </ChartFrame>
  )

  const flagCard = flags.length > 0 && (
    <FloorCard key="flags" title="Flags" label="Checkpoints">
      <ul className="gym-flags" aria-label="Checkpoints">
        {flags.map((f) => (
          <li key={f.target} className={`gym-flag${f.reached ? ' is-reached' : ''}${f.next ? ' is-next' : ''}`}>
            <span className="mono">{f.target} lb</span>
            <span>{f.reached ? (f.crossedOn ? formatDate(f.crossedOn) : 'Crossed') : f.next ? `${f.lbToGo.toFixed(1)} to go` : ''}</span>
          </li>
        ))}
      </ul>
    </FloorCard>
  )

  return <FloorView label="Weigh-in" className="gym-floor" hero={hero} support={[chart, flagCard]} more={more} />
}
