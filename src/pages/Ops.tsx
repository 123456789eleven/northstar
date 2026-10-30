import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Card, PageHeader } from '../components/ui'
import { useNow } from '../components/useNow'
import KpiStrip from '../components/KpiStrip'
import DataTable, { type Column } from '../components/DataTable'
import SidePanel from '../components/SidePanel'
import StatusChip from '../components/StatusChip'
import { useMedia, PHONE_QUERY } from '../components/useMedia'
import { NetworkGraph } from '../features/ops/NetworkGraph'
import { applyProposal, canUndo, decide, getAuto, getAutoLog, loadOpsSnapshot, runAutoApply, setAuto, undoApplied } from '../features/ops/opsActions'
import { generateProposals, needsApproval, RULE_IDS, RULE_META, type Proposal } from '../features/ops/proposals'
import { REGISTRY, resolveLinks, TYPE_LIST, typeForTable, type TypeKey } from '../ontology/registry'
import '../features/ops/ops.css'

const WEEK_MS = 7 * 86_400_000

function typeOf(p: Proposal): TypeKey {
  return (typeForTable(p.objectRef.table)?.key ?? 'Task') as TypeKey
}

type Mode = 'explain' | 'logic' | 'modify' | null

function ReviewPanel({ p, mode, setMode, onDone }: { p: Proposal; mode: Mode; setMode: (m: Mode) => void; onDone: () => void }) {
  const [title, setTitle] = useState(typeof p.action.params.title === 'string' ? p.action.params.title : '')
  const [due, setDue] = useState(typeof p.action.params.due === 'string' ? p.action.params.due : '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const editTitle = p.action.kind === 'task.create'
  const editDue = 'due' in p.action.params
  const canModify = editTitle || editDue

  const accept = async (withEdits: boolean) => {
    setBusy(true)
    setErr('')
    try {
      await applyProposal(p, withEdits ? { title: editTitle ? title : undefined, due: editDue ? due : undefined } : {})
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not apply')
    } finally {
      setBusy(false)
    }
  }
  const toggle = (m: 'explain' | 'logic' | 'modify') => setMode(mode === m ? null : m)

  return (
    <div className="cmd-review">
      <div className="cmd-review-meta">
        <StatusChip status={p.risk === 'low' ? 'info' : 'warn'}>{p.risk === 'low' ? 'Low risk' : 'Medium risk'}</StatusChip>
        <span className="faint small">{RULE_META[p.rule].label}</span>
      </div>
      <div className="cmd-review-title">{p.title}</div>
      <p className="cmd-why">{p.rationale}</p>
      <div className="ops-actions">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => accept(false)}>{p.action.label === 'Mark reviewed' ? 'Accept: mark reviewed' : 'Accept'}</button>
        {canModify && <button className="btn btn-sm" aria-pressed={mode === 'modify'} onClick={() => toggle('modify')}>Modify</button>}
        <button className="btn btn-sm" onClick={async () => { await decide(p.id, 'dismissed'); onDone() }}>Dismiss</button>
        <button className="btn btn-sm btn-ghost" onClick={async () => { await decide(p.id, 'snoozed', { days: 1 }); onDone() }}>Snooze 1 day</button>
        <button className="btn btn-sm btn-ghost" aria-pressed={mode === 'explain'} onClick={() => toggle('explain')}>Evidence</button>
        <button className="btn btn-sm btn-ghost" aria-pressed={mode === 'logic'} onClick={() => toggle('logic')}>Show logic</button>
      </div>
      <div className="faint tiny cmd-keys">Keys: j and k move, a accepts, e shows evidence.</div>
      {err && <div className="ops-error" role="alert">{err}</div>}
      {mode === 'modify' && (
        <div className="ops-edit">
          {editTitle && <label className="field"><span>Title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>}
          {editDue && <label className="field"><span>Due date</span><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>}
          <div><button className="btn btn-primary btn-sm" disabled={busy || (editTitle && !title.trim())} onClick={() => accept(true)}>Apply changes</button></div>
        </div>
      )}
      {mode === 'explain' && (
        <div className="ops-block">
          <div className="cmd-sub">Evidence</div>
          <ul>{p.evidence.map((e, i) => <li key={i} className="ops-mono">{e}</li>)}</ul>
        </div>
      )}
      {mode === 'logic' && (
        <div className="ops-block">
          <div className="cmd-sub">Predicate</div>
          <pre className="ops-pre">{p.logic}</pre>
          <div className="cmd-sub" style={{ marginTop: 10 }}>Rule</div>
          <div className="ops-mono">{p.rule}</div>
        </div>
      )}
    </div>
  )
}

