// A quiet tick that confirms a setting was saved: listens to writes on the settings table (device-local keys excluded).
import { useEffect, useState } from 'react'
import { db } from '../../db'

const QUIET = /^(sync\.|gcal\.|demo\.|backup\.|ops\.|market\.|simplefin\.)/

export default function SavedTick() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const flash = (key: unknown) => {
      if (typeof key === 'string' && QUIET.test(key)) return
      setTimeout(() => { setOn(true); clearTimeout(t); t = setTimeout(() => setOn(false), 1600) }, 0)
    }
    const creating = (key: unknown) => { flash(key) }
    const updating = (_mods: object, key: unknown) => { flash(key) }
    db.settings.hook('creating', creating)
    db.settings.hook('updating', updating)
    return () => { db.settings.hook('creating').unsubscribe(creating); db.settings.hook('updating').unsubscribe(updating); clearTimeout(t) }
  }, [])
  return (
    <span className={`set-tick${on ? ' is-on' : ''}`} role="status" aria-live="polite">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
      <span>{on ? 'Saved' : ''}</span>
    </span>
  )
}
