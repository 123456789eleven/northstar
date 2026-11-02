import { useEffect, useRef, useState, type RefObject } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Minimal shape of an element for the restore decision (keeps the logic testable without a DOM). */
export interface FocusTarget { focus?: (opts?: { preventScroll?: boolean }) => void; isConnected?: boolean }

/**
 * Where focus goes when an overlay closes: the element that had focus when the overlay first rendered (the opener),
 * if it is still in the document. Captured during the first render, before any child `autoFocus` runs; capturing in an
 * effect was too late (React focuses autoFocus children at commit, so the opener looked like it was inside the dialog).
 */
export function restoreTarget(opener: FocusTarget | null, bodyEl: unknown): FocusTarget | null {
  if (!opener || opener === bodyEl || typeof opener.focus !== 'function') return null
  if (opener.isConnected === false) return null
  return opener
}

/** Traps Tab inside `ref`, closes on Esc, focuses the first control, and restores focus to the opener on unmount. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  // Lazy initial state runs once, during the first render: the opener still has focus at this point.
  const [opener] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)))
  useEffect(() => {
    const node = ref.current
    const first = node?.querySelector<HTMLElement>(FOCUSABLE)
    if (!node?.contains(document.activeElement)) (first ?? node)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) { e.preventDefault(); return }
      const a = items[0]
      const z = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      // Only restore when focus is still inside the closing overlay (or lost to <body>): never steal it from wherever
      // the close action deliberately sent it (e.g. palette "New task" focusing the capture bar).
      const active = document.activeElement
      const lost = !active || active === document.body || (node?.contains(active) ?? false)
      const target = restoreTarget(opener, document.body)
      if (lost && target) target.focus?.({ preventScroll: true })
    }
  }, [ref, opener])
}
