// Deep links from the Ctrl+K palette: `#/tasks?focus=<id>`. The destination page calls useFocusTarget once its data is loaded;
// the hook reveals the record, scrolls it into view, flashes a ring for 2s and clears `focus` (history entry replaced, so Back
// returns to the previous page with no stale highlight). A record that no longer exists gets a toast and nothing else.
import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../components/toastContext'
import './focusFlash.css'

export const FOCUS_PARAM = 'focus'
export const FLASH_MS = 2000
const WAIT_MS = 1500

/** The `focus` value of a query string, or null. Pure. */
export function readFocus(search: string | URLSearchParams): string | null {
  const v = (typeof search === 'string' ? new URLSearchParams(search) : search).get(FOCUS_PARAM)
  return v && v.trim() ? v : null
}

/** `focus` plus a `clear()` that removes it (and any `alsoClear` keys) from the URL without adding a history entry. */
export function useFocusParam(): { focus: string | null; clear: (...alsoClear: string[]) => void } {
  const [params, setParams] = useSearchParams()
  const focus = readFocus(params)
  const clear = useCallback((...alsoClear: string[]) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete(FOCUS_PARAM)
      for (const k of alsoClear) next.delete(k)
      return next
    }, { replace: true })
  }, [setParams])
  return { focus, clear }
}

/** Scroll the visible `[data-focus-id]` element into view and ring it for 2s. Waits briefly for it to render. Returns a cancel fn. */
export function flashFocus(id: string): () => void {
  let raf = 0
  let timer = 0
  let el: Element | null = null
  const started = performance.now()
  const safe = id.replace(/[^\w.:-]/g, (c) => '\\' + c)
  const sel = '[data-focus-id="' + safe + '"]'
  const find = () => Array.from(document.querySelectorAll(sel)).find((e) => e.getClientRects().length > 0) ?? null
  const tick = () => {
    el = find()
    if (!el) {
      if (performance.now() - started < WAIT_MS) raf = requestAnimationFrame(tick)
      return
    }
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    el.classList.remove('focus-flash')
    void (el as HTMLElement).offsetWidth // restart the animation if the same element is flashed twice
    el.classList.add('focus-flash')
    timer = window.setTimeout(() => el?.classList.remove('focus-flash'), FLASH_MS)
  }
  raf = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(raf)
    window.clearTimeout(timer)
    el?.classList.remove('focus-flash')
  }
}

/**
 * Consume `?focus=` once `ready` (the page's data has loaded). `exists` says whether the record is still there;
 * `reveal` opens whatever is needed (detail panel, tab, filter) before the flash. `alsoClear` are extra params to drop.
 */
export function useFocusTarget({ ready, exists, reveal, alsoClear = [] }: {
  ready: boolean
  exists: (id: string) => boolean
  reveal?: (id: string) => void
  alsoClear?: string[]
}) {
  const { focus, clear } = useFocusParam()
  const toast = useToast()
  const handled = useRef<string | null>(null)
  const cancel = useRef<() => void>(() => {})
  useEffect(() => {
    if (!focus) { handled.current = null; return }
    if (!ready || handled.current === focus) return
    handled.current = focus
    if (!exists(focus)) {
      toast({ message: 'That one has gone. Deleted or moved, either way it is not here anymore.' })
      clear(...alsoClear)
      return
    }
    reveal?.(focus)
    clear(...alsoClear)
    cancel.current()
    cancel.current = flashFocus(focus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, ready])
  useEffect(() => () => cancel.current(), [])
}
