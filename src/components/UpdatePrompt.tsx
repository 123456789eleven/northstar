// Small non-modal toast shown when a new service worker is waiting. Never reloads on its own.
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="toast-host update-host" role="status" aria-live="polite">
      <div className="toast">
        <span>Update ready - reload</span>
        <button className="btn btn-primary btn-sm" onClick={() => void updateServiceWorker(true)}>Reload</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>Later</button>
      </div>
    </div>
  )
}
