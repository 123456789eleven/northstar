// One subtle moment when a badge is newly earned. Reuses the plan toast styling. The first run on a device records
// what is already earned silently (device-local, never synced); only later gains show.
import { useEffect, useRef, useState } from 'react'
import { celebrate } from '../game/ui/feedback'
import { earnedIds } from './badges'
import { useBadges } from './useBadges'

const KEY = 'ns.badges.seen'

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch { return null }
}
function writeSeen(s: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify([...s])) } catch { /* private mode */ }
}

export function BadgeWatcher() {
  const badges = useBadges()
  const [msg, setMsg] = useState<string | null>(null)
  const busy = useRef(false)
  useEffect(() => {
    if (!badges) return
    const ids = earnedIds(badges)
    const seen = readSeen()
    if (!seen) { writeSeen(new Set(ids)); return }
    const fresh = badges.filter((b) => b.earned && !seen.has(b.id))
    if (fresh.length === 0) return
    writeSeen(new Set(ids))
    if (busy.current) return
    busy.current = true
    celebrate('tick')
    setMsg(fresh.length === 1 ? fresh[0].title : `${fresh.length} badges`)
    window.setTimeout(() => { setMsg(null); busy.current = false }, 3000)
  }, [badges])
  if (!msg) return null
  return (
    <div className="moment-layer">
      <div className="moment" role="status" aria-live="polite" onClick={() => setMsg(null)}>
        <span className="moment-text">
          <span className="moment-title">Badge earned</span>
          <span className="moment-sub">{msg}</span>
        </span>
      </div>
    </div>
  )
}
