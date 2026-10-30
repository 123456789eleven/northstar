import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card } from '../../components/ui'
import { demoCounts, removeDemo } from '../../lib/demo'
import { loadDemoWithConfirm } from './demoActions'

export function DemoCard() {
  const info = useLiveQuery(async () => ({ v: await demoCounts() }), [])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (!info) return null
  const loaded = info.v

  async function run(fn: () => Promise<string>) {
    setBusy(true)
    try { setMsg(await fn()) } finally { setBusy(false) }
  }

  return (
    <Card title="Demo data">
      <div className="row-between wrap">
        <p className="set-text" style={{ margin: 0 }}>
          {loaded ? `Sample data is loaded (${loaded.rows.toLocaleString()} rows). Removing it deletes only those rows.` : 'Fill the app with a fictional three months so you can see how it works. Removable at any time.'}
        </p>
        {loaded ? (
          <button className="btn" disabled={busy} onClick={() => void run(async () => `Removed ${await removeDemo()} rows.`)}>Remove demo data</button>
        ) : (
          <button className="btn" disabled={busy} onClick={() => void run(async () => ((await loadDemoWithConfirm()) === 'loaded' ? 'Demo data loaded.' : ''))}>Load demo data</button>
        )}
      </div>
      <p className="set-text tiny faint" style={{ marginTop: 8 }}>Demo data stays on this device and never syncs, even if sync is on.</p>
      {msg && <p className="set-ok" role="status">{msg}</p>}
    </Card>
  )
}
