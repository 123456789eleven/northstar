import { PageHeader } from '../components/ui'
import { AboutSection, BackupSection, DangerSection, ProfileSection, StorageSection } from '../features/settings/Sections'
import { DemoCard } from '../features/onboarding/DemoCard'
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
        <DemoCard />
        <StorageSection />
        <AboutSection />
        <DangerSection />
      </div>
    </>
  )
}