export default function Ops() {
  const navigate = useNavigate()
  const phone = useMedia(PHONE_QUERY)
  const [hidden, setHidden] = useState<Set<TypeKey>>(new Set())
  const [selId, setSelId] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)
  const [mode, setMode] = useState<Mode>(null)

  useEffect(() => { void runAutoApply() }, [])

  const state = useLiveQuery(async () => {
    const snap = await loadOpsSnapshot()
    const proposals = generateProposals(snap)
    const names = new Map<string, string>()
    for (const p of proposals) {
      const t = typeForTable(p.objectRef.table)
      const obj = t ? await db.table(t.table).get(p.objectRef.id) : undefined
      if (t && obj) names.set(`${p.objectRef.table}:${p.objectRef.id}`, REGISTRY[t.key].title(obj))
    }
    return { proposals, names, auto: await getAuto(), log: await getAutoLog() }
  }, [])

  const proposals = state?.proposals
  const names = state?.names
  const facetCounts = useMemo(() => {
    const m = new Map<TypeKey, number>()
    for (const p of proposals ?? []) m.set(typeOf(p), (m.get(typeOf(p)) ?? 0) + 1)
    return m
  }, [proposals])
  const facets = TYPE_LIST.filter((t) => facetCounts.has(t.key))
  const visible = useMemo(() => (proposals ?? []).filter((p) => !hidden.has(typeOf(p))), [proposals, hidden])
  const sel = closed ? null : visible.find((p) => p.id === selId) ?? (phone ? null : visible[0] ?? null)

  const graph = useLiveQuery(async () => {
    if (!sel) return null
    const t = typeForTable(sel.objectRef.table)
    const obj = t ? await db.table(t.table).get(sel.objectRef.id) : undefined
    return t && obj ? { type: t.key, obj, groups: await resolveLinks(t.key, obj) } : null
  }, [sel?.id])

  const auto = state?.auto ?? {}
  const weekAgo = useNow().getTime() - WEEK_MS
  const log = state?.log ?? []
  const autoWeek = log.filter((e) => e.auto && !e.undone && new Date(e.at).getTime() >= weekAgo).length
  const needs = (proposals ?? []).filter((p) => needsApproval(p, auto)).length

  const select = (id: string | null) => { setSelId(id); setClosed(false); setMode(null) }
  const next = (id: string) => {
    const i = visible.findIndex((p) => p.id === id)
    if (phone) { setClosed(true); return }
    select(visible[i + 1]?.id ?? visible[i - 1]?.id ?? null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName) || t.isContentEditable) return
      const i = sel ? visible.findIndex((p) => p.id === sel.id) : -1
      if (e.key === 'j' && visible[i + 1]) select(visible[i + 1].id)
      else if (e.key === 'k' && i > 0) select(visible[i - 1].id)
      else if (e.key === 'e' && sel) setMode((m) => (m === 'explain' ? null : 'explain'))
      else if (e.key === 'a' && sel) { const s = sel; void applyProposal(s).then(() => next(s.id)).catch(() => {}) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const columns: Column<Proposal>[] = [
    { key: 'p', header: 'Proposal', primary: true, render: (p) => <span className="ops-clip">{p.title}</span> },
    { key: 'o', header: 'Object', render: (p) => <span className="faint ops-clip">{REGISTRY[typeOf(p)].label}: {names?.get(`${p.objectRef.table}:${p.objectRef.id}`) ?? ''}</span> },
    // Rule name is shown in the review panel.
    { key: 'k', header: 'Risk', value: true, render: (p) => <StatusChip status={p.risk === 'low' ? 'info' : 'warn'}>{p.risk === 'low' ? 'Low' : 'Medium'}</StatusChip> },
  ]

  return (
    <>
      <PageHeader title="Command" sub="Proposals from your own data. Nothing changes until you approve it, unless you opt a low-risk rule into auto-apply." />

      <KpiStrip
        items={[
          { label: 'Open proposals', value: proposals?.length ?? 0 },
          { label: 'Needs approval', value: needs, note: needs ? 'Waiting on you' : 'All clear' },
          { label: 'Auto-applied this week', value: autoWeek, note: 'Undo within 24 hours' },
        ]}
      />

      <div className="cmd">
        <nav className="cmd-facets" aria-label="Filter by object type">
          <div className="cmd-sub">Object type</div>
          {facets.map((t) => (
            <button key={t.key} className="cmd-facet" aria-pressed={!hidden.has(t.key)} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(t.key)) n.delete(t.key); else n.add(t.key); return n })}>
              <span>{t.label}</span>
              <span className="ops-count">{facetCounts.get(t.key) ?? 0}</span>
            </button>
          ))}
          {facets.length === 0 && <div className="faint small">No proposals yet.</div>}
        </nav>

        <section className="cmd-queue" aria-label="Proposals">
          {visible.length === 0 ? (
            <Card>
              {proposals?.length ? (
                <p className="muted small" style={{ margin: 0 }}>Every open proposal is hidden by the object filters.</p>
              ) : (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Nothing to review.</div>
                  <p className="muted small" style={{ margin: 0 }}>
                    Proposals are generated on this device from your data by fixed rules: an overdue task, a quarter goal with no progress in 14 days, a person past their contact cadence,
                    uncategorized transactions that match a merchant rule, a budget on pace to go over, or a study streak about to lapse. Add tasks, goals, people or import transactions and they will appear here.
                  </p>
                </>
              )}
            </Card>
          ) : (
            <div className="card card-flush">
              <DataTable label="Proposals" columns={columns} rows={visible} rowKey={(p) => p.id} onRow={(p) => select(p.id)} activeKey={sel?.id ?? null} />
            </div>
          )}
        </section>

        {sel ? (
          <SidePanel inline title="Review proposal" onClose={() => setClosed(true)}>
            <ReviewPanel key={sel.id} p={sel} mode={mode} setMode={setMode} onDone={() => next(sel.id)} />
          </SidePanel>
        ) : (
          !phone && (
            <aside className="side-panel cmd-empty-panel" aria-label="Review proposal">
              <div className="sheet-head"><h2>Review proposal</h2></div>
              <div className="sheet-body faint small">Select a proposal to review it.</div>
            </aside>
          )
        )}
      </div>

      {graph && <details className="card cmd-network">
        <summary>Network view<span className="faint"> · {REGISTRY[graph.type].title(graph.obj)} · {graph.groups.reduce((n, g) => n + g.objects.length, 0)} links · Show</span></summary>
        <div style={{ marginTop: 12 }}>
          <NetworkGraph type={graph.type} obj={graph.obj} groups={graph.groups} onOpen={(t, id) => navigate(`/ontology?t=${t}&id=${id}`)} />
        </div>
      </details>}

      <Card title="Auto-apply" className="cmd-auto">
        <p className="muted small" style={{ marginTop: 0 }}>
          Off by default. Low-risk rules you switch on are applied automatically, logged on the timeline, and can be undone for 24 hours. Medium-risk proposals always wait for you.
        </p>
        {RULE_IDS.map((r) => (
          <label key={r} className="ops-toggle cmd-toggle">
            <input
              type="checkbox"
              checked={!!auto[r] && RULE_META[r].autoEligible}
              disabled={!RULE_META[r].autoEligible}
              onChange={async (e) => { await setAuto(r, e.target.checked); if (e.target.checked) void runAutoApply() }}
            />
            <span className="cmd-toggle-text">
              <span>{RULE_META[r].label}</span>
              <span className="faint small">{RULE_META[r].autoEligible ? RULE_META[r].description : 'Review only. Never applied automatically.'}</span>
            </span>
          </label>
        ))}
        {log.filter((e) => e.auto).slice(-5).reverse().map((e) => (
          <div key={e.proposalId + e.at} className="ops-log-row">
            <span className="ops-clip">{e.undone ? 'Undone: ' : ''}{e.title} <span className="faint small">{e.at.slice(0, 16).replace('T', ' ')}</span></span>
            {canUndo(e) && <button className="btn btn-sm" onClick={() => undoApplied(e.proposalId)}>Undo</button>}
          </div>
        ))}
      </Card>
    </>
  )
}
