import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { PageHeader } from '../components/ui'
import { NetworkGraph } from '../features/ops/NetworkGraph'
import { applyProposal, canUndo, decide, getAuto, getAutoLog, loadOpsSnapshot, runAutoApply, setAuto, undoApplied } from '../features/ops/opsActions'
import { generateProposals, needsApproval, RULE_IDS, RULE_META, type Proposal } from '../features/ops/proposals'
import { REGISTRY, resolveLinks, TYPE_LIST, typeForTable, type TypeKey } from '../ontology/registry'
import '../features/ops/ops.css'

const WEEK_MS = 7 * 86_400_000

function typeOf(p: Proposal): TypeKey {
  return (typeForTable(p.objectRef.table)?.key ?? 'Task') as TypeKey
}

function ReviewPanel({ p, onDone }: { p: Proposal; onDone: () => void }) {
  const [mode, setMode] = useState<'explain' | 'logic' | 'modify' | null>(null)
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
    <div className="ops-panel-body">
      <div className="ops-label">{RULE_META[p.rule].label} / {p.risk} risk</div>
      <div style={{ marginTop: 4, fontWeight: 600 }}>{p.title}</div>
      <div className="ops-actions">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => accept(false)}>{p.action.label === 'Mark reviewed' ? 'Accept: mark reviewed' : 'Accept'}</button>
        {canModify && <button className="btn btn-sm" aria-pressed={mode === 'modify'} onClick={() => toggle('modify')}>Modify</button>}
        <button className="btn btn-sm" onClick={async () => { await decide(p.id, 'dismissed'); onDone() }}>Dismiss</button>
        <button className="btn btn-sm btn-ghost" onClick={async () => { await decide(p.id, 'snoozed', { days: 1 }); onDone() }}>Snooze 1d</button>
        <button className="btn btn-sm btn-ghost" aria-pressed={mode === 'explain'} onClick={() => toggle('explain')}>Explain</button>
        <button className="btn btn-sm btn-ghost" aria-pressed={mode === 'logic'} onClick={() => toggle('logic')}>Show logic</button>
      </div>
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
          <div>{p.rationale}</div>
          <div className="ops-label" style={{ marginTop: 10 }}>Evidence</div>
          <ul>{p.evidence.map((e, i) => <li key={i} className="ops-mono">{e}</li>)}</ul>
        </div>
      )}
      {mode === 'logic' && (
        <div className="ops-block">
          <div className="ops-label">Predicate</div>
          <pre className="ops-pre">{p.logic}</pre>
          <div className="ops-label" style={{ marginTop: 10 }}>Rule</div>
          <div className="ops-mono">{p.rule}</div>
        </div>
      )}
    </div>
  )
}

