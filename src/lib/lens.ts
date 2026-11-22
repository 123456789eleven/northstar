// Liquid lens: real edge refraction for at most three chrome elements (docs/redesign/LIQUID_V2.md, "Where the lens goes").
// Chromium only: `backdrop-filter: url(#f)` with ONE SVG filter per element, its displacement map rendered from a rounded-rect SDF
// (makeMap) and its rim light rendered as an image (makeRim), both ported from the council prototype (council/glass.html).
// Everywhere else (Firefox, Safari, every iPhone browser and the installed PWA), and for reduced transparency, .lens is plain
// blur + --lg-body + --lg-depth from liquid.css and this module does nothing.
//
// Two Chromium traps, both load-bearing:
//   1. no x / y / width / height / filterUnits on the <filter>: an explicit region breaks backdrop sampling;
//   2. no mix-blend-mode on any descendant of a lens element (it silently disables the backdrop-filter; liquid.css guards it).
//
// Use: add class `lens` and call useLens(ref, 'tabbar' | 'sheet' | 'toast' | 'button'), or registerLens(el, preset) by hand.
// Only the district strip / tab bar, the one open sheet, toasts / popovers and the floating capture button may use it. Never on
// cards or anything that scrolls. The registry refuses a 4th element (it still gets the fallback glass).
import { useEffect, type RefObject } from 'react'

export type LensPreset = { bevel: number; scale: number; blur: number; disp: boolean; mag: number }
export type LensPresetName = 'tabbar' | 'sheet' | 'toast' | 'button'

/** bevel = px of edge that bends, scale = displacement strength, blur = stdDeviation, disp = 3-channel dispersion, mag = body magnify. */
export const LENS_PRESETS: Record<LensPresetName, LensPreset> = {
  tabbar: { bevel: 26, scale: 80, blur: 6, disp: true, mag: 0 },
  sheet: { bevel: 40, scale: 110, blur: 7, disp: true, mag: 0 },
  toast: { bevel: 24, scale: 70, blur: 5, disp: true, mag: 0 },
  button: { bevel: 30, scale: 60, blur: 1, disp: true, mag: 0.18 },
}
export const MAX_LENSES = 3
/** Light direction for the rim (one source, top-left). */
const LIGHT = { x: -0.55, y: -0.83 }
const NS = 'http://www.w3.org/2000/svg'

// ---------- pure geometry (tested) ----------

/** Signed distance to a w x h rounded rect of radius r (negative inside), and its outward normal. */
export function sdf(px: number, py: number, w: number, h: number, r: number) {
  const qx = Math.abs(px - w / 2) - (w / 2 - r), qy = Math.abs(py - h / 2) - (h / 2 - r)
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0)
  const d = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
  let nx: number, ny: number
  if (qx > 0 && qy > 0) { const l = Math.hypot(ox, oy) || 1; nx = ox / l; ny = oy / l }
  else if (qx > qy) { nx = 1; ny = 0 } else { nx = 0; ny = 1 }
  return { d, nx: nx * Math.sign(px - w / 2 || 1), ny: ny * Math.sign(py - h / 2 || 1) }
}
/** Convex bevel profile: steep at the rim, flat by t = 1. */
const slope = (t: number) => Math.pow(1 - t, 2.4)

