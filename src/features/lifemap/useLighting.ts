// Local time-of-day lighting, refreshed every five minutes (no per-frame work; the scene redraws only when the step changes).
import { useEffect, useState } from 'react'
import { lightingFor, type Lighting } from './light'

export function useLighting(): Lighting {
  const [l, setL] = useState(() => lightingFor(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => {
      const n = lightingFor(new Date())
      setL((p) => (p.windows === n.windows && p.night === n.night ? p : n))
    }, 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [])
  return l
}
