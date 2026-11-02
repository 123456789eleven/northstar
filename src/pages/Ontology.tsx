import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { toISODate } from '../lib/dates'
import { Empty, PageHeader, Skeleton } from '../components/ui'
import DataTable from '../components/DataTable'
import SidePanel from '../components/SidePanel'
import { PHONE_QUERY, useMedia } from '../components/useMedia'
import { REGISTRY, resolveLinks, timelineFor, TYPE_LIST, type Row, type TypeDef, type TypeKey } from '../ontology/registry'
import '../features/ops/ops.css'

const BOX_W = 210
const GAP = 80
const PAD = 16
const LINE = 14
const COLS = 5
const ROW_GAP = 56
const TOP = 44

interface Section { name: string; lines: string[] }
const sections = (t: TypeDef): Section[] => [
  { name: 'Properties', lines: t.properties.map((p) => `${p.name}: ${p.type}`) },
  { name: 'Links', lines: t.links.map((l) => `${l.name} -> ${l.to === '*' ? 'any' : l.to}`) },
  { name: 'Functions', lines: t.functions.map((f) => `${f.name}()`) },
  { name: 'Actions', lines: t.actions.map((a) => a.label) },
  { name: 'Automations', lines: t.automations.map((a) => a.name) },
].filter((s) => s.lines.length)
const boxHeight = (t: TypeDef) => 30 + sections(t).reduce((h, s) => h + 8 + LINE * (1 + s.lines.length), 0)
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function Diagram({ counts, active, onPick }: { counts: Record<string, number>; active: TypeKey; onPick: (t: TypeKey) => void }) {
  const rows = Math.ceil(TYPE_LIST.length / COLS)
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(...TYPE_LIST.slice(r * COLS, r * COLS + COLS).map(boxHeight)))
  const rowY = rowH.map((_, r) => TOP + rowH.slice(0, r).reduce((a, b) => a + b + ROW_GAP, 0))
  const pos = Object.fromEntries(TYPE_LIST.map((t, i) => [t.key, { c: i % COLS, r: Math.floor(i / COLS), x: PAD + (i % COLS) * (BOX_W + GAP), y: rowY[Math.floor(i / COLS)], h: boxHeight(t) }]))
  const W = PAD * 2 + COLS * BOX_W + (COLS - 1) * GAP
  const H = rowY[rows - 1] + rowH[rows - 1] + PAD

  const edges: { from: TypeKey; to: TypeKey; label: string }[] = []
  for (const t of TYPE_LIST) for (const l of t.links) if (l.to !== '*' && l.to !== t.key) edges.push({ from: t.key, to: l.to, label: l.name })

  let over = 0
  return (
    <div className="onto-diagram">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Object types and their links">
        {edges.map((e, i) => {
          const a = pos[e.from]
          const b = pos[e.to]
          const yy = a.y + 20
          let d: string
          let lx: number
          let ly: number
          if (a.r === b.r && Math.abs(a.c - b.c) === 1) {
            const x1 = a.c < b.c ? a.x + BOX_W : a.x
            const x2 = a.c < b.c ? b.x : b.x + BOX_W
            d = `M${x1} ${yy} L${x2} ${yy}`
            lx = (x1 + x2) / 2
            ly = yy
          } else if (a.r === b.r) {
            const top = a.y - 10 - 10 * over++
            const x1 = a.x + BOX_W / 2
            const x2 = b.x + BOX_W / 2
            d = `M${x1} ${a.y} L${x1} ${top} L${x2} ${top} L${x2} ${b.y}`
            lx = (x1 + x2) / 2
            ly = top
          } else {
            const x1 = a.x + BOX_W / 2
            const x2 = b.x + BOX_W / 2
            d = `M${x1} ${a.y + a.h} L${x2} ${b.y}`
            lx = (x1 + x2) / 2
            ly = (a.y + a.h + b.y) / 2
          }
          const w = e.label.length * 6.4 + 10
          return (
            <g key={i}>
              <path d={d} />
              <rect className="edge-bg" x={lx - w / 2} y={ly - 8} width={w} height={14} />
              <text className="edge-label" x={lx} y={ly + 3} textAnchor="middle">{e.label}</text>
            </g>
          )
        })}
        {TYPE_LIST.map((t) => {
          const p = pos[t.key]
          let y = p.y + 30
          return (
            <g key={t.key} className={`node ${active === t.key ? 'active' : ''}`} onClick={() => onPick(t.key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t.key) } }} role="button" tabIndex={0} aria-pressed={active === t.key}>
              <rect className="node-box" x={p.x} y={p.y} width={BOX_W} height={p.h} rx={3} />
              <text className="head" x={p.x + 10} y={p.y + 18}>{t.label}</text>
              <text x={p.x + BOX_W - 10} y={p.y + 18} textAnchor="end">{counts[t.key] ?? 0} {(counts[t.key] ?? 0) === 1 ? 'row' : 'rows'}</text>
              {sections(t).map((s) => {
                y += 8
                const head = y + LINE - 3
                y += LINE
                return (
                  <g key={s.name}>
                    <text aria-hidden className="sec" x={p.x + 10} y={head}>{s.name}</text>
                    {s.lines.map((ln) => {
                      y += LINE
                      return <text aria-hidden key={ln} x={p.x + 14} y={y - 3}>{clip(ln, 30)}</text>
                    })}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Panel({ type, row, onGo }: { type: TypeKey; row: Row; onGo: (t: TypeKey, id: number) => void }) {
  const def = REGISTRY[type]
  const [err, setErr] = useState('')
  const extra = useLiveQuery(async () => {
    const [groups, events, fns] = await Promise.all([
      resolveLinks(type, row),
      timelineFor({ table: def.table, id: row.id! }),
      Promise.all(def.functions.map(async (f) => [f.label, await f.run(row)] as const)),
    ])
    return { groups, events, fns }
  }, [type, row])

  return (
    <div className="ops-panel-body">
      <div className="ops-label">{def.label} #{row.id}</div>
      <div style={{ fontWeight: 600, margin: '2px 0 10px' }}>{def.title(row)}</div>

      <div className="ops-label">Properties</div>
      <dl className="onto-kv" style={{ marginTop: 6 }}>
        {Object.entries(row).map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{PRIVATE_FIELDS[type]?.includes(k) ? '(hidden)' : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')}</dd>
          </div>
        ))}
      </dl>

      {extra && extra.fns.length > 0 && (
        <div className="ops-block">
          <div className="ops-label">Functions</div>
          <dl className="onto-kv" style={{ marginTop: 6 }}>{extra.fns.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd className="ops-mono">{v}</dd></div>)}</dl>
        </div>
      )}

      <div className="ops-block">
        <div className="ops-label">Linked objects</div>
        {extra?.groups.filter((g) => g.objects.length).map((g, i) => (
          <div key={i} style={{ marginTop: 8 }}>
            <div className="ops-mono" style={{ color: 'var(--ink-3)' }}>{g.direction === 'out' ? '->' : '<-'} {g.link.label} / {REGISTRY[g.type].label}</div>
            {g.objects.slice(0, 8).map((o) => (
              <button key={o.id} className="onto-link" onClick={() => onGo(g.type, o.id!)}>
                <span className="ops-mono">#{o.id}</span><span className="ops-clip">{REGISTRY[g.type].title(o)}</span>
              </button>
            ))}
            {g.objects.length > 8 && <div className="ops-label">+{g.objects.length - 8} more</div>}
          </div>
        ))}
        {extra && !extra.groups.some((g) => g.objects.length) && <div style={{ marginTop: 6 }}>None</div>}
      </div>

      {def.actions.filter((a) => !a.when || a.when(row)).length > 0 && (
        <div className="ops-block">
          <div className="ops-label">Actions</div>
          <div className="ops-actions" style={{ marginTop: 6 }}>
            {def.actions.filter((a) => !a.when || a.when(row)).map((a) => (
              <button key={a.id} className="btn btn-sm" onClick={async () => { setErr(''); try { await a.run(row) } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') } }}>{a.label}</button>
            ))}
          </div>
          {err && <div className="ops-error" role="alert">{err}</div>}
        </div>
      )}

      <div className="ops-block">
        <div className="ops-label">Timeline</div>
        {extra?.events.length ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {extra.events.slice(0, 20).map((e) => <li key={e.id} style={{ minHeight: 24 }}><span className="ops-mono" style={{ color: 'var(--ink-3)' }}>{toISODate(new Date(e.at))}</span> {e.title}</li>)}
          </ul>
        ) : <div style={{ marginTop: 6 }}>No events logged for this object.</div>}
      </div>
    </div>
  )
}

// Free-text fields never printed in the explorer (it can be on screen in shared/recorded sessions).
const PRIVATE_FIELDS: Record<string, string[]> = { JournalEntry: ['text'] }

export default function Ontology() {
  const [params, setParams] = useSearchParams()
  const type = (TYPE_LIST.some((t) => t.key === params.get('t')) ? params.get('t') : 'Task') as TypeKey
  const selId = params.get('id') ? Number(params.get('id')) : null
  const [q, setQ] = useState('')
  const phone = useMedia(PHONE_QUERY)
  const [showModel, setShowModel] = useState(false)
  const def = REGISTRY[type]

  const counts = useLiveQuery(async () => Object.fromEntries(await Promise.all(TYPE_LIST.map(async (t) => [t.key, await db.table(t.table).count()] as const))), [], {} as Record<string, number>)
  const rows = useLiveQuery(async () => (await db.table(def.table).orderBy('id').reverse().limit(500).toArray()) as Row[], [def.table])
  const selected = useLiveQuery(async () => (selId != null ? ((await db.table(def.table).get(selId)) as Row | undefined) : undefined), [def.table, selId])

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => !n || `${r.id} ${def.title(r)} ${def.subtitle(r)}`.toLowerCase().includes(n)).slice(0, 200)
  }, [rows, q, def])

  const go = (t: TypeKey, id?: number) => setParams(id != null ? { t, id: String(id) } : { t })

  return (
    <>
      <PageHeader title="Ontology" sub="The object types Northstar models, how they link, and what each can do. Counts are live." />

      {phone && !showModel ? (
        <button className="btn" onClick={() => setShowModel(true)}>View model diagram</button>
      ) : (
        <section className="ops-panel" aria-label="Object model">
          <div className="ops-panel-head">
            <span className="ops-label">Object model</span>
            {phone ? <button className="btn btn-ghost btn-sm" onClick={() => setShowModel(false)}>Hide</button> : <span className="small faint">Scroll sideways inside this box</span>}
          </div>
          <Diagram counts={counts} active={type} onPick={(t) => { setQ(''); go(t) }} />
        </section>
      )}

      <div className="onto-grid" style={{ marginTop: 12 }}>
        <section className="ops-panel" aria-label="Object explorer">
          <div className="onto-toolbar">
            <select className="select" aria-label="Object type" value={type} onChange={(e) => { setQ(''); go(e.target.value as TypeKey) }}>
              {TYPE_LIST.map((t) => <option key={t.key} value={t.key}>{t.label} ({counts[t.key] ?? 0})</option>)}
            </select>
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Search" aria-label="Search objects" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {shown.length === 0 ? (
            <div className="ops-panel-body">
              {rows ? (
                <Empty title={q ? `No ${def.label.toLowerCase()} rows match` : `No ${def.label.toLowerCase()} rows yet`} action={q ? <button className="btn btn-sm" onClick={() => setQ('')}>Clear search</button> : undefined} />
              ) : <Skeleton rows={6} label="Loading objects" />}
            </div>
          ) : (
            <div>
              <DataTable
                label={`${def.label} objects`}
                rows={shown}
                rowKey={(r) => r.id!}
                activeKey={selId}
                onRow={(r) => go(type, r.id)}
                columns={[
                  { key: 'title', header: 'Title', primary: true, render: (r) => <span className="ops-clip">{def.title(r)}</span> },
                  { key: 'detail', header: 'Detail', render: (r) => <span className="ops-clip" style={{ color: 'var(--ink-2)' }}>{def.subtitle(r)}</span> },
                  { key: 'id', header: 'ID', value: true, render: (r) => <span className="ops-mono">#{r.id}</span> },
                ]}
              />
            </div>
          )}
        </section>

        {!phone && (
          <section className="ops-panel onto-detail" aria-label="Object detail">
            <div className="ops-panel-head"><span className="ops-label">Object</span></div>
            {selected ? <Panel type={type} row={selected} onGo={go} /> : <div className="ops-panel-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>Select a row to see its properties, links, actions and timeline.</div>}
          </section>
        )}
      </div>
      {phone && selected && (
        <SidePanel title={`${def.label} #${selected.id}`} onClose={() => go(type)}>
          <Panel type={type} row={selected} onGo={go} />
        </SidePanel>
      )}
    </>
  )
}
