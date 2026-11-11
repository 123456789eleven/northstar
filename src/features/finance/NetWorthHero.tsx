// Net worth hero (big number, change, next milestone) and the path chart with a flag at every $5k crossed plus the previous high.
import { useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTip } from '../../components/ChartTip'
import { ACTIVE_DOT, CHART, GRID_PROPS, MARGIN, X_AXIS, Y_AXIS, tooltipProps } from '../../components/chartTheme'
import { useNumberRoll } from '../../components/motion'
import { formatDate, money, parseISODate, today } from '../../lib/dates'
import '../g3/g3.css'
import { compactMoney } from './model'
import { netWorthMilestones } from './moneyGame'
import { autoStep, changeOver, isNewHigh, paceText, paceToNext } from './wealth'

const MONEY = 'var(--accent)'
const MUTED = CHART.axis
const iso = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function NetWorthHero({ series, label = 'Net worth', testId = 'networth-hero' }: { series: { date: string; net: number }[]; label?: string; testId?: string }) {
  const now = series.at(-1)?.net ?? 0
  const shown = useNumberRoll(Math.round(now))
  const t = today()
  const ms = netWorthMilestones(series, autoStep(Math.max(...series.map((p) => p.net), 0)))
  const next = ms.flags.find((f) => f.next)
  const earned = isNewHigh(series)
  const changes = [
    { k: 'Today', v: changeOver(series, 1, t) },
    { k: '7 days', v: changeOver(series, 7, t) },
    { k: '30 days', v: changeOver(series, 30, t) },
  ]
  const prev = series.length > 1 ? series.at(-2)!.net : null
  return (
    <section className="card nhero" aria-label={label}>
      <div className="nhero-main">
        <span className="stat-label">{label}{earned && <span className="nhero-high" data-testid="nw-high"> All-time high</span>}</span>
        <div className="nhero-num mono" data-testid={testId}>{shown < 0 ? '-' : ''}{money(Math.abs(shown))}</div>
        <dl className="nhero-changes" aria-label="Change">
          {changes.map((c) => (
            <div key={c.k}>
              <dt>{c.k}</dt>
              <dd className={`mono ${c.v == null ? 'faint' : c.v < 0 ? 'warn' : ''}`}>{c.v == null ? 'Not yet' : `${c.v >= 0 ? '+' : '-'}${money(Math.abs(c.v))}`}</dd>
            </div>
          ))}
        </dl>
        {changes.every((c) => c.v == null) && (
          <span className="small muted">{prev != null ? `${now - prev >= 0 ? 'Up' : 'Down'} ${money(Math.abs(now - prev))} since your last update.` : 'Add a second update and the change shows up here.'}</span>
        )}
      </div>
      <div className="nhero-side small">
        {next && ms.toNext != null && (
          <div data-testid="nw-next">
            <span className="stat-label">Next milestone, {money(next.target)}</span>
            <div>{paceText(paceToNext(series, ms.toNext), ms.toNext, money(next.target), whole)}</div>
          </div>
        )}
        {ms.high && !earned && <div><span className="stat-label">Your high</span><div className="mono">{money(ms.high.net)} <span className="faint">{formatDate(ms.high.date, { month: 'short', year: '2-digit' })}</span></div></div>}
      </div>
    </section>
  )
}

const whole = (n: number) => Math.round(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** Axis ticks in clean 1/2/5 steps covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = Math.max(1, hi - lo)
  const raw = span / Math.max(1, count - 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag
  const out: number[] = []
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + 1e-9; v += step) out.push(Math.round(v))
  return out
}

export function NetWorthPath({ data, name = 'Net worth' }: { data: { date: string; net: number }[]; name?: string }) {
  const rows = data.map((d) => ({ x: parseISODate(d.date).getTime(), net: d.net }))
  const ms = netWorthMilestones(data, autoStep(Math.max(...data.map((p) => p.net), 0)))
  const earned = isNewHigh(data)
  const vals = rows.map((r) => r.net)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals, ms.flags.find((f) => f.next)?.target ?? -Infinity)
  const [hover, setHover] = useState(false)
  const ticks = niceTicks(lo, hi)
  const fmt = (v: number) => formatDate(iso(v), { month: 'short', day: 'numeric', year: '2-digit' })
  return (
    <div className="wpath" role="img" aria-label={`${name} path, now ${money(data.at(-1)?.net ?? 0)}, ${ms.flags.filter((f) => f.reached).length} milestones crossed`}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ ...MARGIN, right: 12 }} onMouseMove={() => !hover && setHover(true)} onMouseLeave={() => setHover(false)}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmt} minTickGap={32} />
          <YAxis {...Y_AXIS} tickFormatter={(v: number) => compactMoney(v)} width={60} ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} interval={0} />
          <Tooltip active={hover ? undefined : false} {...tooltipProps(<ChartTip fmt={money} labelFmt={(l) => fmt(Number(l))} />)} />
          {ms.flags.map((f) => (
            <ReferenceLine key={f.target} y={f.target} ifOverflow="hidden" stroke={f.reached ? MONEY : MUTED} strokeOpacity={f.reached ? 0.8 : 0.5} strokeDasharray={f.reached ? undefined : '4 4'}
              label={{ value: f.reached ? compactMoney(f.target) : `${compactMoney(f.target)}, ${whole(f.target - (data.at(-1)?.net ?? 0))} to go`, position: 'insideTopLeft', fill: f.reached ? MONEY : MUTED, fontSize: 12 }} />
          ))}
          {ms.high && data.length > 1 && !earned && <ReferenceLine y={ms.high.net} ifOverflow="hidden" stroke={MUTED} strokeDasharray="2 4" label={{ value: 'High', position: 'insideBottomRight', fill: MUTED, fontSize: 12 }} />}
          {earned && <ReferenceDot x={rows.at(-1)!.x} y={rows.at(-1)!.net} r={6} fill="var(--reward)" stroke={CHART.surface} strokeWidth={2} ifOverflow="extendDomain" label={{ value: 'All-time high', position: 'top', fill: 'var(--reward)', fontSize: 12 }} />}
          <Line type="monotone" dataKey="net" name={name} stroke={MONEY} strokeWidth={2.5} dot={data.length <= 24 ? { r: 3, fill: MONEY, stroke: CHART.surface, strokeWidth: 2 } : false} activeDot={ACTIVE_DOT(MONEY)} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
