import { useMemo } from 'react'
import { Card } from '../../components/ui'
import { monthNow } from './careerData'
import { monthlyCounts, type Win } from './leadership'

const LABELS = { mentoring: 'Mentoring', escalation: 'Escalations handled', 'cross-team': 'Cross-team work' } as const
const KEYS = ['mentoring', 'escalation', 'cross-team'] as const

export function LeadershipPanel({ wins }: { wins: Win[] }) {
  const months = useMemo(() => monthlyCounts(wins, monthNow(), 6), [wins])
  const max = Math.max(1, ...months.flatMap((m) => KEYS.map((k) => m[k])))
  const total = (k: (typeof KEYS)[number]) => months.reduce((s, m) => s + m[k], 0)
  const any = KEYS.some((k) => total(k) > 0)

  return (
    <Card title="Informal leadership" sub="Counted from tagged wins over the last 6 months.">
      <div className="car-lead-totals">
        {KEYS.map((k) => (
          <div key={k}><div className="car-big">{total(k)}</div><div className="muted small">{LABELS[k]}</div></div>
        ))}
      </div>
      {!any && <p className="muted small">Tag a win as Mentoring, Escalation or Cross-team when you log it, and it counts here.</p>}
      <table className="car-strip" aria-label="Leadership by month">
        <thead><tr><th scope="col">Month</th>{KEYS.map((k) => <th key={k} scope="col">{LABELS[k]}</th>)}</tr></thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{m.month}</th>
              {KEYS.map((k) => (
                <td key={k}>
                  <span className="car-bar" style={{ width: `${(m[k] / max) * 100}%` }} aria-hidden />
                  <span className="car-bar-n">{m[k]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
