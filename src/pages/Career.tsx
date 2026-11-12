// Office, Wins floor: the hero logs a win in one line and shows it rise into the case meter. Recent wins below;
// every win and the leadership coverage sit behind More.
import { PageSkeleton } from '../components/ui'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { LeadershipPanel } from '../features/career/LeadershipPanel'
import { WinsList } from '../features/career/WinsPanel'
import { WinsHero } from '../features/career/WinsHero'
import { useProjects, useWins } from '../features/career/careerData'
import '../features/career/career.css'
import '../features/buildings/office.css'

export default function Career() {
  const wins = useWins()
  const projects = useProjects()
  if (!wins || !projects) return <PageSkeleton rows={4} />
  return (
    <FloorView
      label="Wins"
      className="office-floor"
      hero={<WinsHero wins={wins} projects={projects} />}
      support={[
        <FloorCard key="recent" title="Recent wins" action={<span className="small muted mono">{wins.length}</span>}>
          <WinsList wins={wins} limit={5} />
        </FloorCard>,
      ]}
      more={
        <FloorMore
          floor="Wins"
          items={[
            { id: 'all', label: 'All wins', value: wins.length, panel: <WinsList wins={wins} limit={200} /> },
            { id: 'lead', label: 'Leadership coverage', panel: <LeadershipPanel wins={wins} /> },
          ]}
        />
      }
    />
  )
}
