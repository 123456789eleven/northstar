// /style: the design system on one page. Not in the nav; reached by URL. Static sample content only (no user data).
import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Card, Empty, PageHeader, Progress, Skeleton } from '../components/ui'
import { GlassSurface } from '../components/glass'
import { Icon } from '../components/Icons'
import { Ring } from '../features/game/ui/Ring'
import '../styles/styletile.css'

const TYPE = [['fs-6', 'Hero figure', '2,140'], ['fs-5', 'Page title', 'Money'], ['fs-4', 'Section', 'This month'], ['fs-3', 'Body', 'Groceries, 12 transactions'], ['fs-2', 'Secondary', 'Updated 9:41'], ['fs-1', 'Caption', 'KCAL']]
const SWATCH = ['--bg', '--surface-1', '--ink', '--ink-2', '--ink-3', '--accent', '--reward', '--good', '--warn']

export default function StyleTile() {
  useEffect(() => { document.title = 'Style | Northstar' }, [])
  // Design reference: dev builds only.
  if (!import.meta.env.DEV) return <Navigate to="/" replace />
  return (
    <div className="stack st">
      <PageHeader title="Style tile" icon="star" sub="Materials, type, motion and the primitives. Static samples only." />

      <section className="st-grid" aria-label="Material tiers">
        <GlassSurface tier="thin" className="st-tier"><b>Thin</b><span className="small muted">Tab bar, toolbars. Most see-through, floats.</span></GlassSurface>
        <GlassSurface tier="regular" specular className="st-tier"><b>Regular</b><span className="small muted">Cards and panels. Tint, still translucent. Move the pointer over it.</span></GlassSurface>
        <GlassSurface tier="thick" className="st-tier"><b>Thick</b><span className="small muted">Sheets and modals. Legibility first.</span></GlassSurface>
      </section>

      <Card title="Figures" sub="Tabular numerals, one hero per screen">
        <div className="st-figs">
          <div><div className="st-fig">$4,218</div><div className="small muted">Safe to spend</div></div>
          <div><div className="st-fig">2,140<span className="st-unit"> / 3,000</span></div><div className="small muted">kcal today</div></div>
          <div className="st-rings">
            <Ring value={0.71} size={56} stroke={5} label="Calories 71 percent" />
            <Ring value={0.4} size={56} stroke={5} tone="money" label="Budget 40 percent" />
            <Ring value={1} size={56} stroke={5} tone="reward" label="Goal met" />
          </div>
        </div>
        <Progress value={0.62} label="Sample progress" />
      </Card>

      <Card title="Controls">
        <div className="row st-controls">
          <button className="btn btn-primary">Log meal</button>
          <button className="btn">Secondary</button>
          <button className="btn" disabled>Disabled</button>
          <button className="chip" aria-pressed="true">Selected</button>
          <button className="chip" aria-pressed="false">Chip</button>
          <button className="btn btn-ghost" aria-label="Add"><Icon name="plus" size={16} /></button>
        </div>
        <p className="small faint" style={{ margin: 0 }}>Press any of them: scale to 0.97 with a brightness lift, under 100 ms.</p>
      </Card>

      <div className="grid-2">
        <Card title="Type scale">
          <ul className="st-type">{TYPE.map(([t, n, s]) => <li key={t}><span className="st-type-s" style={{ fontSize: `var(--${t})` }}>{s}</span><span className="small faint">{n}</span></li>)}</ul>
        </Card>
        <Card title="Colour">
          <div className="st-sw">{SWATCH.map((v) => <span key={v} className="st-chip" style={{ background: `var(${v})` }} title={v}><i>{v.slice(2)}</i></span>)}</div>
          <p className="small faint" style={{ margin: 0 }}>Gold marks only what was earned.</p>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Empty state"><Empty title="No bills yet">Add the first one to see what is due next.</Empty></Card>
        <Card title="Loading"><Skeleton lines={3} label="Loading sample" /></Card>
      </div>
    </div>
  )
}
