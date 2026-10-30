// Shared UI primitives. Modules should compose these + the classes in index.css rather than invent new chrome.
// Here: PageHeader{title,sub,actions,tabs?} Card{title,action,flush?} Stat Progress Empty Modal Field Tabs.
// Sibling components (default exports): KpiStrip{items}, DataTable{columns,rows,rowKey,selectable,selected,onSelectedChange,onRow,activeKey},
// ListRow{leading,title,meta,trailing,onClick,selected}, SidePanel{title,onClose,inline?}, BottomSheet{title,onClose,side?},
// StatusChip{status,children}, ChartFrame{title,controls,legend,hasData,table}, ToastProvider + useToast() (toastContext.ts).
import { useEffect, useRef, type ReactNode } from 'react'
import { useFocusTrap } from './useFocusTrap'

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

export function Card({ title, action, children, className = '', flush = false }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''} ${className}`}>
      {(title || action) && (
        <div className="card-title">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

export function Progress({ value, label = 'Progress' }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${v}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, onClose)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the active tab in view on a narrow strip; the next tab peeks in as the scroll cue.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.tab.active')
    const box = ref.current
    if (!el || !box || box.scrollWidth <= box.clientWidth) return
    box.scrollLeft += el.getBoundingClientRect().left - box.getBoundingClientRect().left - 24
  }, [value])
  return (
    <div className="tabs" role="tablist" ref={ref}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`tab ${o.value === value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Re-exported so existing imports keep working; new code may import from './uiConsts'.
export { AREA_LABEL } from './uiConsts'
