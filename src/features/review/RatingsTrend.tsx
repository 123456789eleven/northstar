// Small multiples: one single-series line per area (1–5 rating), shared x (weeks).
// Single data hue (slot 1, blue) in every panel — the panel title names the series, so no legend.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AREAS, type Area, type Review } from '../../db'
import { AREA_LABEL } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { ACTIVE_DOT, CHART, DOT, GRID_PROPS, Y_AXIS, tooltipProps } from '../../components/chartTheme'

// Mirrors index.css tokens (SVG presentation attributes can't read CSS variables reliably).
const C = { accent: CHART.data[0] }

interface TipProps { active?: boolean; payload?: { payload: { weekOf: string; v?: number } }[]; area: Area }
function Tip({ active, payload, area }: TipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">Week of {formatDate(p.weekOf)}</div>
      <div className="chart-tip-row"><strong>{p.v != null ? `${p.v} / 5` : 'not rated'}</strong><span className="muted">{AREA_LABEL[area]}</span></div>
    </div>
  )
}

export function RatingsTrend({ reviews }: { reviews: Review[] }) {
  const recent = [...reviews].sort((a, b) => a.weekOf.localeCompare(b.weekOf)).slice(-26)
  const rated = AREAS.filter((a) => recent.some((r) => r.ratings[a] != null))
  if (recent.length < 2 || rated.length === 0) {
    return <p className="small faint" style={{ margin: 0 }}>The trend appears after two reviews with ratings.</p>
  }
  const first = recent[0].weekOf
  const last = recent[recent.length - 1].weekOf
  return (
    <div>
      <div className="rv-trend-grid">
        {rated.map((a) => {
          const data = recent.map((r) => ({ weekOf: r.weekOf, v: r.ratings[a] }))
          const lastVal = [...data].reverse().find((d) => d.v != null)?.v
          return (
            <figure className="rv-trend" key={a}>
              <figcaption className="rv-trend-head">
                <span>{AREA_LABEL[a]}</span>
                <span className="mono">{lastVal ?? '—'}</span>
              </figcaption>
              <div style={{ height: 84 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 6, right: 8, bottom: 2, left: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="weekOf" hide />
                    <YAxis {...Y_AXIS} domain={[1, 5]} ticks={[1, 3, 5]} width={18} tickMargin={2} />
                    <Tooltip {...tooltipProps(<Tip area={a} />)} />
                    <Line
                      type="linear" dataKey="v" stroke={C.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      connectNulls isAnimationActive={false}
                      dot={DOT(C.accent, 4)}
                      activeDot={ACTIVE_DOT(C.accent)}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
          )
        })}
      </div>
      <div className="rv-trend-range tiny faint">
        <span>{formatDate(first)}</span>
        <span>{recent.length} weeks</span>
        <span>{formatDate(last)}</span>
      </div>
    </div>
  )
}
