// Shared UI primitives. Modules should compose these + the classes in index.css rather than invent new chrome.
// Here: PageHeader{title,sub,actions,tabs?} Card{title,action,sub?,flush?,interactive?} Stat CountUp Progress{value,label,tone?}
// Empty{title?,action?} Modal Field{label,hint?,error?} Tabs Skeleton{lines?|rows?} PageSkeleton.
// Sibling components (default exports): KpiStrip{items}, DataTable{columns,rows,rowKey,selectable,selected,onSelectedChange,onRow,activeKey,loading?},
// ListRow{leading,title,meta,trailing,onClick,selected}, SidePanel{title,onClose,inline?}, BottomSheet{title,onClose,side?},
// StatusChip{status,children}, ChartFrame{title,controls,legend,hasData,table,sub?} (+ chartTheme.tsx), ToastProvider + useToast() (toastContext.ts).
// Motion: tokens --dur-fast/base/slow + --ease-out; helpers in motion.ts. Animate transform/opacity only; reduced motion is honoured.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useFocusTrap } from './useFocusTrap'
import { formatNumeric, parseNumeric, prefersReducedMotion, useExit } from './motion'

export function PageHeader({ title, sub, actions, tabs }: { title: string; sub?: ReactNode; actions?: ReactNode; tabs?: ReactNode }) {
  return (
    <>
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
    {tabs}
    </>
  )
}

export function Card({ title, action, sub, children, className = '', flush = false, interactive = false }: { title?: ReactNode; action?: ReactNode; sub?: ReactNode; children: ReactNode; className?: string; flush?: boolean; interactive?: boolean }) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''} ${interactive ? 'card-interactive' : ''} ${className}`}>
      {(title || action) && (
        <div className="card-title">
          <span>{title}</span>
          {action}
        </div>
      )}
      {sub && <div className="card-sub">{sub}</div>}
      {children}
    </section>
  )
}

const COUNT_MS = 520
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Animates a plain number or a string with exactly one number in it ("$1,234.50", "62%", "1,620 cal") from 0 the first
 * time it appears (on mount or once data arrives within ~1.5s). The final text reserves the space underneath, so the
 * figure never shifts layout. Anything else (ReactNodes, "1h 10m", "—") renders as-is. Reduced motion: no animation.
 */
export function CountUp({ value }: { value: ReactNode }) {
  const runRef = useRef<HTMLSpanElement>(null)
  const born = useRef(typeof performance !== 'undefined' ? performance.now() : 0)
  const played = useRef(false)
  const [counting, setCounting] = useState(false)
  const parsed = parseNumeric(value)
  const target = parsed?.n ?? 0
  const key = parsed ? `${parsed.prefix}|${parsed.suffix}|${target}` : ''

  useEffect(() => {
    if (played.current || !parsed || target === 0) return
    played.current = true
    if (prefersReducedMotion() || performance.now() - born.current > 1500) return
    setCounting(true)
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS)
      if (runRef.current) runRef.current.textContent = formatNumeric(parsed, target * easeOut(t))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setCounting(false)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setCounting(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every input that matters
  }, [key])

  if (!parsed) return <>{value}</>
  return (
    <span className={`countup ${counting ? 'is-counting' : ''}`}>
      <span className="countup-final">{value}</span>
      {counting && <span className="countup-run" ref={runRef} aria-hidden>{formatNumeric(parsed, 0)}</span>}
    </span>
  )
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value"><CountUp value={value} /></div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

/** Fill slides in from 0 on mount and glides on change (transform only). tone: warn = over a limit, muted = paused/neutral. */
export function Progress({ value, label = 'Progress', tone }: { value: number; label?: string; tone?: 'warn' | 'muted' }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(v))
    return () => cancelAnimationFrame(id)
  }, [v])
  return (
    <div className={`progress ${tone ? `progress-${tone}` : ''}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ '--p': shown } as CSSProperties} />
    </div>
  )
}

/** Empty state: what is here (title), what to do first (children), and the action that does it. */
export function Empty({ children, title, action }: { children?: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {title && <div className="empty-title">{title}</div>}
      {children && <div className="empty-body">{children}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [closing, requestClose] = useExit(onClose)
  useFocusTrap(ref, requestClose)
  return (
    <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: ReactNode; error?: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const labels = options.map((o) => o.label).join('|')
  // Keep the active tab in view on a narrow strip; the next tab peeks in as the scroll cue.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.tab.active')
    const box = ref.current
    if (!el || !box || box.scrollWidth <= box.clientWidth) return
    box.scrollLeft += el.getBoundingClientRect().left - box.getBoundingClientRect().left - 24
  }, [value])
  // Sliding indicator: measure the active tab, move one bar with transform. Re-measure when fonts or labels change size.
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const place = () => {
      const el = box.querySelector<HTMLElement>('.tab.active')
      if (!el) return
      box.style.setProperty('--tab-x', `${el.offsetLeft}px`)
      box.style.setProperty('--tab-w', String(el.offsetWidth / 100))
    }
    place()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(place)
    box.querySelectorAll('.tab').forEach((t) => ro.observe(t))
    return () => ro.disconnect()
  }, [value, labels])
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div className={`tabs has-ind ${ready ? 'ind-ready' : ''}`} role="tablist" ref={ref}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`tab ${o.value === value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
      <span className="tabs-ind" aria-hidden />
    </div>
  )
}

const ROW_W = [68, 52, 74, 44, 60, 56]

/** Neutral loading placeholder for useLiveQuery's first paint. `rows` mimics list rows; otherwise text lines. */
export function Skeleton({ lines = 3, rows, label = 'Loading' }: { lines?: number; rows?: number; label?: string }) {
  if (rows) {
    return (
      <div className="skel-rows skel-pulse" role="status" aria-label={label}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skel-row">
            <span className="skel-dot" />
            <span className="skel-line" style={{ '--w': `${ROW_W[i % ROW_W.length]}%` } as CSSProperties} />
            <span className="skel-line" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="skel-pulse" role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skel-line" style={{ width: i === lines - 1 && lines > 1 ? '45%' : `${ROW_W[i % ROW_W.length] + 20}%` }} />
      ))}
    </div>
  )
}

/** Whole-page first paint: KPI strip + main block shapes, matching the real layout so nothing jumps when data lands. */
export function PageSkeleton({ strip = true, rows = 6 }: { strip?: boolean; rows?: number }) {
  return (
    <div className="page-skel" aria-busy="true">
      {strip && <div className="skel skel-strip" />}
      <section className="card"><Skeleton rows={rows} /></section>
    </div>
  )
}

// Re-exported so existing imports keep working; new code may import from './uiConsts'.
export { AREA_LABEL } from './uiConsts'
