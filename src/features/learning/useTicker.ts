import { useEffect, useState } from 'react'

/** Wall-clock reading that refreshes every second while `active`. */
export function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const sync = window.setTimeout(() => setNow(Date.now()), 0)
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.clearTimeout(sync); window.clearInterval(id) }
  }, [active])
  return now
}

