// Home (/): the Life map as the main screen. Full-bleed city with a glass HUD: title bar, overview, the district strip,
// and a breakout panel (desktop right, phone bottom sheet) that shows one tab at a time.
import { useCallback, useMemo, useState } from 'react'
import { Skeleton } from '../components/ui'
import { useMedia, PHONE_QUERY } from '../components/useMedia'
import { usePlayerState } from '../features/game/ui/playerContext'
import { useEngineOnMount } from '../features/game/ui/engineGate'
import LifeMapView from '../features/lifemap/LifeMapView'
import { BreakoutPanel, DistrictStrip, Overview, TitleBar, type HomeTab } from '../features/lifemap/HomeHud'
import { useLifeMap } from '../features/lifemap/useLifeMap'
import { useHomeHud } from '../features/lifemap/useHomeHud'
import { useDayChange } from '../features/lifemap/useDayChange'
import type { Inset } from '../features/lifemap/iso'
import '../features/lifemap/lifemap.css'
import '../features/lifemap/home.css'

const PANEL_KEY = 'home.panel'
const readOpen = () => { try { return localStorage.getItem(PANEL_KEY) !== 'closed' } catch { return true } }

export default function Home() {
  useEngineOnMount()
  const map = useLifeMap()
  const hud = useHomeHud()
  const day = useDayChange()
  const p = usePlayerState()
  const phone = useMedia(PHONE_QUERY)
  const [tab, setTab] = useState<HomeTab>('today')
  const [open, setOpenState] = useState(readOpen)
  const [sheet, setSheet] = useState(false)
  const setOpen = useCallback((o: boolean) => { setOpenState(o); try { localStorage.setItem(PANEL_KEY, o ? 'open' : 'closed') } catch { /* ignore */ } }, [])
  const focus = tab === 'today' ? null : tab
  const onFocus = useCallback((id: HomeTab | null) => { setTab(id ?? 'today'); if (!phone) setOpen(true) }, [phone, setOpen])

  const inset = useMemo<Inset>(() => (phone
    ? { t: 70, b: (sheet ? 430 : 288) }
    : { l: 272, r: open ? 372 : 64, t: 64, b: 112 }), [phone, sheet, open])

  return (
    <div className={`hm${phone ? ' is-phone' : ''}`} data-testid="home">
      {map ? (
        <LifeMapView map={map} focus={focus} onFocus={onFocus} inset={inset} phone={phone} />
      ) : (
        <div className="lm" aria-busy="true"><div className="hm-loading"><Skeleton lines={3} label="Loading map" /></div></div>
      )}
      <TitleBar />
      {map && (
        <>
          <Overview map={map} hud={hud} p={p} day={day} />
          {!phone && <DistrictStrip tab={tab} onTab={onFocus} districts={map.districts} />}
          <BreakoutPanel tab={tab} onTab={onFocus} open={phone ? sheet : open} onOpen={phone ? setSheet : setOpen} map={map} hud={hud} p={p} phone={phone} day={day} />
        </>
      )}
    </div>
  )
}
