// Shared UI primitives. Modules should compose these + the classes in index.css rather than invent new chrome.
// Here: PageHeader{title,sub,actions,tabs?} Card{title,action,sub?,flush?,interactive?} Stat CountUp Progress{value,label,tone?}
// Empty{title?,action?} Modal Field{label,hint?,error?} Tabs Skeleton{lines?|rows?} PageSkeleton.
// Sibling components (default exports): KpiStrip{items}, DataTable{columns,rows,rowKey,selectable,selected,onSelectedChange,onRow,activeKey,loading?},
// ListRow{leading,title,meta,trailing,onClick,selected}, SidePanel{title,onClose,inline?}, BottomSheet{title,onClose,side?},
// StatusChip{status,children}, ChartFrame{title,controls,legend,hasData,table,sub?} (+ chartTheme.tsx), ToastProvider + useToast() (toastContext.ts).
// Motion: tokens --dur-fast/base/slow + --ease-out; helpers in motion.ts. Animate transform/opacity only; reduced motion is honoured.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useFocusTrap } from './useFocusTrap'
import { useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icons'
import ModuleTile from './ModuleTile'
import { moduleForPath } from './moduleHue'
import { formatDelta, trendAria, trendDirection, trendTone, type Trend } from './trend'
import { formatNumeric, parseNumeric, prefersReducedMotion, useExit } from './motion'
import { addSystem, Spring, SPRINGS, touch, type SpringSystem } from '../lib/spring'

/** Page title row. The module's gradient tile (Aurora) comes from the route; pass icon={false} to omit it. */
export function PageHeader({ title, sub, actions, tabs, icon }: { title: string; sub?: ReactNode; actions?: ReactNode; tabs?: ReactNode; icon?: IconName | false }) {
  const { pathname } = useLocation()
  const mod = icon === false ? undefined : (icon ?? moduleForPath(pathname))
  return (
    <>
    <div className="page-head">
      <div className="page-head-main">
        {mod && <ModuleTile icon={mod} />}
        <div className="page-head-text">
          <h1 className="page-title">{title}</h1>
          {sub && <div className="page-sub">{sub}</div>}
        </div>
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

/** Inline movement indicator: arrow + signed delta + optional label. Arrow shape and sign carry the meaning; color only reinforces it. */
export function TrendLine({ trend }: { trend: Trend }) {
  const unit = trend.unit ?? '%'
  const dir = trendDirection(trend.delta, unit)
  const text = formatDelta(trend.delta, unit)
  if (!text) return null
  return (
    <div className={`trend trend-${trendTone(dir, trend.goodDirection)}`}>
      <span className="trend-fig" aria-hidden>
        <Icon name={dir === 'up' ? 'arrowUp' : dir === 'down' ? 'arrowDown' : 'flat'} size={12} />
        <span className="trend-num">{text}</span>
      </span>
      {trend.label && <span className="trend-label" aria-hidden>{trend.label}</span>}
      <span className="sr-only">{trendAria(trend)}</span>
    </div>
  )
}

/** Stat card. icon: a module IconName renders that module's gradient tile (moduleHue.ts); any other node sits in a violet tile. trend: optional movement line. onClick/href make it interactive (lift on hover, focus ring). */
export function Stat({ label, value, note, icon, trend, onClick, href }: { label: string; value: ReactNode; note?: ReactNode; icon?: ReactNode; trend?: Trend; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <div className="stat-main">
        <div className="stat-label">{label}</div>
        <div className="stat-value"><CountUp value={value} /></div>
        {trend && <TrendLine trend={trend} />}
        {note && <div className="stat-note">{note}</div>}
      </div>
      {typeof icon === 'string' ? <ModuleTile icon={icon as IconName} /> : icon && <span className="stat-icon tile hue-violet" aria-hidden>{icon}</span>}
    </>
  )
  if (href) return <a className="card stat stat-int" href={href}>{body}</a>
  if (onClick) return <button type="button" className="card stat stat-int" onClick={onClick}>{body}</button>
  return <div className="card stat">{body}</div>
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
export function Empty({ children, title, action, icon }: { children?: ReactNode; title?: ReactNode; action?: ReactNode; icon?: IconName | false }) {
  // A titled empty state carries the current module's tile (Aurora); untitled one-liners stay plain.
  const { pathname } = useLocation()
  const mod = title && icon !== false ? (icon ?? moduleForPath(pathname)) : undefined
  return (
    <div className={`empty ${mod ? 'empty-has-tile' : ''}`}>
      {mod && <ModuleTile icon={mod} quiet />}
      <div className="empty-main">
        {title && <div className="empty-title">{title}</div>}
        {children && <div className="empty-body">{children}</div>}
        {action && <div className="empty-action">{action}</div>}
      </div>
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [closing, requestClose] = useExit(onClose)
  useFocusTrap(ref, requestClose)
  return (
    <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
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

/** Segmented tabs with the liquid thumb: one pill moved on the snappy spring, stretched by its velocity (scale(1+s, 1-.45s),
 *  s <= .18) and settling with a small overshoot. Reduced motion: the thumb jumps. Selection is also ink colour + weight. */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const sp = useRef<{ x: Spring; w: Spring; sq: Spring; sys: SpringSystem; placed: boolean } | null>(null)
  const labels = options.map((o) => o.label).join('|')
  // Keep the active tab in view on a narrow strip; the next tab peeks in as the scroll cue.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.tab.active')
    const box = ref.current
    if (!el || !box || box.scrollWidth <= box.clientWidth) return
    box.scrollLeft += el.getBoundingClientRect().left - box.getBoundingClientRect().left - 24
  }, [value])
  // One spring system per strip: x and width on snappy, the squash on its own underdamped spring (a layout effect, so it exists
  // before the placement effect below runs on mount).
  useLayoutEffect(() => {
    const x = new Spring(0, SPRINGS.snappy, 0.05), w = new Spring(0, SPRINGS.snappy, 0.05), sq = new Spring(0, SQUASH, 0.0005)
    const sys: SpringSystem = {
      springs: [x, w, sq],
      render: () => {
        const t = thumb.current
        if (!t || w.t <= 0) return
        const s = Math.max(-0.06, Math.min(0.18, sq.x))
        const fx = (w.x / w.t) * (1 + s)
        t.style.transform = `translate3d(${(x.x + w.x / 2 - w.t / 2).toFixed(2)}px,0,0) scale(${fx.toFixed(4)},${(1 - 0.45 * s).toFixed(4)})`
      },
    }
    sp.current = { x, w, sq, sys, placed: false }
    const off = addSystem(sys)
    return () => { off(); sp.current = null }
  }, [])
  // Measure the active tab and send the thumb there. Re-measure when fonts or labels change size.
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const place = () => {
      const el = box.querySelector<HTMLElement>('.tab.active'), s = sp.current, t = thumb.current
      if (!el || !s || !t) return
      const left = el.offsetLeft, width = el.offsetWidth
      if (left === s.x.t && width === s.w.t && s.placed) return
      t.style.width = `${width}px`
      if (!s.placed) { s.x.snap(left); s.w.snap(width); s.placed = true; touch(s.sys); return }
      const dist = Math.abs(left - s.x.x) / Math.max(1, width)
      s.x.to(left, SPRINGS.snappy); s.w.to(width, SPRINGS.snappy)
      s.sq.v += Math.min(1.6, dist * 0.9); s.sq.to(0, SQUASH)
      touch(s.sys)
    }
    place()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(place)
    box.querySelectorAll('.tab').forEach((t) => ro.observe(t))
    return () => ro.disconnect()
  }, [value, labels])
  return (
    <div className="tabs has-ind" role="tablist" ref={ref}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`tab ${o.value === value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
      <span className="tabs-ind" aria-hidden ref={thumb} />
    </div>
  )
}
const SQUASH = { k: 500, z: 0.55 }

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
