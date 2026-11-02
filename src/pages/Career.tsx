import { useState } from 'react'
import { PageHeader, Skeleton, Stat, Tabs } from '../components/ui'
import { formatDate } from '../lib/dates'
import { CasePanel } from '../features/career/CasePanel'
import { LeadershipPanel } from '../features/career/LeadershipPanel'
import { OneOnOnePanel } from '../features/career/OneOnOnePanel'
import { ProjectPanel } from '../features/career/ProjectPanel'
import { QuickWin, WinsList } from '../features/career/WinsPanel'
import { monthNow, usePrefs, useProjects, useWins } from '../features/career/careerData'
import '../features/career/career.css'

type Tab = 'wins' | 'project' | 'leadership' | 'oneonone' | 'case'

export default function Career() {
  const wins = useWins()
  const projects = useProjects()
  const prefs = usePrefs()
  const [tab, setTab] = useState<Tab>('wins')
  if (!wins || !projects) return <><PageHeader title="Career" /><Skeleton lines={4} /></>

  const month = monthNow()
  const thisMonth = wins.filter((w) => w.date.startsWith(month)).length
  const featured = projects.find((p) => p.featured) ?? projects[0]

  return (
    <>
      <PageHeader title="Career" sub="Turn daily work into evidence." />
      <div className="stack">
        <QuickWin />
        <div className="car-month" aria-label="This month">
          <Stat label="Wins this month" value={thisMonth} />
          <Stat label="Project" value={featured ? featured.status : 'None'} note={featured?.name} />
          <Stat label="Next 1:1" value={prefs?.nextOneOnOne ? formatDate(prefs.nextOneOnOne) : 'Not set'} />
        </div>
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
        {tab === 'wins' && <WinsList wins={wins} />}
        {tab === 'project' && <ProjectPanel projects={projects} />}
        {tab === 'leadership' && <LeadershipPanel wins={wins} />}
        {tab === 'oneonone' && <OneOnOnePanel />}
        {tab === 'case' && <CasePanel wins={wins} projects={projects} />}
      </div>
    </>
  )
}
