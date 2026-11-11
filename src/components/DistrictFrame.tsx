// District frame: the head above every non-home page. The mini-map (where you are in the city), then the district name.
import { useLocation } from 'react-router-dom'
import { DISTRICTS, districtForPath } from './districts'
import { useMedia, PHONE_QUERY } from './useMedia'
import MiniMap from '../features/lifemap/MiniMap'

export function CityHead() {
  const { pathname } = useLocation()
  const phone = useMedia(PHONE_QUERY)
  const id = districtForPath(pathname)
  if (id === 'home') return null
  const d = DISTRICTS[id]
  return (
    <div className="city-head" data-district={id}>
      <MiniMap active={id} phone={phone} />
      <div className="city-head-text">
        <span className="city-head-name">{d.label}</span>
      </div>
    </div>
  )
}
