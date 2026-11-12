// Home base, Settings floor: backup and sync status (hero), then sync, progress and preferences. Backup and restore, data
// on this device, about, the danger zone, the data hub, interview, setup and Power tools (Intel, Ontology) sit behind More.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { FloorMore, FloorView } from '../features/buildings/Floor'
import { AboutSection, BackupSection, DangerSection, ProfileSection, StorageSection } from '../features/settings/Sections'
import { SyncSection } from '../features/settings/SyncSection'
import { GameSection } from '../features/settings/GameSection'
import SettingsHero from '../features/settings/SettingsHero'
import SavedTick from '../features/settings/SavedTick'
import { openSetup } from '../features/onboarding/setupLogic'
import '../features/settings/settings.css'

export default function Settings() {
  const { hash } = useLocation()
  // "How progress is counted" links to /settings#game.
  useEffect(() => {
    if (hash === '#game') requestAnimationFrame(() => document.getElementById('set-game')?.scrollIntoView({ block: 'start' }))
  }, [hash])
  return (
    <FloorView
      label="Settings"
      className="set-floor"
      hero={<><SettingsHero /><SavedTick /></>}
      support={[
        <div key="sync" id="set-sync" className="set-anchor"><SyncSection /></div>,
        <div key="game" id="set-game" className="set-anchor"><GameSection /></div>,
        <div key="prefs" id="set-prefs" className="set-anchor"><ProfileSection /></div>,
      ]}
      more={
        <FloorMore
          floor="Settings"
          items={[
            { id: 'data', label: 'Data hub', to: '/data' },
            { id: 'backup', label: 'Backup and restore', panel: <div id="set-backup"><BackupSection /></div> },
            { id: 'device', label: 'On this device', panel: <div id="set-data"><StorageSection /></div> },
            { id: 'interview', label: 'Interview', to: '/interview?full=1' },
            { id: 'setup', label: 'Setup', onSelect: openSetup },
            {
              id: 'power', label: 'Power tools',
              panel: (close) => (
                <ul className="floor-more-items">
                  <li><a className="floor-more-item" href="#/ops" onClick={close}><span>Intel</span><span aria-hidden="true">›</span></a></li>
                  <li><a className="floor-more-item" href="#/ontology" onClick={close}><span>Ontology</span><span aria-hidden="true">›</span></a></li>
                </ul>
              ),
            },
            { id: 'about', label: 'About and privacy', panel: <div id="set-about"><AboutSection /></div> },
            { id: 'danger', label: 'Danger zone', panel: <div id="set-danger"><DangerSection /></div> },
          ]}
        />
      }
    />
  )
}
