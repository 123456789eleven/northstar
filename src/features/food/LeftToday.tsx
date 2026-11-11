import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useToast } from '../../components/toastContext'
import { db, setSetting } from '../../db'
import { TARGETS_KEY, type FoodTargets } from './foodData'
import MacroRings from './MacroRings'
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

export default function LeftToday({ targets, totals, isToday, hour, onTargets, ready, isDefault = false }: { targets: FoodTargets; totals: { calories: number; protein: number }; isToday: boolean; hour: number; onTargets: () => void; ready: boolean; isDefault?: boolean }) {
  const toast = useToast()
  const weight = useWeightLb()
  const left = leftToday(targets, totals)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!left) {
    const sug = weight ? suggestTargets(weight.lb) : null
    return (
      <section className="card food-left">
        <div className="card-title">Today</div>
        <p className="small muted" style={{ margin: 0 }}>
          Set a calorie and protein target to see what is left today. Gaining weight comes down to eating enough, every day.
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

  const sug = isDefault && weight ? suggestTargets(weight.lb) : null
  const saveCalories = async () => {
    const n = Math.round(Number(draft))
    if (!Number.isFinite(n) || n < 500 || n > 10000) { toast({ message: 'That target looks off. Try a number between 500 and 10,000 calories.' }); return }
    const cur = await db.settings.get(TARGETS_KEY)
    await setSetting(TARGETS_KEY, { ...((cur?.value as FoodTargets | undefined) ?? {}), calories: n } satisfies FoodTargets)
    setEditing(false)
    toast({ message: `Daily target set to ${n.toLocaleString()} kcal` })
  }
  const behind = isToday ? behindMessage(targets, totals, hour) : null
  return (
    <section className="card food-left">
      <div className="card-title">
        <span>Today</span>
        <button className="btn btn-ghost btn-sm" onClick={onTargets}>
          Targets
        </button>
      </div>
      <p className="food-day-total" data-testid="food-day-total"><strong className="mono">{Math.round(totals.calories).toLocaleString()}</strong> of {(targets.calories ?? 0).toLocaleString()} kcal{totals.protein > 0 || targets.protein ? <> · <span className="mono">{Math.round(totals.protein)}</span>{targets.protein ? ` of ${targets.protein}` : ''} g protein</> : null}</p>
      {isDefault && (
        <div className="food-default" data-testid="food-default">
          {editing ? (
            <form className="row" onSubmit={(e) => { e.preventDefault(); void saveCalories() }}>
              <input className="input food-default-input" inputMode="numeric" autoFocus aria-label="Daily calorie target" placeholder="3000" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button className="btn btn-primary btn-sm" type="submit">Save</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </form>
          ) : (
            <span className="small faint">Default target. <button className="btn btn-ghost btn-sm food-default-edit" onClick={() => { setDraft(String(targets.calories ?? '')); setEditing(true) }}>Change it</button>
              {sug && <button className="btn btn-ghost btn-sm" onClick={async () => { const cur = await db.settings.get(TARGETS_KEY); await setSetting(TARGETS_KEY, { ...((cur?.value as FoodTargets | undefined) ?? {}), calories: sug.calories, protein: sug.protein } satisfies FoodTargets); toast({ message: 'Targets set from estimate' }) }}>Targets from estimate ({sug.calories.toLocaleString()})</button>}
            </span>
          )}
        </div>
      )}
      <MacroRings targets={targets} totals={totals} ready={ready} />
      {behind && <p className="small food-behind" data-testid="food-coach"><span className="food-behind-dot" aria-hidden />{behind}</p>}
    </section>
  )
}
