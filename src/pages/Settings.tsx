import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui'
import { AboutSection, BackupSection, DangerSection, ProfileSection, StatusStrip, StorageSection } from '../features/settings/Sections'
import { SyncSection } from '../features/settings/SyncSection'
import '../features/settings/settings.css'

const SECTIONS = [
  { id: 'set-sync', label: 'Sync' },
  { id: 'set-backup', label: 'Backup & restore' },
  { id: 'set-data', label: 'Data on this device' },
  { id: 'set-prefs', label: 'Preferences' },
  { id: 'set-about', label: 'About & privacy' },
  { id: 'set-danger', label: 'Danger zone' },
]

function SectionIndex() {
  const [active, setActive] = useState(SECTIONS[0].id)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const seen = new Map<string, boolean>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting)
      const first = SECTIONS.find((s) => seen.get(s.id))
      if (first) setActive(first.id)
    }, { rootMargin: '-10% 0px -70% 0px' })
    for (const s of SECTIONS) { const el = document.getElementById(s.id); if (el) io.observe(el) }
    return () => io.disconnect()
  }, [])
  // Buttons rather than #anchors: the app uses hash routing, so a bare #id link would navigate away.
  const go = (id: string) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    setActive(id)
  }
  return (
    <nav className="set-index" aria-label="Settings sections">
      {SECTIONS.map((s) => (
        <button key={s.id} type="button" className={s.id === 'set-danger' ? 'is-danger' : undefined} aria-current={active === s.id ? 'true' : undefined} onClick={() => go(s.id)}>{s.label}</button>
      ))}
    </nav>
  )
}

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" sub="Sync, backups, data on this device and privacy." />
      <StatusStrip />
      <div className="set-layout">
        <SectionIndex />
        <div className="set-page">
          <div id="set-sync" className="set-anchor"><SyncSection /></div>
          <div id="set-backup" className="set-anchor"><BackupSection /></div>
          <div id="set-data" className="set-anchor"><StorageSection /></div>
          <div id="set-prefs" className="set-anchor"><ProfileSection /></div>
          <div id="set-about" className="set-anchor"><AboutSection /></div>
          <div id="set-danger" className="set-anchor set-danger-wrap"><DangerSection /></div>
        </div>
      </div>
    </>
  )
}
