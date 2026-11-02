// ToastProvider: one toast at a time, role="status". 4s default, 8s when it carries Undo. Use via useToast() from toastContext.
// Slides up on enter, fades on exit; a new toast replaces the current one immediately. Undo is the one accent-colored action.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastOpts } from './toastContext'
import { DUR, prefersReducedMotion } from './motion'

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<(ToastOpts & { id: number }) | null>(null)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const seq = useRef(0)
  const clear = () => window.clearTimeout(timer.current)
  const dismiss = useCallback(() => {
    clear()
    if (prefersReducedMotion()) { setT(null); return }
    setLeaving(true)
    timer.current = window.setTimeout(() => { setT(null); setLeaving(false) }, DUR.fast)
  }, [])
  const show = useCallback((o: ToastOpts) => {
    clear()
    setLeaving(false)
    setT({ ...o, id: ++seq.current })
    timer.current = window.setTimeout(dismiss, o.ms ?? (o.undo || o.action ? 8000 : 4000))
  }, [dismiss])
  useEffect(() => () => clear(), [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {t && (
          <div key={t.id} className={`toast ${leaving ? 'is-leaving' : ''}`}>
            <span className="toast-msg">{t.message}</span>
            {t.action && (
              <button className="btn btn-ghost btn-sm toast-act" onClick={() => { void t.action?.run(); clear(); setT(null); setLeaving(false) }}>{t.action.label}</button>
            )}
            {t.undo && (
              <button className="btn btn-ghost btn-sm" onClick={() => { void t.undo?.(); clear(); setT(null); setLeaving(false) }}>Undo</button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
