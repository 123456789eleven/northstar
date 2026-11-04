import { useState } from 'react'
import { PageHeader, Skeleton, Tabs } from '../components/ui'
import { formatDate, relativeDay } from '../lib/dates'
import { CasePanel } from '../features/career/CasePanel'
import { CaseMeter } from '../features/career/CaseMeter'
import { LeadershipPanel } from '../features/career/LeadershipPanel'
import { OneOnOnePanel } from '../features/career/OneOnOnePanel'
import { ProjectPanel } from '../features/career/ProjectPanel'
import { QuickWin, WinsList } from '../features/career/WinsPanel'
import { usePrefs, useProjects, useWins } from '../features/career/careerData'
import { barWidths, improvementPct, resultSentence } from '../features/career/projects'
import '../features/career/career.css'

type Tab = 'wins' | 'project' | 'leadership' | 'oneonone' | 'case'

export default function Career() {
  const wins = useWins()
  const projects = useProjects()
  const prefs = usePrefs()
  const [tab, setTab] = useState<Tab>('wins')
  if (!wins || !projects) return <><PageHeader title="Career" /><Skeleton lines={4} /></>

  const featured = projects.find((p) => p.featured) ?? projects[0]
  const bars = featured ? barWidths(featured) : null
  const pct = featured ? improvementPct(featured) : null
  const next = prefs?.nextOneOnOne
  const goto = (t: Tab) => { setTab(t); window.setTimeout(() => document.getElementById('car-tabs')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0) }
  const onAction = (a: 'win' | 'project' | 'oneonone') => {
    if (a === 'win') {
      const el = document.querySelector<HTMLInputElement>('input[aria-label="Log a win"]')
      el?.scrollIntoView({ block: 'center' })
      el?.focus()
    } else goto(a)
  }

  return (
    <>
      <PageHeader title="Career" sub="Turn daily work into evidence." />
      <div className="stack">
        <CaseMeter wins={wins} projects={projects} onAction={onAction} />
        <div className="car-top">
          <div className="car-col">
            <QuickWin />
          </div>
          <div className="car-col">
            <section className="card car-project" aria-label="Featured project">
              <div className="row-between">
                <h2 className="car-h">{featured ? featured.name : 'Improvement project'}</h2>
                {featured && <span className="chip">{featured.status}</span>}
              </div>
              {featured && bars ? (
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
                <p className="small muted">{featured ? (featured.baseline ? 'Add a result metric to see the before and after.' : 'Capture a baseline first: measure before you change anything.') : 'Pick one measurable thing to improve. Write down the number today.'}</p>
              )}
              <div className="row"><button className="btn btn-sm" type="button" onClick={() => goto('project')}>{featured ? 'Open project' : 'Start a project'}</button></div>
            </section>
            <section className="card car-next11" aria-label="Next 1:1">
              <div>
                <div className="stat-label">Next 1:1</div>
                <div className="car-next11-date">{next ? formatDate(next, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not set'}</div>
                {next && <div className="small muted">{relativeDay(next)}</div>}
              </div>
              <button className="btn btn-sm" type="button" onClick={() => goto('oneonone')}>{next ? 'Open notes' : 'Set date'}</button>
            </section>
          </div>
        </div>
        <div id="car-tabs">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'wins', label: 'Wins' },
              { value: 'project', label: 'Project' },
              { value: 'leadership', label: 'Leadership' },
              { value: 'oneonone', label: '1:1 notes' },
              { value: 'case', label: 'Case' },
            ]}
          />
        </div>
        {tab === 'wins' && <WinsList wins={wins} />}
        {tab === 'project' && <ProjectPanel projects={projects} />}
        {tab === 'leadership' && <LeadershipPanel wins={wins} />}
        {tab === 'oneonone' && <OneOnOnePanel />}
        {tab === 'case' && <CasePanel wins={wins} projects={projects} />}
      </div>
    </>
  )
}
