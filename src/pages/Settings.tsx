import { PageHeader } from '../components/ui'
import { AboutSection, BackupSection, DangerSection, ProfileSection, StorageSection } from '../features/settings/Sections'
import '../features/settings/settings.css'

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" sub="Profile, backups and storage. Everything here stays on this device." />
      <div className="set-page">
        <ProfileSection />
        <BackupSection />
        <StorageSection />
        <AboutSection />
        <DangerSection />
      </div>
    </>
  )
}
