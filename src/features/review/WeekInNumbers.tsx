import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ISODate } from '../../db'
import { Card, Skeleton } from '../../components/ui'
import { loadWeekNumbers, type NumberItem, type WeekSnapshot } from './weekNumbers'
import './weeknumbers.css'

function Cell({ it }: { it: NumberItem }) {
  return (
    <div className="wn-cell" data-testid={`wn-${it.key}`}>
      <div className="rv-fact-label">{it.label}</div>
      <div className={it.empty ? 'rv-fact-value is-zero' : 'rv-fact-value'}>{it.value}</div>
      <div className="rv-fact-note">{it.note}</div>
      {it.lines && it.lines.length > 0 && (
        <ul className="wn-lines">{it.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      )}
      <Link className="wn-link" to={it.href} aria-label={`${it.linkLabel}: ${it.label}`}>{it.linkLabel}</Link>
    </div>
  )
}

/** Auto-filled numbers for the week. A locked week shows the snapshot saved when it was locked. */
export function WeekInNumbers({ weekOf, snapshot }: { weekOf: ISODate; snapshot?: WeekSnapshot }) {
  const live = useLiveQuery(async () => (snapshot ? null : { weekOf, items: await loadWeekNumbers(weekOf) }), [weekOf, snapshot])
  const items = snapshot ? snapshot.items : live && live.weekOf === weekOf ? live.items : undefined
  if (!items) return <Card title="Week in numbers"><Skeleton lines={4} label="Loading the numbers" /></Card>
  return (
    <Card title="Week in numbers" action={snapshot ? <span className="small faint">Saved when locked</span> : <span className="small faint">From your data</span>}>
      <div className="wn-grid">{items.map((it) => <Cell key={it.key} it={it} />)}</div>
    </Card>
  )
}
