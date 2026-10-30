// Suggestions under the Food add row: instant offline search of the bundled reference,
// plus an opt-in (default OFF) search of Open Food Facts that runs only when you press the button.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { searchFoods } from '../../data/foods'
import { db, setSetting } from '../../db'
import { OFF_OPTIN_KEY, searchOpenFoodFacts, type OffFood } from '../data/offSearch'

export interface FoodPick {
  name: string
  kcal?: number
  protein?: number
}

export default function FoodLookup({ query, onPick }: { query: string; onPick: (f: FoodPick) => void }) {
  const optin = useLiveQuery(async () => (await db.settings.get(OFF_OPTIN_KEY))?.value === true, [], false)
  const [picked, setPicked] = useState('')
  const [online, setOnline] = useState<{ q: string; items: OffFood[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const q = query.trim()
  const local = useMemo(() => searchFoods(q, 5), [q])

  useEffect(() => {
    setOnline(null)
    setErr('')
  }, [q])

  if (q.length < 2 || q === picked) return null

  const pick = (f: FoodPick) => {
    setPicked(f.name)
    onPick(f)
  }
  async function runOnline() {
    setBusy(true)
    setErr('')
    try {
      setOnline({ q, items: await searchOpenFoodFacts(q) })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lookup failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="food-lookup small" aria-label="Food suggestions">
      {local.map((f) => (
        <button key={f.name} type="button" className="btn btn-ghost btn-sm food-lookup-item" onClick={() => pick({ name: f.name, kcal: f.kcal, protein: f.protein })}>
          <span className="grow" style={{ textAlign: 'left' }}>
            {f.name} <span className="faint">· {f.serving}</span>
          </span>
          <span className="mono muted">~{f.kcal} kcal · {f.protein} g</span>
        </button>
      ))}
      {local.length > 0 && <div className="tiny faint">Built-in values are approximate, for a typical serving.</div>}
      {online?.q === q &&
        online.items.map((f, i) => (
          <button key={i} type="button" className="btn btn-ghost btn-sm food-lookup-item" onClick={() => pick({ name: f.brand ? `${f.name} (${f.brand})` : f.name, kcal: f.kcal, protein: f.protein })}>
            <span className="grow" style={{ textAlign: 'left' }}>
              {f.name} {f.brand && <span className="faint">· {f.brand}</span>} <span className="faint">· per {f.per}</span>
            </span>
            <span className="mono muted">{f.kcal ?? '?'} kcal · {f.protein ?? '?'} g</span>
          </button>
        ))}
      {online?.q === q && online.items.length === 0 && <div className="tiny faint">No online matches.</div>}
      {err && <div className="tiny warn">{err}</div>}
      <div className="row wrap" style={{ gap: 10 }}>
        <label className="row tiny muted" style={{ gap: 6 }}>
          <input type="checkbox" className="check" checked={optin} onChange={(e) => void setSetting(OFF_OPTIN_KEY, e.target.checked)} />
          Search Open Food Facts
        </label>
        {optin && (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void runOnline()}>
            {busy ? 'Searching…' : `Search online for “${q.slice(0, 24)}”`}
          </button>
        )}
      </div>
      <div className="tiny faint">{optin ? 'Online search sends your search text to world.openfoodfacts.org, only when you press the button.' : 'Off by default. Turning this on sends your search text to world.openfoodfacts.org when you search.'}</div>
    </div>
  )
}