/** Displacement map pixels (RGBA): R/G = 128 +/- the inward offset (1 = full scale); the edge compresses the backdrop. */
export function mapPixels(w: number, h: number, r: number, bevel: number, mag: number): Uint8ClampedArray {
  const D = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const { d, nx, ny } = sdf(x + 0.5, y + 0.5, w, h, r), t = Math.min(1, Math.max(0, -d / bevel))
    let dx = 0, dy = 0
    if (-d >= 0 && t < 1) { const s = slope(t); dx = -nx * s; dy = -ny * s }
    if (mag) { dx -= ((x - w / 2) / (w / 2)) * mag; dy -= ((y - h / 2) / (h / 2)) * mag }
    const i = (y * w + x) * 4
    D[i] = 128 + Math.max(-1, Math.min(1, dx)) * 127; D[i + 1] = 128 + Math.max(-1, Math.min(1, dy)) * 127; D[i + 2] = 128; D[i + 3] = 255
  }
  return D
}
/** Rim light pixels (RGBA): the bevel lit from (lx, ly); brightest on the light-facing rim, a faint return opposite. Rendered, not stroked. */
export function rimPixels(w: number, h: number, r: number, bevel: number, lx: number, ly: number): Uint8ClampedArray {
  const D = new Uint8ClampedArray(w * h * 4)
  const b = Math.min(bevel * 0.45, 12)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const { d, nx, ny } = sdf(x + 0.5, y + 0.5, w, h, r)
    if (d > 0) continue
    const t = -d / b
    if (t >= 1) continue
    const ndl = nx * lx + ny * ly
    const face = Math.max(0, ndl) ** 1.5 * 0.55 + Math.max(0, -ndl) ** 2 * 0.22
    const i = (y * w + x) * 4
    D[i] = 235; D[i + 1] = 244; D[i + 2] = 255; D[i + 3] = face * Math.pow(1 - t, 3) * 255
  }
  return D
}
function toDataUrl(w: number, h: number, px: Uint8ClampedArray): string {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(w, h)
  img.data.set(px)
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}
export const makeMap = (w: number, h: number, r: number, bevel: number, mag: number) => toDataUrl(w, h, mapPixels(w, h, r, bevel, mag))
export const makeRim = (w: number, h: number, r: number, bevel: number, lx = LIGHT.x, ly = LIGHT.y) => toDataUrl(w, h, rimPixels(w, h, r, bevel, lx, ly))

/** The filter body for one element (no region attributes on the <filter>: see trap 1). */
export function filterMarkup(map: string, w: number, h: number, p: LensPreset, disp: boolean): string {
  const ch = (k: 'r' | 'g' | 'b') =>
    `<feColorMatrix in="d${k}" type="matrix" values="${k === 'r' ? '1 0 0 0 0' : '0 0 0 0 0'} ${k === 'g' ? '0 1 0 0 0' : '0 0 0 0 0'} ${k === 'b' ? '0 0 1 0 0' : '0 0 0 0 0'} 0 0 0 1 0" result="c${k}"/>`
  const s = p.scale
  return (
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${p.blur}" result="bl"/>` +
    `<feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>` +
    (disp
      ? `<feDisplacementMap in="bl" in2="map" scale="${s}" xChannelSelector="R" yChannelSelector="G" result="dr"/>` +
        `<feDisplacementMap in="bl" in2="map" scale="${s * 0.9}" xChannelSelector="R" yChannelSelector="G" result="dg"/>` +
        `<feDisplacementMap in="bl" in2="map" scale="${s * 0.8}" xChannelSelector="R" yChannelSelector="G" result="db"/>` +
        ch('r') + ch('g') + ch('b') +
        `<feComposite in="cr" in2="cg" operator="arithmetic" k2="1" k3="1" result="rg"/>` +
        `<feComposite in="rg" in2="cb" operator="arithmetic" k2="1" k3="1" result="out"/>`
      : `<feDisplacementMap in="bl" in2="map" scale="${s}" xChannelSelector="R" yChannelSelector="G" result="out"/>`) +
    `<feColorMatrix in="out" type="saturate" values="1.5"/>`
  )
}

// ---------- feature detection ----------

/** Chromium, not reduced transparency. GlassDefs mirrors this as html[data-lens] for the CSS. */
export function lensSupported(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }
  const chromium = !!nav.userAgentData?.brands?.some((b) => b.brand === 'Chromium')
  const reduced = !!window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches
  return chromium && !reduced
}
/** Dispersion (three displacement passes) is dropped on low-memory devices. */
export function dispersionAllowed(): boolean {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return !(typeof mem === 'number' && mem <= 4)
}

// ---------- registry: one filter per element, at most three at once ----------

type Entry = { id: string; preset: LensPreset; ro: ResizeObserver | null; raf: number; key: string }
const active = new Map<HTMLElement, Entry>()
let seq = 0

function defsEl(): SVGDefsElement {
  let defs = document.getElementById('ns-lens-defs') as SVGDefsElement | null
  if (defs) return defs
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false')
  svg.style.position = 'absolute'; svg.style.pointerEvents = 'none'
  defs = document.createElementNS(NS, 'defs') as SVGDefsElement
  defs.id = 'ns-lens-defs'
  svg.appendChild(defs)
  document.body.appendChild(svg)
  return defs
}