export default function Ops() {
  const navigate = useNavigate()
  const [hidden, setHidden] = useState<Set<TypeKey>>(new Set())
  const [selId, setSelId] = useState<string | null>(null)

  useEffect(() => { void runAutoApply() }, [])

  const state = useLiveQuery(async () => {
    const snap = await loadOpsSnapshot()
    return { proposals: generateProposals(snap), auto: await getAuto(), log: await getAutoLog() }
  }, [])
  const counts = useLiveQuery(async () => Object.fromEntries(await Promise.all(TYPE_LIST.map(async (t) => [t.key, await db.table(t.table).count()] as const))) as Record<TypeKey, number>, [])

  const proposals = state?.proposals
  const visible = useMemo(() => (proposals ?? []).filter((p) => !hidden.has(typeOf(p))), [proposals, hidden])
  const sel = visible.find((p) => p.id === selId) ?? visible[0] ?? null

  const graph = useLiveQuery(async () => {
    if (!sel) return null
    const t = typeForTable(sel.objectRef.table)
    const obj = t ? await db.table(t.table).get(sel.objectRef.id) : undefined
    return t && obj ? { type: t.key, obj, groups: await resolveLinks(t.key, obj) } : null
  }, [sel?.id])

  const auto = state?.auto ?? {}
  const weekAgo = Date.now() - WEEK_MS
  const log = state?.log ?? []
  const autoWeek = log.filter((e) => e.auto && !e.undone && new Date(e.at).getTime() >= weekAgo).length
  const needs = (proposals ?? []).filter((p) => needsApproval(p, auto)).length

  const next = (id: string) => {
    const i = visible.findIndex((p) => p.id === id)
    setSelId(visible[i + 1]?.id ?? visible[i - 1]?.id ?? null)
  }

  return (
    <>
      <PageHeader title="Command" sub="Proposals from your own data. Nothing changes until you approve it, unless you opt a low-risk rule into auto-apply." />

      <div className="ops-kpis">
        <div className="ops-kpi"><div className="ops-label">Open proposals</div><div className="ops-kpi-value">{proposals?.length ?? 0}</div></div>
        <div className="ops-kpi"><div className="ops-label">Auto-applied this week</div><div className="ops-kpi-value">{autoWeek}</div></div>
        <div className="ops-kpi"><div className="ops-label">Needs approval</div><div className="ops-kpi-value">{needs}</div></div>
      </div>

      <div className="ops-grid">
        <section className="ops-panel" aria-label="Objects">
          <div className="ops-panel-head"><span className="ops-label">Objects</span></div>
          {TYPE_LIST.map((t) => (
            <button key={t.key} className="ops-legend-row" aria-pressed={!hidden.has(t.key)} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(t.key)) n.delete(t.key); else n.add(t.key); return n })}>
              <span className="ops-check" />
              {t.label}
              <span className="ops-count">{counts?.[t.key] ?? 0}</span>
            </button>
          ))}
        </section>

        <section className="ops-panel" aria-label="Proposals">
          <div className="ops-panel-head"><span className="ops-label">Proposals</span><span className="ops-count">{visible.length}</span></div>
          {visible.length === 0 ? (
            <div className="ops-panel-body" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              {proposals?.length ? 'Every open proposal is hidden by the object filters.' : (
                <>
                  <div style={{ color: 'var(--ink)', marginBottom: 6 }}>Nothing to review.</div>
                  Proposals are generated on this device from your data by fixed rules: an overdue task, a quarter goal with no progress in 14 days, a person past their contact cadence,
                  uncategorized transactions that match a merchant rule, a budget on pace to go over, or a study streak about to lapse. Add tasks, goals, people or import transactions and they will appear here.
                </>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="ops-table">
                <thead><tr><th>Object</th><th>Proposal</th><th className="col-rule">Rule</th><th>Risk</th></tr></thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.id} tabIndex={0} aria-selected={sel?.id === p.id} onClick={() => setSelId(p.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelId(p.id))}>
                      <td><span className="ops-label">{REGISTRY[typeOf(p)].label}</span> <span className="ops-mono">#{p.objectRef.id}</span></td>
                      <td><div className="ops-clip">{p.title}</div></td>
                      <td className="col-rule ops-mono">{p.rule}</td>
                      <td className={`ops-mono ops-risk-${p.risk}`}>{p.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="ops-panel" aria-label="Review proposal">
          <div className="ops-panel-head"><span className="ops-label">Review proposal</span></div>
          {sel ? <ReviewPanel key={sel.id} p={sel} onDone={() => next(sel.id)} /> : <div className="ops-panel-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>Select a proposal to review it.</div>}
        </section>
      </div>

      <section className="ops-panel" style={{ marginTop: 12 }} aria-label="Network view">
        <div className="ops-panel-head">
          <span className="ops-label">Network view</span>
          {graph && <span className="ops-mono">{REGISTRY[graph.type].title(graph.obj)}</span>}
        </div>
        <div className="ops-panel-body">
          {graph ? (
            <NetworkGraph type={graph.type} obj={graph.obj} groups={graph.groups} onOpen={(t, id) => navigate(`/ontology?t=${t}&id=${id}`)} />
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Select a proposal to see the object and what it links to.</div>
          )}
        </div>
      </section>

      <section className="ops-panel" style={{ marginTop: 12 }} aria-label="Auto-apply">
        <div className="ops-panel-head"><span className="ops-label">Auto-apply (off by default)</span></div>
        <div className="ops-panel-body">
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
            Low-risk rules you switch on are applied automatically, logged on the timeline, and can be undone for 24 hours. Medium-risk proposals always wait for you.
          </div>
          {RULE_IDS.map((r) => (
            <label key={r} className="ops-toggle" title={RULE_META[r].description}>
              <input
                type="checkbox"
                checked={!!auto[r] && RULE_META[r].autoEligible}
                disabled={!RULE_META[r].autoEligible}
                onChange={async (e) => { await setAuto(r, e.target.checked); if (e.target.checked) void runAutoApply() }}
              />
              <span>{RULE_META[r].label}</span>
              <span className="ops-label">{RULE_META[r].autoEligible ? RULE_META[r].description : 'review only'}</span>
            </label>
          ))}
          {log.filter((e) => e.auto).slice(-5).reverse().map((e) => (
            <div key={e.proposalId + e.at} className="ops-log-row">
              <span className="ops-clip">{e.undone ? 'Undone: ' : ''}{e.title} <span className="ops-label">{e.at.slice(0, 16).replace('T', ' ')}</span></span>
              {canUndo(e) && <button className="btn btn-sm" onClick={() => undoApplied(e.proposalId)}>Undo</button>}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
