import { useState } from 'react'
import { PageHeader, Tabs } from '../components/ui'
import { Achievements, AddEntry, OnThisDay, Timeline } from '../features/history/history'
import '../features/history/history.css'

type Tab = 'timeline' | 'achievements'

export default function History() {
  const [tab, setTab] = useState<Tab>('timeline')
  const [adding, setAdding] = useState(false)
  return (
    <>
      <PageHeader
        title="History"
        sub="Everything you have done, in one place."
        actions={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add entry</button>}
      />
      <OnThisDay />
      <Tabs<Tab> value={tab} onChange={setTab} options={[{ value: 'timeline', label: 'Timeline' }, { value: 'achievements', label: 'Achievements' }]} />
      {tab === 'timeline' ? <Timeline /> : <Achievements />}
      {adding && <AddEntry onClose={() => setAdding(false)} />}
    </>
  )
}
