// Specular highlight: one passive listener moves --mx/--my on the [data-spec] element under a fine pointer. No-op on touch devices,
// for reduced motion, and when nothing opted in. (Device-tilt highlight on phones is deliberately not used: iOS gates it behind a prompt.)
export function installSpecular(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return () => {}
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  let raf = 0
  const on = (e: PointerEvent) => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const el = (e.target as Element | null)?.closest?.('[data-spec]') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    })
  }
  document.addEventListener('pointermove', on, { passive: true })
  return () => { document.removeEventListener('pointermove', on); cancelAnimationFrame(raf) }
}
