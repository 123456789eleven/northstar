import { useState } from 'react'
import { Empty, Field, Modal } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { today } from '../../lib/dates'
import { newId } from '../goals/progress'
import { saveProjects } from './careerData'
import { MAX_PROJECTS, STATUSES, barWidths, improvementPct, resultSentence, type Metric, type Project } from './projects'

interface Draft {
  id: string; name: string; problem: string; better: 'lower' | 'higher'
  bv: string; bu: string; bd: string; change: string; rv: string; ru: string; rd: string
  status: Project['status']; next: string; featured: boolean
}

const metric = (v: string, u: string, d: string): Metric | undefined => (v.trim() !== '' && Number.isFinite(Number(v)) ? { value: Number(v), unit: u.trim(), date: d || today() } : undefined)

function toDraft(p?: Project, first = false): Draft {
  return {
    id: p?.id ?? newId(), name: p?.name ?? '', problem: p?.problem ?? '', better: p?.better ?? 'lower',
    bv: p?.baseline ? String(p.baseline.value) : '', bu: p?.baseline?.unit ?? '', bd: p?.baseline?.date ?? today(),
    change: p?.change ?? '', rv: p?.result ? String(p.result.value) : '', ru: p?.result?.unit ?? p?.baseline?.unit ?? '', rd: p?.result?.date ?? today(),
    status: p?.status ?? 'idea', next: p?.next ?? '', featured: p?.featured ?? first,
  }
}

function ProjectCard({ p, onEdit }: { p: Project; onEdit: () => void }) {
  const bars = barWidths(p)
  const pct = improvementPct(p)
  const sentence = resultSentence(p)
  return (
    <section className={`card car-project ${p.featured ? 'car-featured' : ''}`}>
      <div className="row-between">
        <h2 className="car-h">{p.name}</h2>
        <span className="chip">{p.status}</span>
      </div>
      {p.problem && <p className="muted small">{p.problem}</p>}
      {bars ? (
        <div className="car-ba" role="img" aria-label={`Before ${p.baseline!.value}, after ${p.result!.value}`}>
          <span className="car-ba-label">Before</span>
          <span className="car-ba-track"><span className="car-ba-fill car-ba-before" style={{ width: `${bars.before}%` }} /></span>
          <span className="car-ba-val">{p.baseline!.value}</span>
          <span className="car-ba-label">After</span>
          <span className="car-ba-track"><span className="car-ba-fill car-ba-after" style={{ width: `${bars.after}%` }} /></span>
          <span className="car-ba-val">{p.result!.value}</span>
        </div>
      ) : (
        <p className="muted small">{p.baseline ? 'Add a result metric to see the before and after.' : 'Capture a baseline first: measure before you change anything.'}</p>
      )}
      {sentence && <p className="car-sentence">{sentence}{pct == null ? '' : '.'}</p>}
      {p.change && <p className="small"><span className="muted">Change: </span>{p.change}</p>}
      {p.next && <p className="small"><span className="muted">Next step: </span>{p.next}</p>}
      <div className="row"><button className="btn btn-sm" type="button" onClick={onEdit}>Edit {p.name}</button></div>
    </section>
  )
}

export function ProjectPanel({ projects }: { projects: Project[] }) {
  const toast = useToast()
  const [editing, setEditing] = useState<Draft | null>(null)
  const sorted = [...projects].sort((a, b) => Number(b.featured) - Number(a.featured))

  const save = async () => {
    if (!editing || !editing.name.trim()) return
    const d = editing
    const next: Project = {
      id: d.id, name: d.name.trim(), problem: d.problem.trim(), better: d.better,
      baseline: metric(d.bv, d.bu, d.bd), change: d.change.trim(), result: metric(d.rv, d.ru || d.bu, d.rd),
      status: d.status, next: d.next.trim(), featured: d.featured,
    }
    const before = projects
    const exists = before.some((p) => p.id === d.id)
    let list = exists ? before.map((p) => (p.id === d.id ? next : p)) : [...before, next]
    if (next.featured) list = list.map((p) => ({ ...p, featured: p.id === next.id }))
    await saveProjects(list)
    setEditing(null)
    toast({ message: 'Project saved', undo: () => saveProjects(before) })
  }
  const remove = async () => {
    if (!editing) return
    const before = projects
    await saveProjects(before.filter((p) => p.id !== editing.id))
    setEditing(null)
    toast({ message: 'Project deleted', undo: () => saveProjects(before) })
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((d) => (d ? { ...d, [k]: v } : d))
  const atMax = projects.length >= MAX_PROJECTS

  return (
    <div className="stack">
      {!sorted.length && (
        <Empty title="No improvement project yet" action={<button className="btn btn-primary" type="button" onClick={() => setEditing(toDraft(undefined, true))}>Start a project</button>}>
          Pick one measurable thing to make better. Write down the number today, before you change anything.
        </Empty>
      )}
      {sorted.map((p) => <ProjectCard key={p.id} p={p} onEdit={() => setEditing(toDraft(p))} />)}
      {!!sorted.length && <div><button className="btn" type="button" disabled={atMax} onClick={() => setEditing(toDraft())}>Add project</button></div>}
      {editing && (
        <Modal title={projects.some((p) => p.id === editing.id) ? 'Edit project' : 'New project'} onClose={() => setEditing(null)} wide>
          <div className="stack">
            <Field label="Name"><input className="input" value={editing.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Handoff errors per week" /></Field>
            <Field label="Problem"><input className="input" value={editing.problem} onChange={(e) => set('problem', e.target.value)} /></Field>
            <Field label="Better when">
              <select className="select" value={editing.better} onChange={(e) => set('better', e.target.value as 'lower' | 'higher')}>
                <option value="lower">The number goes down</option>
                <option value="higher">The number goes up</option>
              </select>
            </Field>
            <div className="car-form-grid">
              <Field label="Baseline value"><input className="input" inputMode="decimal" value={editing.bv} onChange={(e) => set('bv', e.target.value)} /></Field>
              <Field label="Unit"><input className="input" value={editing.bu} onChange={(e) => set('bu', e.target.value)} placeholder="errors/wk" /></Field>
              <Field label="Baseline date"><input className="input" type="date" value={editing.bd} onChange={(e) => set('bd', e.target.value)} /></Field>
            </div>
            <Field label="Change made"><input className="input" value={editing.change} onChange={(e) => set('change', e.target.value)} /></Field>
            <div className="car-form-grid">
              <Field label="Result value"><input className="input" inputMode="decimal" value={editing.rv} onChange={(e) => set('rv', e.target.value)} /></Field>
              <Field label="Result unit"><input className="input" value={editing.ru} onChange={(e) => set('ru', e.target.value)} /></Field>
              <Field label="Result date"><input className="input" type="date" value={editing.rd} onChange={(e) => set('rd', e.target.value)} /></Field>
            </div>
            <Field label="Status">
              <select className="select" value={editing.status} onChange={(e) => set('status', e.target.value as Project['status'])}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Next step"><input className="input" value={editing.next} onChange={(e) => set('next', e.target.value)} /></Field>
            <label className="row small"><input type="checkbox" checked={editing.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured project</label>
            <div className="row-between">
              <button className="btn btn-danger" type="button" onClick={remove} disabled={!projects.some((p) => p.id === editing.id)}>Delete</button>
              <div className="row">
                <button className="btn" type="button" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-primary" type="button" onClick={save} disabled={!editing.name.trim()}>Save</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