function build(el: HTMLElement, e: Entry) {
  const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight)
  if (w < 4 || h < 4) return
  const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2)
  const key = `${w}x${h}r${r}`
  if (key === e.key) return
  e.key = key
  const disp = e.preset.disp && dispersionAllowed()
  const defs = defsEl()
  document.getElementById(e.id)?.remove()
  const f = document.createElementNS(NS, 'filter')
  f.setAttribute('id', e.id)
  f.setAttribute('color-interpolation-filters', 'sRGB')
  f.innerHTML = filterMarkup(makeMap(w, h, r, e.preset.bevel, e.preset.mag), w, h, e.preset, disp)
  defs.appendChild(f)
  el.style.setProperty('--lens-filter', `url(#${e.id}) brightness(1.04)`)
  el.style.setProperty('--lens-rim', `url(${makeRim(w, h, r, e.preset.bevel)})`)
  el.setAttribute('data-lens-on', '')
}

/**
 * Turn el into a lens. Returns the unregister function. Refuses (returns a no-op) off Chromium, for reduced transparency,
 * and when three lenses are already active; the element then keeps the fallback glass from `.lens`.
 */
export function registerLens(el: HTMLElement, preset: LensPresetName | LensPreset = 'toast'): () => void {
  el.classList.add('lens')
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
  if (!lensSupported() || active.has(el)) return () => {}
  if (active.size >= MAX_LENSES) { el.setAttribute('data-lens-refused', ''); return () => el.removeAttribute('data-lens-refused') }
  const p = typeof preset === 'string' ? LENS_PRESETS[preset] : preset
  el.dataset.bevel = String(p.bevel); el.dataset.scale = String(p.scale); el.dataset.blur = String(p.blur)
  const e: Entry = { id: `ns-lens-${++seq}`, preset: p, ro: null, raf: 0, key: '' }
  active.set(el, e)
  build(el, e)
  if (typeof ResizeObserver !== 'undefined') {
    e.ro = new ResizeObserver(() => { cancelAnimationFrame(e.raf); e.raf = requestAnimationFrame(() => build(el, e)) })
    e.ro.observe(el)
  }
  return () => {
    e.ro?.disconnect(); cancelAnimationFrame(e.raf)
    document.getElementById(e.id)?.remove()
    el.style.removeProperty('--lens-filter'); el.style.removeProperty('--lens-rim'); el.removeAttribute('data-lens-on')
    active.delete(el)
  }
}

/** Number of lens elements alive now (for tests and the budget check). */
export const activeLensCount = () => active.size

/** React helper: `const ref = useRef<HTMLDivElement>(null); useLens(ref, 'sheet')`. The element also needs nothing else. */
export function useLens(ref: RefObject<HTMLElement | null>, preset: LensPresetName | LensPreset = 'toast', enabled = true) {
  // keyed by value, not identity: an inline preset object would otherwise rebuild the filter on every render
  const key = typeof preset === 'string' ? preset : JSON.stringify(preset)
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    return registerLens(el, typeof preset === 'string' ? preset : (JSON.parse(key) as LensPreset))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` carries the preset
  }, [ref, enabled, key])
}

/** Props for an element that wants the lens without a ref: spread `{...lensProps('toast')}`; GlassDefs auto-registers it. */
export const lensProps = (preset: LensPresetName) => ({ className: 'lens', 'data-lens-preset': preset })

/** Auto-registration for `.lens[data-lens-preset]` elements added anywhere (so other components can opt in with markup only). */
export function installLensScanner(): () => void {
  if (typeof document === 'undefined' || !lensSupported() || typeof MutationObserver === 'undefined') return () => {}
  const owned = new Map<HTMLElement, () => void>()
  let raf = 0
  const scan = () => {
    raf = 0
    for (const [el, off] of owned) if (!el.isConnected || !el.matches('.lens[data-lens-preset]')) { off(); owned.delete(el) }
    document.querySelectorAll<HTMLElement>('.lens[data-lens-preset]').forEach((el) => {
      if (owned.has(el) || active.has(el)) return
      const name = el.dataset.lensPreset as LensPresetName
      owned.set(el, registerLens(el, LENS_PRESETS[name] ? name : 'toast'))
    })
  }
  const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(scan) })
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-lens-preset'] })
  scan()
  return () => { mo.disconnect(); cancelAnimationFrame(raf); for (const off of owned.values()) off(); owned.clear() }
}
