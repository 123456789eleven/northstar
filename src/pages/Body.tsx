import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import ChartFrame from '../components/ChartFrame'
import DataTable from '../components/DataTable'
import { Card, PageHeader, PageSkeleton, Tabs } from '../components/ui'
import { useToast } from '../components/toastContext'
import { db } from '../db'
import BodyHero from '../features/body/BodyHero'
import { GoalPanel, GuidanceCard } from '../features/body/BodyPanels'
import { readBodySettings, removeWeight } from '../features/body/bodyData'
import { checkpointFlags, ghostLine } from '../features/body/pathModel'
import TrainingPanel from '../features/body/TrainingPanel'
import WeighInStepper from '../features/body/WeighInStepper'
import WeightPath from '../features/body/WeightPath'
import { averageAt, HEALTHY_RATE, movingAverage, projectDate, weeklyRate } from '../features/body/model'
import { addDays, daysBetween, formatDate, today } from '../lib/dates'
import '../features/body/body.css'

const fmtLong = (d: string) => formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' })

export default function Body() {
  const toast = useToast()
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])
  const settingRows = useLiveQuery(() => db.settings.where('key').startsWith('body.').toArray(), [])
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.where('date').between(addDays(today(), -7), today(), true, true).toArray(), [])
  const meals = useLiveQuery(() => db.meals.where('date').between(addDays(today(), -27), today(), true, true).toArray(), [])
  const [tab, setTab] = useState<'weight' | 'training'>('weight')
  const [range, setRange] = useState<30 | 90 | 0>(90)

  const s = useMemo(() => readBodySettings(settingRows ?? []), [settingRows])
  const w = useMemo(() => weights ?? [], [weights])
  const series = useMemo(() => movingAverage(w), [w])
  const intake = useMemo(() => {
    const by = new Map<string, number>()
    for (const m of meals ?? []) if (m.calories) by.set(m.date, (by.get(m.date) ?? 0) + m.calories)
    return [...by.values()]
  }, [meals])

  if (!weights || !settingRows || !habits || !logs || !meals) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <PageHeader title="Body" sub=" " />
        <PageSkeleton rows={4} />
      </div>
    )
  }

  const t = today()
  const latest = w.at(-1)
  const current = latest ? (averageAt(w, t) ?? series.at(-1)!.avg) : null
  const weekAgo = averageAt(w, addDays(t, -7))
  const change = current != null && weekAgo != null ? current - weekAgo : null
  const rate = weeklyRate(w, t)
  const start = s.startWeight ?? w[0]?.weight
  const toGo = current != null ? Math.abs(s.goal - current) : null
  const projNow = current != null ? projectDate(current, s.goal, rate, t) : null
  const goalDateRate = current != null && s.goalDate && s.goalDate > t && toGo ? (toGo / daysBetween(t, s.goalDate)) * 7 : null
  const flags = start != null && current != null ? checkpointFlags(w, start, s.goal, current) : []
  const ghost = current != null ? ghostLine(current, s.goal, t, s.goalDate) : { points: [], endDate: null, makesTarget: true }
  const shown = range ? series.filter((p) => p.date >= addDays(t, -range)) : series
  const loggedToday = w.find((x) => x.date === t)
  const sub = `Goal: ${s.goal} lb${start != null ? `, starting from ${start} lb` : ''}`

  return (
    <div className="stack body-page" style={{ gap: 16 }}>
      <PageHeader title="Body" sub={sub} />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'weight', label: 'Weight' }, { value: 'training', label: 'Training' }]} />

      {tab === 'training' && (
        <div className="body-split">
          <TrainingPanel habits={habits} target={s.trainDays} />
          <GoalPanel s={s} firstWeight={w[0]?.weight} />
        </div>
      )}

      {tab === 'weight' && (w.length === 0 ? (
        <>
          <Card title="Your first weigh-in">
            <ol className="body-first">
              <li><strong>Weigh in.</strong> Type today&apos;s weight below and tap Save. Same time each morning keeps the trend honest.</li>
              <li><strong>Check your goal.</strong> It is {s.goal} lb; change it under Set goal.</li>
              <li><strong>Watch the path.</strong> A 7-day average, a pace line and a flag every 5 lb appear after about two weeks of logs.</li>
            </ol>
          </Card>
          <WeighInStepper first />
          <div className="body-split">
            <GoalPanel s={s} />
            <GuidanceCard s={s} weights={w} rate={null} weight={null} intake={intake} remaining={0} goalDateRate={null} />
          </div>
        </>
      ) : (
        <>
          <BodyHero
            current={current!}
            last={latest ? { weight: latest.weight, label: formatDate(latest.date) } : undefined}
            change={change}
            rate={rate}
            toGo={toGo!}
            goal={s.goal}
            next={flags.find((f) => f.next)}
            projected={projNow ? (projNow === t ? 'reached' : `about ${fmtLong(projNow)} at this pace`) : undefined}
          />

          <div className="wstep-dock"><WeighInStepper loggedToday={loggedToday?.weight} last={latest?.weight} /></div>

          <ChartFrame
            title="Weight path"
            hasData={series.length > 0}
            controls={
              <div className="row" style={{ gap: 6 }}>
                {([30, 90, 0] as const).map((r) => (
                  <button key={r} className="btn btn-sm" aria-pressed={range === r} onClick={() => setRange(r)}>{r === 0 ? 'All' : `${r}d`}</button>
                ))}
              </div>
            }
            legend={[{ label: '7-day average', color: '#9cc8e6' }, { label: `Healthy pace (${HEALTHY_RATE} lb/wk)`, color: '#a9a7ba' }, { label: 'Daily weigh-ins (faint)', color: 'rgba(156,200,230,0.4)' }]}
            table={
              <DataTable
                label="Weigh-ins"
                rows={[...series].reverse().slice(0, 60)}
                rowKey={(r) => r.date}
                columns={[
                  { key: 'date', header: 'Date', primary: true, render: (r) => formatDate(r.date, { month: 'short', day: 'numeric', year: 'numeric' }) },
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

          {flags.length > 0 && (
            <ul className="body-ms small" aria-label="Checkpoints">
              {flags.map((f) => (
                <li key={f.target} className={`flag-chip ${f.reached ? 'is-reached' : ''}`}>
                  <span className="mono">{f.target} lb</span>
                  <span>{f.reached ? (f.crossedOn ? `crossed ${formatDate(f.crossedOn)}` : 'crossed') : f.next ? `${f.lbToGo.toFixed(1)} lb to go` : 'ahead'}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="body-split">
            <GuidanceCard s={s} weights={w} rate={rate} weight={current} intake={intake} remaining={toGo ?? 0} goalDateRate={goalDateRate} />
            <GoalPanel s={s} firstWeight={w[0]?.weight} />
          </div>
        </>
      ))}

    </div>
  )
}
