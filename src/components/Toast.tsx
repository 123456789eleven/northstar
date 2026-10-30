// ToastProvider: one toast at a time, role="status". 4s default, 8s when it carries Undo. Use via useToast() from toastContext.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastOpts } from './toastContext'

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastOpts | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((o: ToastOpts) => {
    window.clearTimeout(timer.current)
    setT(o)
    timer.current = window.setTimeout(() => setT(null), o.ms ?? (o.undo ? 8000 : 4000))
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {t && (
          <div className="toast">
            <span>{t.message}</span>
            {t.undo && (
              <button className="btn btn-ghost btn-sm" onClick={() => { void t.undo?.(); window.clearTimeout(timer.current); setT(null) }}>Undo</button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
