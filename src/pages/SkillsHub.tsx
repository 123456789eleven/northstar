// Areas hub (/skills): Body, Money, Mind, Career and People as rings, each with the real inputs that fed it this week.
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Skeleton } from '../components/ui'
import type { IconName } from '../components/Icons'
import ModuleTile from '../components/ModuleTile'
import { Ring } from '../features/game/ui/Ring'
import '../features/space/space.css'
import { usePlayerState } from '../features/game/ui/playerContext'
import { useAreaWeek } from '../features/game/useAreaWeek'
import { inputLine } from '../features/game/areas'
import type { SkillId } from '../features/game/types'
import '../features/hubs/hubs.css'
import '../features/hubs/areas.css'

const PAGES: Record<SkillId, { to: string; icon: IconName; sub: string }> = {
  body: { to: '/body', icon: 'body', sub: 'Weight, food and training' },
  money: { to: '/finance', icon: 'finance', sub: 'Budgets, spending and net worth' },
  mind: { to: '/mind', icon: 'mind', sub: 'Journal and learning' },
  career: { to: '/career', icon: 'career', sub: 'Wins and your promotion case' },
  people: { to: '/people', icon: 'people', sub: 'Who to reach out to' },
}

export default function SkillsHub() {
  const p = usePlayerState()
  const target = p.streak.target || 5
  const areas = useAreaWeek(target)
  const [table, setTable] = useState(false)
  const uid = useId()
  const total = areas?.reduce((a, x) => a + x.total, 0) ?? 0
  return (
    <>
      <PageHeader
        title="Areas"
        sub="Body, money, mind, career and people. Each ring fills with the days you did something there this week."
        actions={<><Link to="/map" className="btn btn-ghost">Life map</Link>{areas ? <button type="button" className="btn btn-ghost" aria-expanded={table} aria-controls={`${uid}-t`} onClick={() => setTable((v) => !v)}>{table ? 'Hide table' : 'Table view'}</button> : null}</>}
      />
      {!areas ? (
        <div className="area-grid" aria-busy="true">{Object.keys(PAGES).map((k) => <div key={k} className="card"><Skeleton lines={3} label="Loading areas" /></div>)}</div>
      ) : (
        <>
          {total === 0 && <p className="area-note small muted">Nothing counted yet this week. Log a weigh-in, a journal line, a win or a message to someone and the matching ring starts to fill.</p>}
          {table && (
            <div className="table-wrap area-table" id={`${uid}-t`}>
              <table className="table">
                <caption className="sr-only">Areas this week</caption>
                <thead><tr><th scope="col">Area</th><th scope="col" className="num">Days</th><th scope="col" className="num">Counted</th><th scope="col">What fed it</th></tr></thead>
                <tbody>
                  {areas.map((a) => (
                    <tr key={a.id}><th scope="row">{a.label}</th><td className="num mono">{Math.min(a.days, target)} of {target}</td><td className="num mono">{a.total}</td><td className="small muted">{inputLine(a, 6)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="area-grid sp-areas">
            {areas.map((a) => {
              const page = PAGES[a.id]
              return (
                <Link key={a.id} to={page.to} className="card card-interactive area-card sp-flat" data-area={a.id}>
                  <span className="area-head">
                    <Ring value={a.value} size={72} stroke={6} label={`${a.label}: ${Math.min(a.days, target)} of ${target} days this week`}>
                      <span className="area-days"><b className="mono">{Math.min(a.days, target)}</b><span>/{target}</span></span>
                    </Ring>
                    <span className="area-name">
                      <span className="area-title"><ModuleTile icon={page.icon} size="sm" quiet /> {a.label}</span>
                      <span className="area-sub">{page.sub}</span>
                    </span>
                  </span>
                  <span className="area-fed">
                    <span className="area-fed-h">This week</span>
                    {a.inputs.length ? (
                      <ul className="area-inputs">
                        {a.inputs.slice(0, 4).map((i) => <li key={i.kind}><b className="mono">{i.count}</b> {i.label}</li>)}
                      </ul>
                    ) : <span className="small muted">Nothing yet this week</span>}
                  </span>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
