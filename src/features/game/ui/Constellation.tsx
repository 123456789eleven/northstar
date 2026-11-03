// The five life skills as one constellation (a "W", like Cassiopeia). Star size and brightness follow the skill level;
// the line between two stars brightens as the weaker of the two levels rises. Pure SVG, no images.
// The SVG itself is decorative: the buttons under it (keyboard/tap) and the table view carry the same information.
import { useId, useState, type CSSProperties } from 'react'
import type { SkillId, SkillState } from '../types'

const POS: Record<SkillId, [number, number]> = {
  body: [34, 46], money: [92, 112], mind: [160, 64], career: [228, 118], people: [286, 40],
}
const EDGES: Array<[SkillId, SkillId]> = [['body', 'money'], ['money', 'mind'], ['mind', 'career'], ['career', 'people']]

const starPath = (cx: number, cy: number, r: number) => {
  const i = r * 0.32
  return `M${cx} ${cy - r}L${cx + i} ${cy - i}L${cx + r} ${cy}L${cx + i} ${cy + i}L${cx} ${cy + r}L${cx - i} ${cy + i}L${cx - r} ${cy}L${cx - i} ${cy - i}Z`
}
const toNext = (s: SkillState) => Math.max(0, s.xpForNext - s.xpIntoLevel)
/** Level 1 = a faint small star; it grows and brightens to about level 12, then stays. */
const starScale = (level: number) => Math.min(1, Math.max(0, (level - 1) / 11))

export function Constellation({ skills, compact = false, bright = false, interactive = true }: { skills: SkillState[]; compact?: boolean; bright?: boolean; interactive?: boolean }) {
  const [active, setActive] = useState<SkillId | null>(null)
  const [table, setTable] = useState(false)
  const uid = useId()
  const by = Object.fromEntries(skills.map((s) => [s.id, s])) as Record<SkillId, SkillState>
  const cur = active ? by[active] : undefined
  const summary = skills.map((s) => `${s.label} level ${s.level}`).join(', ')
  return (
    <div className={`constellation ${compact ? 'is-compact' : ''} ${bright ? 'is-bright' : ''}`}>
      <svg className="cst-svg" viewBox="0 0 320 150" aria-hidden focusable="false" onMouseLeave={() => setActive(null)}>
        {EDGES.map(([a, b]) => {
          const t = starScale(Math.min(by[a]?.level ?? 1, by[b]?.level ?? 1))
          const [x1, y1] = POS[a]
          const [x2, y2] = POS[b]
          return <line key={a + b} className={`cst-edge ${active === a || active === b ? 'is-on' : ''}`} x1={x1} y1={y1} x2={x2} y2={y2} style={{ '--t': t } as CSSProperties} />
        })}
        {skills.map((s) => {
          const [x, y] = POS[s.id]
          const t = starScale(s.level)
          const r = 6 + t * 6
          return (
            <g
              key={s.id}
              className={`cst-star ${active === s.id ? 'is-on' : ''}`}
              style={{ '--c': `var(--skill-${s.id})`, '--t': t } as CSSProperties}
              onMouseEnter={interactive ? () => setActive(s.id) : undefined}
              onClick={interactive ? () => setActive(active === s.id ? null : s.id) : undefined}
            >
              <circle className="cst-halo" cx={x} cy={y} r={r * 1.8} />
              <path className="cst-glyph" d={starPath(x, y, r)} />
              {!compact && <text className="cst-label" x={x} y={y + r + 15} textAnchor="middle">{s.label}</text>}
            </g>
          )
        })}
      </svg>
      <p className="sr-only">Constellation: {summary}.</p>
      {interactive && (
        <>
          <div className="cst-caption" aria-live="polite">
            {cur ? (
              <><b>{cur.label}</b> <span className="muted">Level {cur.level} · {toNext(cur)} XP to level {cur.level + 1}{cur.todayXp ? ` · +${cur.todayXp} today` : ''}</span></>
            ) : (
              <span className="muted">Point at or pick a star. Every logged weigh-in, win, entry and contact brightens one.</span>
            )}
          </div>
          <div className="cst-keys" role="group" aria-label="Skills">
            {skills.map((s) => (
              <button key={s.id} type="button" className="cst-key" style={{ '--c': `var(--skill-${s.id})` } as CSSProperties} aria-pressed={active === s.id} onClick={() => setActive(active === s.id ? null : s.id)} onFocus={() => setActive(s.id)}>
                <span className="cst-key-dot" aria-hidden />{s.label} <span className="mono muted">{s.level}</span>
              </button>
            ))}
            <button type="button" className="btn btn-ghost btn-sm cst-table-btn" aria-expanded={table} aria-controls={`${uid}-t`} onClick={() => setTable((v) => !v)}>
              {table ? 'Hide table' : 'Table view'}
            </button>
          </div>
          {table && (
            <div className="table-wrap" id={`${uid}-t`}>
              <table className="table cst-table">
                <caption className="sr-only">Skill levels</caption>
                <thead><tr><th scope="col">Skill</th><th scope="col">Level</th><th scope="col" className="num">Total XP</th><th scope="col" className="num">To next level</th><th scope="col" className="num">Today</th></tr></thead>
                <tbody>
                  {skills.map((s) => (
                    <tr key={s.id}><th scope="row">{s.label}</th><td className="mono">{s.level}</td><td className="num mono">{s.xp}</td><td className="num mono">{toNext(s)}</td><td className="num mono">{s.todayXp ? `+${s.todayXp}` : '0'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
