import { useEffect, useRef, useState } from 'react'

export interface MenuItem { label: string; onSelect: () => void; disabled?: boolean }

/** Overflow menu for a row's secondary actions. Closes on Esc, outside click or selection. */
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="row-menu" ref={box}>
      <button className="icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
      </button>
      {open && (
        <div className="row-menu-pop" role="menu">
          {items.map((it) => (
            <button key={it.label} role="menuitem" className="row-menu-item" disabled={it.disabled} onClick={() => { setOpen(false); it.onSelect() }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
