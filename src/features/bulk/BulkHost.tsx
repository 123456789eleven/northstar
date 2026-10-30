// Mounted once in the top bar. Opens "Add many" on the window event 'northstar:open-bulk' (detail: { kind? }).
import { lazy, Suspense, useEffect, useState } from 'react'
import type { BulkKind } from './parse'
import { OPEN_BULK } from './openBulk'

const BulkAdd = lazy(() => import('./BulkAdd'))
export default function BulkHost() {
  const [open, setOpen] = useState<{ kind: BulkKind } | null>(null)
  useEffect(() => {
    const on = (e: Event) => setOpen({ kind: (e as CustomEvent<{ kind?: BulkKind }>).detail?.kind ?? 'tasks' })
    window.addEventListener(OPEN_BULK, on)
    return () => window.removeEventListener(OPEN_BULK, on)
  }, [])
  if (!open) return null
  return <Suspense fallback={null}><BulkAdd initialKind={open.kind} onClose={() => setOpen(null)} /></Suspense>
}
