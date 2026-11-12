// Office, Projects floor: the featured project is the hero (before and after bars, one sentence, a status track whose
// marker slides when you change it). Other projects list below; adding one is in More.
import { useState } from 'react'
import { PageSkeleton } from '../components/ui'
import { useToast } from '../components/toastContext'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { saveProjects, useProjects } from '../features/career/careerData'
import { ProjectEditor, toDraft, type Draft } from '../features/career/ProjectPanel'
import { STATUSES, barWidths, improvementPct, resultSentence, MAX_PROJECTS, type Project } from '../features/career/projects'
import '../features/career/career.css'
import '../features/buildings/office.css'

export default function Projects() {
  const toast = useToast()
  const projects = useProjects()
  const [editing, setEditing] = useState<Draft | null>(null)
  if (!projects) return <PageSkeleton rows={3} />

  const featured = projects.find((p) => p.featured) ?? projects[0]
  const others = projects.filter((p) => p !== featured)
  const setStatus = async (p: Project, status: Project['status']) => {
    if (p.status === status) return
    const before = projects
    await saveProjects(before.map((x) => (x.id === p.id ? { ...x, status } : x)))
    toast({ message: `${p.name}: ${status}`, undo: () => saveProjects(before) })
  }

  let hero
  if (!featured) {
    hero = (
      <section className="card floor-hero pj-hero" aria-label="Featured project">
        <h2 className="pj-name">Pick one number to improve</h2>
        <p className="small muted">Write down where it is today, before you change anything.</p>
        <div><button className="btn btn-primary" type="button" onClick={() => setEditing(toDraft(undefined, true))}>Start a project</button></div>
      </section>
    )
  } else {
    const bars = barWidths(featured)
    const pct = improvementPct(featured)
    hero = (
      <section className="card floor-hero pj-hero" aria-label="Featured project">
        <div className="pj-head">
          <h2 className="pj-name">{featured.name}</h2>
          <button className="btn btn-sm" type="button" onClick={() => setEditing(toDraft(featured))}>Edit {featured.name}</button>
        </div>
        {bars ? (
          <>
            <div className="car-ba is-big" role="img" aria-label={`Before ${featured.baseline!.value}, after ${featured.result!.value}`}>
              <span className="car-ba-label">Before</span>
              <span className="car-ba-track"><span className="car-ba-fill car-ba-before" style={{ width: `${bars.before}%` }} /></span>
              <span className="car-ba-val">{featured.baseline!.value}</span>
              <span className="car-ba-label">After</span>
              <span className="car-ba-track"><span className="car-ba-fill car-ba-after" style={{ width: `${bars.after}%` }} /></span>
              <span className="car-ba-val">{featured.result!.value}</span>
            </div>
            <p className="car-sentence">{resultSentence(featured)}{pct == null ? '' : '.'}</p>
          </>
        ) : (
          <p className="small muted">{featured.baseline ? 'Add a result to see before and after.' : 'Measure a baseline first.'}</p>
        )}
        <div className="pj-track" role="group" aria-label="Project status" style={{ '--i': STATUSES.indexOf(featured.status) } as React.CSSProperties}>
          <span className="pj-thumb" aria-hidden="true" />
          {STATUSES.map((s) => (
            <button key={s} type="button" className="pj-step" aria-pressed={featured.status === s} onClick={() => void setStatus(featured, s)}>{s}</button>
          ))}
        </div>
        {featured.next && <p className="small"><span className="muted">Next: </span>{featured.next}</p>}
      </section>
    )
  }

  const list = others.length > 0 && (
    <FloorCard key="others" title="Other projects" action={<span className="small muted mono">{others.length}</span>}>
      <ul className="pj-list">
        {others.map((p) => {
          const pct = improvementPct(p)
          return (
            <li key={p.id} className="pj-row">
              <span className="pj-row-main">
                <span className="pj-row-name">{p.name}</span>
                <span className="pj-row-sub">{p.status}{pct != null ? ` · ${resultSentence(p)}` : ''}</span>
              </span>
              <button className="btn btn-sm" type="button" onClick={() => setEditing(toDraft(p))}>Edit {p.name}</button>
            </li>
          )
        })}
      </ul>
    </FloorCard>
  )

  return (
    <>
      <FloorView
        label="Projects"
        className="office-floor"
        hero={hero}
        support={[list]}
        more={
          <FloorMore
            floor="Projects"
            items={[{ id: 'add', label: projects.length >= MAX_PROJECTS ? 'Project limit reached' : 'Add project', onSelect: () => { if (projects.length < MAX_PROJECTS) setEditing(toDraft()) } }]}
          />
        }
      />
      <ProjectEditor projects={projects} editing={editing} setEditing={setEditing} />
    </>
  )
}
