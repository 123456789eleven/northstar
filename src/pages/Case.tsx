// Office, Case floor: the strength meter is the hero (the score counts up, each part springs). Inputs and the next 1:1 sit
// under it. Copying the case, 1:1 notes and the scoring rules are behind More.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, PageSkeleton } from '../components/ui'
import { formatDate, relativeDay } from '../lib/dates'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { CaseMeter } from '../features/career/CaseMeter'
import { CasePanel } from '../features/career/CasePanel'
import { OneOnOnePanel } from '../features/career/OneOnOnePanel'
import { usePrefs, useProjects, useWins } from '../features/career/careerData'
import { CASE_RULES } from '../features/career/caseStrength'
import { useCaseStrength } from '../features/career/useCaseStrength'
import '../features/career/career.css'
import '../features/buildings/office.css'

export default function Case() {
  const wins = useWins()
  const projects = useProjects()
  const prefs = usePrefs()
  const nav = useNavigate()
  const [notes, setNotes] = useState(false)
  if (!wins || !projects) return <PageSkeleton rows={4} />
  return <CaseFloor wins={wins} projects={projects} next={prefs?.nextOneOnOne} notes={notes} setNotes={setNotes} go={nav} />
}

function CaseFloor({ wins, projects, next, notes, setNotes, go }: {
  wins: NonNullable<ReturnType<typeof useWins>>
  projects: NonNullable<ReturnType<typeof useProjects>>
  next?: string
  notes: boolean
  setNotes: (b: boolean) => void
  go: (to: string) => void
}) {
  const r = useCaseStrength(wins, projects)
  const inputs = (
    <FloorCard key="inputs" title="Inputs">
      <ul className="car-in" aria-label="Case inputs">
        {r.segments.map((s) => (
          <li key={s.key}>
            <span className="car-in-label">{s.label}</span>
            <span className="car-in-detail">{s.detail}</span>
            <span className="car-in-pts mono">{Math.round(s.points)}/{s.max}</span>
          </li>
        ))}
      </ul>
    </FloorCard>
  )
  const oneOnOne = (
    <FloorCard key="one" title="Next 1:1" action={<button className="btn btn-sm" type="button" onClick={() => setNotes(true)}>{next ? 'Open notes' : 'Set date'}</button>}>
      <div className="car-next11-date">{next ? formatDate(next, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not set'}</div>
      {next && <div className="small muted">{relativeDay(next)}</div>}
    </FloorCard>
  )
  return (
    <>
      <FloorView
        label="Case"
        className="office-floor"
        hero={<CaseMeter wins={wins} projects={projects} onAction={(a) => (a === 'win' ? go('/career') : a === 'project' ? go('/projects') : setNotes(true))} />}
        support={[inputs, oneOnOne]}
        more={
          <FloorMore
            floor="Case"
            items={[
              { id: 'copy', label: 'Copy the case', panel: <CasePanel wins={wins} projects={projects} /> },
              { id: 'notes', label: '1:1 notes', onSelect: () => setNotes(true) },
              {
                id: 'how', label: 'How it is scored',
                panel: (
                  <div className="stack">
                    <p className="small muted">Five parts, 20 points each. Only the last 90 days count.</p>
                    <ul className="car-how-list small">
                      {(Object.keys(CASE_RULES) as (keyof typeof CASE_RULES)[]).map((k) => <li key={k}><strong>{CASE_RULES[k].label}.</strong> {CASE_RULES[k].rule}</li>)}
                    </ul>
                  </div>
                ),
              },
            ]}
          />
        }
      />
      {notes && <Modal title="1:1 notes" onClose={() => setNotes(false)} wide><OneOnOnePanel /></Modal>}
    </>
  )
}
