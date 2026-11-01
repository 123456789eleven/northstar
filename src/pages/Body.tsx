import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type FormEvent } from 'react'
import ChartFrame from '../components/ChartFrame'
import DataTable from '../components/DataTable'
import KpiStrip from '../components/KpiStrip'
import { Card, Empty, PageHeader } from '../components/ui'
import { useToast } from '../components/toastContext'
import { db } from '../db'
import BodyChart from '../features/body/BodyChart'
import { GoalPanel, GuidanceCard, TrainingCard } from '../features/body/BodyPanels'
import { logWeight, readBodySettings, removeWeight } from '../features/body/bodyData'
import { averageAt, HEALTHY_RATE, milestoneCrossings, movingAverage, projectDate, weeklyRate } from '../features/body/model'
import { addDays, daysBetween, formatDate, today } from '../lib/dates'
import '../features/body/body.css'

const fmtLong = (d: string) => formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' })
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(1)}`

export default function Body() {
  const toast = useToast()
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])
  const settingRows = useLiveQuery(() => db.settings.where('key').startsWith('body.').toArray(), [])
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.where('date').between(addDays(today(), -7), today(), true, true).toArray(), [])
  const meals = useLiveQuery(() => db.meals.where('date').between(addDays(today(), -27), today(), true, true).toArray(), [])
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const [showDate, setShowDate] = useState(false)
  const [range, setRange] = useState<30 | 90 | 0>(90)

  const s = useMemo(() => readBodySettings(settingRows ?? []), [settingRows])
  const w = useMemo(() => weights ?? [], [weights])
  const series = useMemo(() => movingAverage(w), [w])
  const intake = useMemo(() => {
    const by = new Map<string, number>()
    for (const m of meals ?? []) if (m.calories) by.set(m.date, (by.get(m.date) ?? 0) + m.calories)
    return [...by.values()]
  }, [meals])

  if (!weights || !settingRows || !habits || !logs || !meals) return null

  const t = today()
  const latest = w.at(-1)
  const current = latest ? (averageAt(w, t) ?? series.at(-1)!.avg) : null
  const weekAgo = averageAt(w, addDays(t, -7))
  const change = current != null && weekAgo != null ? current - weekAgo : null
  const rate = weeklyRate(w, t)
  const start = s.startWeight ?? w[0]?.weight
  const toGo = current != null ? Math.max(0, s.goal - current) : null
  const projNow = current != null ? projectDate(current, s.goal, rate, t) : null
  const projHealthy = current != null ? projectDate(current, s.goal, HEALTHY_RATE, t) : null
  const goalDateRate = current != null && s.goalDate && s.goalDate > t && toGo ? (toGo / daysBetween(t, s.goalDate)) * 7 : null
  const crossings = start != null ? milestoneCrossings(w, start, s.goal) : []
  const shown = range ? series.filter((p) => p.date >= addDays(t, -range)) : series
  const loggedToday = w.find((x) => x.date === t)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(text.trim().replace(/\s*lbs?$/i, ''))
    const r = await logWeight(date || t, n)
    if (!r) { toast({ message: 'Enter a weight between 50 and 700 lb' }); return }
    setText('')
    setDate('')
    setShowDate(false)
    toast({
      message: r.milestones.length ? `${r.updated ? 'Updated' : 'Logged'} ${r.weight} lb. Milestone: 7-day average passed ${r.milestones.at(-1)} lb` : `${r.updated ? 'Updated' : 'Logged'} ${r.weight} lb for ${r.date === t ? 'today' : formatDate(r.date)}`,
      undo: r.undo,
    })
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader title="Body" sub={`Lean-mass goal: ${s.goal} lb${start != null ? `, starting from ${start} lb` : ''}`} />

      <form className="card body-log" onSubmit={submit}>
        <input className="input body-log-big" inputMode="decimal" autoComplete="off" placeholder={loggedToday ? `Today: ${loggedToday.weight} lb. Type to update` : 'Today’s weight in lb, e.g. 136.4'} value={text} onChange={(e) => setText(e.target.value)} aria-label="Weight in pounds" />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>Log</button>
        <div className="body-log-more">
          {showDate ? (
            <input className="input" type="date" max={t} value={date || t} onChange={(e) => setDate(e.target.value)} aria-label="Date of weigh-in" />
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDate(true)}>Change date</button>
          )}
          <span className="faint">Or in the capture bar: <span className="mono">w 136.4</span> or <span className="mono">weighed 136.4 yesterday</span></span>
        </div>
      </form>

      {w.length === 0 ? (
        <>
          <Card><Empty>No weigh-ins yet. Step 1: log today&apos;s weight above. Step 2: check your goal below ({s.goal} lb). A trend appears after about two weeks of logs.</Empty></Card>
          <GoalPanel s={s} />
          <GuidanceCard s={s} weights={w} rate={null} weight={null} intake={intake} remaining={0} goalDateRate={null} />
        </>
      ) : (
        <>
          <KpiStrip
            items={[
              { label: 'Current (7-day avg)', value: `${current!.toFixed(1)} lb`, note: latest ? `Last weigh-in ${latest.weight} lb, ${formatDate(latest.date)}` : undefined },
              { label: 'Change this week', value: change != null ? `${signed(change)} lb` : '--', note: change == null ? 'needs a week of logs' : undefined },
              { label: 'Rate (4 weeks)', value: rate != null ? `${signed(rate)} lb/wk` : '--', note: rate == null ? 'needs 2 weeks of logs' : undefined },
              { label: 'To go', value: `${toGo!.toFixed(1)} lb`, note: `Goal ${s.goal} lb` },
              { label: 'Projected', value: projNow ? (projNow === t ? 'Reached' : fmtLong(projNow)) : '--', note: projNow ? `At ${signed(rate ?? 0)} lb/wk. At ${HEALTHY_RATE} lb/wk: ${projHealthy === t ? 'now' : projHealthy ? fmtLong(projHealthy) : '--'}` : `Needs a rising trend. At ${HEALTHY_RATE} lb/wk: ${projHealthy ? fmtLong(projHealthy) : '--'}` },
            ]}
          />

          <ChartFrame
            title="Weight trend"
            hasData={series.length > 0}
            controls={
              <div className="row" style={{ gap: 6 }}>
                {([30, 90, 0] as const).map((r) => (
                  <button key={r} className="btn btn-sm" aria-pressed={range === r} onClick={() => setRange(r)}>{r === 0 ? 'All' : `${r}d`}</button>
                ))}
              </div>
            }
            legend={[{ label: '7-day average', color: '#e3b261' }, { label: 'Daily weigh-ins (faint)', color: 'rgba(227,178,97,0.4)' }]}
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
            <BodyChart data={shown.length ? shown : series} goal={s.goal} />
          </ChartFrame>

          {crossings.length > 0 && (
            <div className="body-ms small" aria-label="Milestones">
              {crossings.map((c) => (
                <span key={c.target} className={c.date ? 'chip chip-accent' : 'chip'}>{c.target} lb{c.date ? `, ${formatDate(c.date)}` : ''}</span>
              ))}
            </div>
          )}

          <GuidanceCard s={s} weights={w} rate={rate} weight={current} intake={intake} remaining={toGo ?? 0} goalDateRate={goalDateRate} />
          <TrainingCard habits={habits} logs={logs} target={s.trainDays} />
          <GoalPanel s={s} firstWeight={w[0]?.weight} />
        </>
      )}
    </div>
  )
}
