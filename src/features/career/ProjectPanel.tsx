import { Field, Modal } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { today } from '../../lib/dates'
import { newId } from '../goals/progress'
import { saveProjects } from './careerData'
import { STATUSES, type Metric, type Project } from './projects'

export interface Draft {
  id: string; name: string; problem: string; better: 'lower' | 'higher'
  bv: string; bu: string; bd: string; change: string; rv: string; ru: string; rd: string
  status: Project['status']; next: string; featured: boolean
}

const metric = (v: string, u: string, d: string): Metric | undefined => (v.trim() !== '' && Number.isFinite(Number(v)) ? { value: Number(v), unit: u.trim(), date: d || today() } : undefined)

export function toDraft(p?: Project, first = false): Draft {
  return {
    id: p?.id ?? newId(), name: p?.name ?? '', problem: p?.problem ?? '', better: p?.better ?? 'lower',
    bv: p?.baseline ? String(p.baseline.value) : '', bu: p?.baseline?.unit ?? '', bd: p?.baseline?.date ?? today(),
    change: p?.change ?? '', rv: p?.result ? String(p.result.value) : '', ru: p?.result?.unit ?? p?.baseline?.unit ?? '', rd: p?.result?.date ?? today(),
    status: p?.status ?? 'idea', next: p?.next ?? '', featured: p?.featured ?? first,
  }
}

/** The add / edit project dialog. The floor owns `editing`; null closes it. */
export function ProjectEditor({ projects, editing, setEditing }: { projects: Project[]; editing: Draft | null; setEditing: (d: Draft | null) => void }) {
  const toast = useToast()
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
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing(editing ? { ...editing, [k]: v } : null)

  return (
    <>
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
    </>
  )
}
