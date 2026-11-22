// The one spring integrator (docs/redesign/LIQUID_V2.md, Motion; ported from council/motion.html).
// Stiffness k, damping c = 2 z sqrt(k), semi-implicit Euler at 240 Hz substeps, ONE requestAnimationFrame loop for every system
// that stops when everything is at rest. Retargeting keeps velocity, so every motion is interruptible.
// CSS twins: --spring-snappy-2 / --spring-smooth-2 (linear() sampled from these presets) in liquid.css; springLinear() makes more.

export type SpringPreset = { k: number; z: number }

export const SPRINGS = {
  snappy: { k: 620, z: 0.68 },
  smooth: { k: 300, z: 0.74 },
  gentle: { k: 140, z: 0.9 },
  press: { k: 1100, z: 1 },
  release: { k: 420, z: 0.5 },
} as const satisfies Record<string, SpringPreset>

const HZ = 240

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export class Spring {
  x: number
  t: number
  v = 0
  k = 0
  c = 0
  eps: number
  constructor(x: number, p: SpringPreset = SPRINGS.smooth, eps = 0.02) {
    this.x = this.t = x
    this.eps = eps
    this.set(p)
  }
  set(p: SpringPreset) { this.k = p.k; this.c = 2 * p.z * Math.sqrt(p.k) }
  /** Retarget (velocity is kept). Under reduced motion it snaps. */
  to(t: number, p?: SpringPreset) {
    if (p) this.set(p)
    this.t = t
    if (reduced()) this.snap(t)
    wake()
  }
  snap(t: number) { this.x = this.t = t; this.v = 0 }
  step(dt: number) { this.v += (-this.k * (this.x - this.t) - this.c * this.v) * dt; this.x += this.v * dt }
  get rest() { return Math.abs(this.v) < this.eps * 10 && Math.abs(this.x - this.t) < this.eps }
}

/** A system renders a set of springs; `dirty` forces one render even when nothing moves. */
export type SpringSystem = { springs: Spring[]; render: () => void; dirty?: boolean }

const systems = new Set<SpringSystem>()
let raf = 0
let last = 0
let reducedOverride: boolean | null = null
const reduced = () => reducedOverride ?? prefersReducedMotion()
/** Tests: force reduced motion on or off (null = follow the media query). */
export function setReducedMotionForTest(v: boolean | null) { reducedOverride = v }

/** Advance every system by dt seconds (240 Hz substeps). Returns true while anything still moves. */
export function runSprings(dt: number): boolean {
  let busy = false
  for (const s of systems) {
    let moving = false
    for (const sp of s.springs) {
      if (!sp.rest) {
        moving = true
        const n = Math.max(1, Math.ceil(dt * HZ))
        for (let i = 0; i < n; i++) sp.step(dt / n)
      } else { sp.x = sp.t; sp.v = 0 }
    }
    if (moving || s.dirty) { s.render(); s.dirty = false }
    busy ||= moving
  }
  return busy
}

function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  raf = runSprings(dt) ? requestAnimationFrame(tick) : 0
}
function wake() {
  if (raf || typeof requestAnimationFrame === 'undefined') return
  last = performance.now()
  raf = requestAnimationFrame(tick)
}

/** Register a system; returns the remover. The loop starts when a spring is retargeted or the system is dirty. */
export function addSystem(s: SpringSystem): () => void {
  systems.add(s)
  if (s.dirty) wake()
  return () => { systems.delete(s) }
}
/** Ask for one render on the next frame (after a snap, say). */
export function touch(s: SpringSystem) { s.dirty = true; wake() }

/**
 * Sample a spring going 0 -> 1 into a CSS linear() easing and its duration (ms, to rest within 0.1%).
 * springLinear(SPRINGS.snappy) is the source of --spring-snappy-2.
 */
export function springLinear(p: SpringPreset, points = 10): { easing: string; ms: number } {
  const s = new Spring(0, p, 0.001)
  s.t = 1
  const dt = 1 / HZ
  const xs: number[] = [0]
  let time = 0
  while (!(Math.abs(s.x - 1) < 0.001 && Math.abs(s.v) < 0.01) && time < 3) { s.step(dt); time += dt; xs.push(s.x) }
  const ms = Math.round(time * 1000)
  const out: string[] = ['0']
  for (let i = 1; i < points; i++) {
    const v = xs[Math.round((i / points) * (xs.length - 1))]
    out.push(`${+v.toFixed(3)} ${(i / points) * 100}%`)
  }
  out.push('1')
  return { easing: `linear(${out.join(', ')})`, ms }
}
