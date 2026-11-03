import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader, Tabs } from '../components/ui'
import { db } from '../db'
import { today } from '../lib/dates'
import DayView from '../features/food/DayView'
import WeekView from '../features/food/WeekView'
import { RowMenu } from '../features/goals/GoalMenu'
import { PHONE_QUERY, useMedia } from '../components/useMedia'
import TemplatesModal from '../features/food/TemplatesModal'
import { FavoritesModal, TargetsModal } from '../features/food/FoodModals'
import { TARGETS_KEY, type FoodTargets } from '../features/food/foodData'
import '../features/food/food.css'

type View = 'day' | 'week'

export default function Food() {
  const [view, setView] = useState<View>('day')
  const [date, setDate] = useState(today())
  const [modal, setModal] = useState<'targets' | 'favorites' | 'templates' | null>(null)
  const phone = useMedia(PHONE_QUERY)
  const targetsRow = useLiveQuery(() => db.settings.get(TARGETS_KEY), [])
  const targets = (targetsRow?.value as FoodTargets | undefined) ?? {}

  return (
    <>
      <PageHeader
        title="Food"
        sub="Log what you eat in a tap or a line."
        actions={
          <>
            <button className="btn" onClick={() => setModal('favorites')}>
              Favorites
            </button>
            {phone ? (
              <RowMenu label="More food actions" items={[{ label: 'Templates', onSelect: () => setModal('templates') }, { label: 'Targets', onSelect: () => setModal('targets') }]} />
            ) : (
              <>
                <button className="btn" onClick={() => setModal('templates')}>
                  Templates
                </button>
                <button className="btn" onClick={() => setModal('targets')}>
                  Targets
                </button>
              </>
            )}
          </>
        }
      />
      <Tabs
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
        ]}
      />
      {view === 'day' ? <DayView date={date} setDate={setDate} targets={targets} onTargets={() => setModal('targets')} /> : <WeekView end={date} targets={targets} onOpen={(d) => { setDate(d); setView('day') }} />}
      {modal === 'targets' && <TargetsModal targets={targets} onClose={() => setModal(null)} />}
      {modal === 'templates' && <TemplatesModal onClose={() => setModal(null)} />}
      {modal === 'favorites' && <FavoritesModal onClose={() => setModal(null)} />}
    </>
  )
}
