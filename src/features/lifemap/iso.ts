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

// ---- Rotation (90 degree steps), the rotation swing, and the perspective tilt ----

/** Quarter turns, always 0..3. */
export const quarter = (r: number) => ((Math.round(r) % 4) + 4) % 4

/** Rotate a world tile point about the city centre by `r` quarter turns. */
export function rotateTile(x: number, y: number, r: number): Pt {
  switch (quarter(r)) {
    case 1: return { x: -y, y: x }
    case 2: return { x: -x, y: -y }
    case 3: return { x: y, y: -x }
    default: return { x, y }
  }
}

/** Rotate an axis-aligned footprint (back corner x, y; w by d tiles); returns the new back corner and footprint. */
export function rotateRect(x: number, y: number, w: number, d: number, r: number): { x: number; y: number; w: number; d: number } {
  switch (quarter(r)) {
    case 1: return { x: -y - d, y: x, w: d, d: w }
    case 2: return { x: -x - w, y: -y - d, w, d }
    case 3: return { x: y, y: -x - w, w: d, d: w }
    default: return { x, y, w, d }
  }
}

/** Ground-plane rotation by `theta` radians, as a screen-space linear map [a, b, c, d] (x' = a x + c y, y' = b x + d y).
 *  It is P R P^-1 for the 2:1 projection, so at a quarter turn it lands exactly on the rotated scene. */
export function swingMatrix(theta: number): [number, number, number, number] {
  const cs = Math.cos(theta), sn = Math.sin(theta)
  const hw = TILE_W / 2, hh = TILE_H / 2
  // P = [[hw, -hw], [hh, hh]], P^-1 = 1 / (2 hw hh) [[hh, hw], [-hh, hw]], R = [[cs, -sn], [sn, cs]]
  const det = 2 * hw * hh
  const pr = [[hw * cs - hw * sn, -hw * sn - hw * cs], [hh * cs + hh * sn, -hh * sn + hh * cs]]
  const m00 = (pr[0][0] * hh + pr[0][1] * -hh) / det, m01 = (pr[0][0] * hw + pr[0][1] * hw) / det
  const m10 = (pr[1][0] * hh + pr[1][1] * -hh) / det, m11 = (pr[1][0] * hw + pr[1][1] * hw) / det
  return [m00, m10, m01, m11]
}

/** SVG transform for a swing of `theta` about world point `c`. */
export function swingTransform(theta: number, c: Pt): string {
  if (Math.abs(theta) < 1e-4) return ''
  const [a, b, cc, d] = swingMatrix(theta)
  const e = c.x - (a * c.x + cc * c.y), f = c.y - (b * c.x + d * c.y)
  return `matrix(${round4(a)} ${round4(b)} ${round4(cc)} ${round4(d)} ${round(e)} ${round(f)})`
}

export interface Tilt { rx: number; ry: number }
/** Perspective distance (px) of the tilted stage. */
export const PERSPECTIVE = 1500

/** Where a point drawn on the stage lands after the stage's CSS `perspective(P) rotateX(rx) rotateY(ry)` about its centre. */
export function tiltPoint(p: Pt, view: Size, t: Tilt, persp = PERSPECTIVE): Pt {
  const ax = (t.rx * Math.PI) / 180, ay = (t.ry * Math.PI) / 180
  const x0 = p.x - view.w / 2, y0 = p.y - view.h / 2
  // rotateY first, then rotateX (CSS applies the list right to left to the point)
  const x1 = x0 * Math.cos(ay), z1 = -x0 * Math.sin(ay)
  const y2 = y0 * Math.cos(ax) - z1 * Math.sin(ax), z2 = y0 * Math.sin(ax) + z1 * Math.cos(ax)
  const w = 1 - z2 / persp
  return { x: view.w / 2 + x1 / w, y: view.h / 2 + y2 / w }
}

export const tiltCss = (t: Tilt, persp = PERSPECTIVE) => `perspective(${persp}px) rotateX(${t.rx.toFixed(3)}deg) rotateY(${t.ry.toFixed(3)}deg)`
