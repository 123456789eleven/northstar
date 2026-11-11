import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader, PageSkeleton } from '../components/ui'
import { db } from '../db'
import { readBodySettings } from '../features/body/bodyData'
import TrainingPanel from '../features/body/TrainingPanel'
import '../features/body/body.css'
import '../features/body/body2.css'

export default function Training() {
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const settingRows = useLiveQuery(() => db.settings.where('key').startsWith('body.').toArray(), [])
  if (!habits || !settingRows) return <PageSkeleton rows={3} />
  const s = readBodySettings(settingRows)
  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader title="Training" />
      <TrainingPanel habits={habits} target={s.trainDays} />
    </div>
  )
}
