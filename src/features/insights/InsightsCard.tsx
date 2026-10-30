import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import type { Insight, Severity } from './engine'
import { useInsights } from './snapshot'
import './insights.css'

const LABEL: Record<Severity, string> = { note: 'Note', nudge: 'Nudge', win: 'Win' }

function Row({ i }: { i: Insight }) {
  return (
    <li>
      <Link to={i.href} className={`ins-row ins-${i.severity}`}>
        <span className="ins-tag">{LABEL[i.severity]}</span>
        <span className="ins-text">{i.text}</span>
      </Link>
    </li>
  )
}

/** Compact: top two insights for Today. Renders nothing when there is nothing useful to say. */
export function InsightsCard() {
  const s = useInsights()
  if (!s) return null
  if (s.insights.length === 0) return null
  return (
    <Card title="Worth a look" action={<Link className="card-link" to="/review">Weekly review</Link>}>
      <ul className="ins-list">{s.insights.slice(0, 2).map((i) => <Row key={i.id} i={i} />)}</ul>
    </Card>
  )
}

/** Full: the "This week in review" section at the top of Review. */
export function InsightsWeek() {
  const s = useInsights()
  if (!s) return null
  return (
    <Card title="This week in review">
      {s.insights.length > 0 ? (
        <ul className="ins-list">{s.insights.map((i) => <Row key={i.id} i={i} />)}</ul>
      ) : s.next ? (
        <div className="ins-empty">
          <span>{s.next.text}</span>
          <Link className="btn btn-sm" to={s.next.href}>{s.next.cta}</Link>
        </div>
      ) : (
        <p className="ins-quiet">Nothing needs your attention right now.</p>
      )}
    </Card>
  )
}
