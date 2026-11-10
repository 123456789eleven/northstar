// Pure isometric math for the Life map: 2:1 projection, block faces, camera fit/focus/zoom/pan, spring step.
export const TILE_W = 64
export const TILE_H = 32

export interface Pt { x: number; y: number }
export interface Camera { x: number; y: number; k: number }
export interface Size { w: number; h: number }
export interface Inset { l?: number; r?: number; t?: number; b?: number }

const round = (n: number) => Math.round(n * 10) / 10
const round4 = (n: number) => Math.round(n * 10000) / 10000

/** World tile (x, y) at height z (px) to screen px. */
export function project(x: number, y: number, z = 0): Pt {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) - z }
}

/** Inverse of project at z = 0. */
export function unproject(sx: number, sy: number): Pt {
  const u = sx / (TILE_W / 2)
  const v = sy / (TILE_H / 2)
  return { x: (u + v) / 2, y: (v - u) / 2 }
}

export interface BlockFaces { top: Pt[]; left: Pt[]; right: Pt[]; base: Pt[]; peak: Pt }

/** A box with its back corner at tile (x, y), w by d tiles, h px tall. */
export function blockFaces(x: number, y: number, w: number, d: number, h: number): BlockFaces {
  const p = (ox: number, oy: number, z: number) => project(x + ox, y + oy, z)
  return {
    top: [p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)],
    left: [p(0, d, h), p(w, d, h), p(w, d, 0), p(0, d, 0)],
    right: [p(w, 0, h), p(w, d, h), p(w, d, 0), p(w, 0, 0)],
    base: [p(0, 0, 0), p(w, 0, 0), p(w, d, 0), p(0, d, 0)],
    peak: p(w / 2, d / 2, h),
  }
}

export const pts = (ps: Pt[]) => ps.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export function boundsOf(ps: Pt[]): Bounds {
  if (!ps.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of ps) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export const MIN_K = 0.3
export const MAX_K = 2.6
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Camera that puts world point `p` in the middle of the free area of the viewport (inset px reserved per side). */
export function centreOn(p: Pt, k: number, _view: Size, inset: Inset = {}): Camera {
  const dx = ((inset.l ?? 0) - (inset.r ?? 0)) / 2
  const dy = ((inset.t ?? 0) - (inset.b ?? 0)) / 2
  return { x: p.x - dx / k, y: p.y - dy / k, k }
}

/** Camera that fits bounds inside the free area of the viewport. */
export function fitCamera(b: Bounds, view: Size, margin = 0.9, inset: Inset = {}): Camera {
  const availW = Math.max(40, view.w - (inset.l ?? 0) - (inset.r ?? 0))
  const availH = Math.max(40, view.h - (inset.t ?? 0) - (inset.b ?? 0))
  const bw = Math.max(1, b.maxX - b.minX)
  const bh = Math.max(1, b.maxY - b.minY)
  const k = clamp(Math.min(availW / bw, availH / bh) * margin, MIN_K, MAX_K)
  return centreOn({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }, k, view, inset)
}

/** SVG transform that draws world px under camera `c`. */
export function cameraTransform(c: Camera, view: Size): string {
  return `translate(${round(view.w / 2 - c.x * c.k)} ${round(view.h / 2 - c.y * c.k)}) scale(${round4(c.k)})`
}

export function worldToScreen(p: Pt, c: Camera, view: Size): Pt {
  return { x: view.w / 2 + (p.x - c.x) * c.k, y: view.h / 2 + (p.y - c.y) * c.k }
}

/** Zoom about a screen point so the world point under it stays put. */
export function zoomAt(c: Camera, factor: number, at: Pt, view: Size): Camera {
  const k = clamp(c.k * factor, MIN_K, MAX_K)
  const wx = c.x + (at.x - view.w / 2) / c.k
  const wy = c.y + (at.y - view.h / 2) / c.k
  return { x: wx - (at.x - view.w / 2) / k, y: wy - (at.y - view.h / 2) / k, k }
}

/** Pan by a screen-space drag delta, kept inside `limit` (world px) when given. */
export function panBy(c: Camera, dx: number, dy: number, limit?: Bounds): Camera {
  const next = { ...c, x: c.x - dx / c.k, y: c.y - dy / c.k }
  if (!limit) return next
  return { ...next, x: clamp(next.x, limit.minX, limit.maxX), y: clamp(next.y, limit.minY, limit.maxY) }
}

export const padBounds = (b: Bounds, n: number): Bounds => ({ minX: b.minX - n, minY: b.minY - n, maxX: b.maxX + n, maxY: b.maxY + n })

export interface Spring { v: number; vel: number }

/** Lightly under-damped spring step toward `target`. dt in seconds. */
export function springStep(s: Spring, target: number, dt: number, stiffness = 170, damping = 22): Spring {
  const steps = Math.max(1, Math.ceil(dt / 0.008))
  const h = dt / steps
  let { v, vel } = s
  for (let i = 0; i < steps; i++) {
    vel += (-stiffness * (v - target) - damping * vel) * h
    v += vel * h
  }
  return { v, vel }
}

export const springSettled = (s: Spring, target: number, eps = 0.0005) => Math.abs(s.v - target) < eps && Math.abs(s.vel) < eps
