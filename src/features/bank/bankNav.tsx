// Bank (Money) shared bits: the month in the URL (`?month=`), the month stepper, and a floor's full-width view (`?view=`).
import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { db } from '../../db'
import { monthKey } from '../../lib/dates'
import { monthLabel, shiftMonth } from '../finance/model'

const MONTH = /^\d{4}-\d{2}$/

/** The month a Bank floor shows: `?month=` when given, else this month, or the latest month with data when this one is empty. */
export function useBankMonth(): [string, (m: string) => void] {
  const [params, setParams] = useSearchParams()
  const asked = params.get('month')
  const latest = useLiveQuery(async () => (await db.transactions.orderBy('date').last())?.date.slice(0, 7) ?? null, [])
  const cur = monthKey()
  const fallback = latest && latest < cur ? latest : cur
  const month = asked && MONTH.test(asked) ? asked : fallback
  const set = (m: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (m === fallback) n.delete('month')
      else n.set('month', m)
      return n
    }, { replace: true })
  return [month, set]
}

export function MonthStepper({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const cur = monthKey()
  return (
    <div className="bk-month" role="group" aria-label="Month">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
      <span className="bk-month-label">{monthLabel(month, true)}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month" disabled={month >= cur}>›</button>
    </div>
  )
}

/** `?view=` on the current floor. */
export function useView(): string | null {
  return useSearchParams()[0].get('view')
}

/** Link target for a view on the current floor (keeps `month`). */
export function useViewHref(): (view: string | null, extra?: Record<string, string>) => string {
  const { pathname, search } = useLocation()
  return (view, extra = {}) => {
    const q = new URLSearchParams()
    const m = new URLSearchParams(search).get('month')
    if (m) q.set('month', m)
    if (view) q.set('view', view)
    for (const [k, v] of Object.entries(extra)) q.set(k, v)
    const s = q.toString()
    return s ? `${pathname}?${s}` : pathname
  }
}

/** A floor's full-width view: back to the floor, a title, the content. */
export function BankView({ title, children, back = 'Back', action }: { title: string; children: ReactNode; back?: string; action?: ReactNode }) {
  const href = useViewHref()
  return (
    <div className="bk-view">
      <div className="bk-view-head">
        <Link className="btn btn-ghost btn-sm bk-back" to={href(null)}>‹ {back}</Link>
        <h1 className="bk-view-title">{title}</h1>
        {action}
      </div>
      {children}
    </div>
  )
}
