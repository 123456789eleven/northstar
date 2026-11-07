import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader, Tabs } from '../components/ui'
import { db } from '../db'
import { today } from '../lib/dates'
import { useFocusParam, useFocusTarget } from '../lib/useFocusParam'
import DayView from '../features/food/DayView'
import WeekView from '../features/food/WeekView'
import { RowMenu } from '../features/goals/GoalMenu'
import { PHONE_QUERY, useMedia } from '../components/useMedia'
import TemplatesModal from '../features/food/TemplatesModal'
import { FavoritesModal, TargetsModal } from '../features/food/FoodModals'
import { TARGETS_KEY, type FoodTargets } from '../features/food/foodData'
import '../features/food/food.css'
import '../features/food/food2.css'

type View = 'day' | 'week'

export default function Food() {
  const [view, setView] = useState<View>('day')
  const [date, setDate] = useState(today())
  const [modal, setModal] = useState<'targets' | 'favorites' | 'templates' | null>(null)
  const phone = useMedia(PHONE_QUERY)
  const targetsRow = useLiveQuery(() => db.settings.get(TARGETS_KEY), [])
  const focusDay = useFocusParam().focus
  const hasMeals = useLiveQuery(async () => (focusDay ? (await db.meals.where('date').equals(focusDay).count()) > 0 : undefined), [focusDay])
  useFocusTarget({
    ready: !focusDay || hasMeals !== undefined,
    exists: () => !!hasMeals,
    reveal: (id) => { setDate(id); setView('day') },
  })
  const targets = (targetsRow?.value as FoodTargets | undefined) ?? {}
  const dayKcal = useLiveQuery(async () => (await db.meals.where('date').equals(date).toArray()).reduce((s, m) => s + (m.calories ?? 0), 0), [date])
  const sub = targets.calories ? `${(dayKcal ?? 0).toLocaleString()} of ${targets.calories.toLocaleString()} kcal${date === today() ? ' today' : ''}` : 'Set a daily calorie target to see your day as a ring.'

  return (
    <>
      <PageHeader
        title="Food"
        sub={sub}
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
