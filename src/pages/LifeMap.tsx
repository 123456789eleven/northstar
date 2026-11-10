// Life map (/map): an isometric picture of the week across Body, Money, Mind, Career and People. Prototype, presentation only.
import { Skeleton } from '../components/ui'
import LifeMapView from '../features/lifemap/LifeMapView'
import { useLifeMap } from '../features/lifemap/useLifeMap'
import '../features/lifemap/lifemap.css'

export default function LifeMap() {
  const map = useLifeMap()
  return (
    <>
      <div className="lm-head">
        <h1 className="page-title">Life map</h1>
        <span className="lm-tag">Prototype</span>
        <p>Taller, brighter blocks mean more happened there this week. Red marks something behind.</p>
      </div>
      {map ? <LifeMapView map={map} /> : <div className="lm" aria-busy="true"><div style={{ padding: 24 }}><Skeleton lines={4} label="Loading map" /></div></div>}
    </>
  )
}
