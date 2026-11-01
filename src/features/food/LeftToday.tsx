import { useLiveQuery } from 'dexie-react-hooks'
import { Progress } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { db, setSetting } from '../../db'
import { TARGETS_KEY, type FoodTargets } from './foodData'
import { behindMessage, leftToday, suggestTargets } from './foodLogic'

const numOf = (v: unknown): number | undefined => {
  const o = v as { value?: unknown; lb?: unknown; weight?: unknown } | null
  const x = typeof v === 'object' && o ? (o.value ?? o.lb ?? o.weight) : v
  const n = Number(x)
  return Number.isFinite(n) && n > 50 && n < 700 ? n : undefined
}

/** Latest logged weight if a weights table exists, else body.goalWeight. Estimate input only. */
function useWeightLb(): { lb: number; from: 'latest' | 'goal' } | undefined {
  return useLiveQuery(async () => {
    try {
      const t = db.tables.find((x) => x.name === 'weights')
      if (t) {
        const last = (await t.orderBy('date').last()) as unknown
        const n = numOf(last)
        if (n) return { lb: n, from: 'latest' as const }
      }
      const g = numOf((await db.settings.get('body.goalWeight'))?.value)
      if (g) return { lb: g, from: 'goal' as const }
    } catch {
      /* no weight data */
    }
    return undefined
  }, [])
}

function Bar({ label, value, target, unit, left }: { label: string; value: number; target: number; unit: string; left: number }) {
  return (
    <div className="food-left-row">
      <div className="food-left-head">
        <span className="stat-label">{label}</span>
        <span className="mono small muted">
          {value.toLocaleString()} / {target.toLocaleString()} {unit}
        </span>
      </div>
      <Progress value={(value / target) * 100} label={label} />
      <span className="small">{left > 0 ? `${left.toLocaleString()} ${unit === 'kcal' ? 'kcal' : 'g protein'} to go` : 'Target reached'}</span>
    </div>
  )
}

export default function LeftToday({ targets, totals, isToday, hour, onTargets }: { targets: FoodTargets; totals: { calories: number; protein: number }; isToday: boolean; hour: number; onTargets: () => void }) {
  const toast = useToast()
  const weight = useWeightLb()
  const left = leftToday(targets, totals)

  if (!left) {
    const sug = weight ? suggestTargets(weight.lb) : null
    return (
      <section className="card food-left">
        <div className="card-title">Left today</div>
        <p className="small muted" style={{ margin: 0 }}>
          Set a calorie and protein target to see what is left to eat. Gaining weight is mostly about eating enough every day.
        </p>
        {sug && weight && (
          <p className="small" style={{ margin: '8px 0 0' }}>
            Suggested (estimate, from {weight.lb} lb {weight.from === 'goal' ? 'goal weight' : 'current weight'}): {sug.calories.toLocaleString()} kcal and {sug.protein} g protein
            <span className="faint"> (weight x 15 + 400 kcal, 0.8 g/lb protein)</span>
          </p>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          {sug && (
            <button
              className="btn btn-primary"
              onClick={async () => {
                await setSetting(TARGETS_KEY, sug satisfies FoodTargets)
                toast({ message: 'Targets set from estimate' })
              }}
            >
              Use suggested
            </button>
          )}
          <button className="btn" onClick={onTargets}>
            Set targets
          </button>
        </div>
      </section>
    )
  }

  const behind = isToday ? behindMessage(targets, totals, hour) : null
  return (
    <section className="card food-left">
      <div className="card-title">
        <span>Left today</span>
        <button className="btn btn-ghost btn-sm" onClick={onTargets}>
          Targets
        </button>
      </div>
      <div className="food-left-grid">
        {targets.calories ? <Bar label="Calories" value={totals.calories} target={targets.calories} unit="kcal" left={left.kcal} /> : null}
        {targets.protein ? <Bar label="Protein" value={totals.protein} target={targets.protein} unit="g" left={left.protein} /> : null}
      </div>
      {behind && <p className="small food-behind">{behind}</p>}
    </section>
  )
}
