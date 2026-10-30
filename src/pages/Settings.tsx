import { PageHeader } from '../components/ui'
import { AboutSection, BackupSection, DangerSection, ProfileSection, StorageSection } from '../features/settings/Sections'
import { SyncSection } from '../features/settings/SyncSection'
import '../features/settings/settings.css'

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" sub="Profile, backups, sync and storage." />
      <div className="set-page">
        <ProfileSection />
        <BackupSection />
        <SyncSection />
        <StorageSection />
        <AboutSection />
        <DangerSection />
      </div>
    </>
  )
}
