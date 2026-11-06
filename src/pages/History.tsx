import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useFocusParam, useFocusTarget } from '../lib/useFocusParam'
import { PageHeader, Tabs } from '../components/ui'
import { Achievements, AddEntry, OnThisDay, Timeline } from '../features/history/history'
import { TrophyShelf } from '../features/history/TrophyShelf'
import '../features/history/history.css'

type Tab = 'timeline' | 'achievements'

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
        title="Trophies"
        sub="Milestones, and everything you have done, in one place."
        actions={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add entry</button>}
      />

      <TrophyShelf />

      <Tabs<Tab> value={tab} onChange={setTab} options={[{ value: 'timeline', label: 'Timeline' }, { value: 'achievements', label: 'Achievements' }]} />
      {tab === 'timeline' ? <><OnThisDay /><Timeline onAdd={() => setAdding(true)} revealAt={revealAt} /></> : <Achievements onAdd={() => setAdding(true)} />}
      {adding && <AddEntry onClose={() => setAdding(false)} />}
    </>
  )
}
