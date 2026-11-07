// Net worth hero (big number, change, next milestone) and the path chart with a flag at every $5k crossed plus the previous high.
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTip } from '../../components/ChartTip'
import { ACTIVE_DOT, CHART, GRID_PROPS, MARGIN, X_AXIS, Y_AXIS, tooltipProps } from '../../components/chartTheme'
import { useNumberRoll } from '../../components/motion'
import { formatDate, money, parseISODate } from '../../lib/dates'
import '../g3/g3.css'
import { compactMoney } from './model'
import { netWorthMilestones } from './moneyGame'

const MONEY = 'var(--accent)'
const MUTED = CHART.axis
const iso = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function NetWorthHero({ series, label = 'Net worth', testId = 'networth-hero' }: { series: { date: string; net: number }[]; label?: string; testId?: string }) {
  const now = series.at(-1)?.net ?? 0
  const prev = series.length > 1 ? series.at(-2)!.net : null
  const shown = useNumberRoll(Math.round(now))
  const ms = netWorthMilestones(series)
  const delta = prev != null ? now - prev : null
  return (
    <section className="card nhero" aria-label={label}>
      <div className="nhero-main">
        <span className="stat-label">{label}</span>
        <div className="nhero-num mono" data-testid={testId}>{shown < 0 ? '-' : ''}{money(Math.abs(shown))}</div>
        <span className="small muted">
          {delta != null ? `${delta >= 0 ? 'Up' : 'Down'} ${money(Math.abs(delta))} since the last update` : 'Add a second update to see the change'}
        </span>
      </div>
      <div className="nhero-side small">
        {ms.toNext != null && <div><span className="stat-label">Next milestone</span><div className="mono">{money(ms.flags.find((f) => f.next)!.target)}, {money(ms.toNext)} to go</div></div>}
        {ms.high && <div><span className="stat-label">Previous high</span><div className="mono">{money(ms.high.net)} <span className="faint">{formatDate(ms.high.date, { month: 'short', year: '2-digit' })}</span></div></div>}
      </div>
    </section>
  )
}

export function NetWorthPath({ data, name = 'Net worth' }: { data: { date: string; net: number }[]; name?: string }) {
  const rows = data.map((d) => ({ x: parseISODate(d.date).getTime(), net: d.net }))
  const ms = netWorthMilestones(data)
  const vals = rows.map((r) => r.net)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals, ms.flags.find((f) => f.next)?.target ?? -Infinity)
  const fmt = (v: number) => formatDate(iso(v), { month: 'short', day: 'numeric', year: '2-digit' })
  return (
    <div className="wpath" role="img" aria-label={`${name} path, now ${money(data.at(-1)?.net ?? 0)}, ${ms.flags.filter((f) => f.reached).length} milestones crossed`}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ ...MARGIN, right: 12 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmt} minTickGap={32} />
          <YAxis {...Y_AXIS} tickFormatter={(v: number) => compactMoney(v)} width={60} domain={[Math.floor(lo * 0.98), Math.ceil(hi * 1.02)]} />
          <Tooltip {...tooltipProps(<ChartTip fmt={money} labelFmt={(l) => fmt(Number(l))} />)} />
          {ms.flags.map((f) => (
            <ReferenceLine key={f.target} y={f.target} ifOverflow="hidden" stroke={f.reached ? MONEY : MUTED} strokeOpacity={f.reached ? 0.8 : 0.5} strokeDasharray={f.reached ? undefined : '4 4'}
              label={{ value: f.reached ? compactMoney(f.target) : `${compactMoney(f.target)}, ${money(f.target - (data.at(-1)?.net ?? 0))} to go`, position: 'insideTopLeft', fill: f.reached ? MONEY : MUTED, fontSize: 12 }} />
          ))}
          {ms.high && data.length > 1 && <ReferenceLine y={ms.high.net} ifOverflow="hidden" stroke={MUTED} strokeDasharray="2 4" label={{ value: 'High', position: 'insideBottomRight', fill: MUTED, fontSize: 12 }} />}
          <Line type="monotone" dataKey="net" name={name} stroke={MONEY} strokeWidth={2.5} dot={data.length <= 24 ? { r: 3, fill: MONEY, stroke: CHART.surface, strokeWidth: 2 } : false} activeDot={ACTIVE_DOT(MONEY)} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
