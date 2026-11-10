import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useFocusParam, useFocusTarget } from '../lib/useFocusParam'
import { PageHeader, Tabs } from '../components/ui'
import { Achievements, AddEntry, OnThisDay, Timeline } from '../features/history/history'
import { MilestoneShelf } from '../features/history/MilestoneShelf'
import { BadgesView } from '../features/badges/BadgesView'
import { BadgeWatcher } from '../features/badges/BadgeWatcher'
import '../features/history/history.css'
import '../features/space/space.css'

type Tab = 'timeline' | 'achievements' | 'badges'

export default function History() {
  const [tab, setTab] = useState<Tab>('timeline')
  const [adding, setAdding] = useState(false)
  const [revealAt, setRevealAt] = useState<string>()
  const focusId = useFocusParam().focus
  const focusEv = useLiveQuery(async () => (focusId ? ((await db.events.get(Number(focusId))) ?? null) : undefined), [focusId])
  useFocusTarget({
    ready: !focusId || focusEv !== undefined,
    exists: () => !!focusEv,
    reveal: () => { setTab('timeline'); setRevealAt(focusEv!.at) },
  })
  return (
    <>
      <PageHeader
        title="Milestones"
        icon="history"
        sub="What you finished, dated, and everything else you did."
        actions={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add entry</button>}
      />

      <MilestoneShelf />

      <Tabs<Tab> value={tab} onChange={setTab} options={[{ value: 'timeline', label: 'Timeline' }, { value: 'achievements', label: 'Logbook' }, { value: 'badges', label: 'Badges' }]} />
      {tab === 'timeline' ? <><OnThisDay /><Timeline onAdd={() => setAdding(true)} revealAt={revealAt} /></> : tab === 'badges' ? <BadgesView /> : <Achievements onAdd={() => setAdding(true)} />}
      <BadgeWatcher />
      {adding && <AddEntry onClose={() => setAdding(false)} />}
    </>
  )
}
