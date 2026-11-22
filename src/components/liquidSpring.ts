// Liquid v2 motion (docs/redesign/LIQUID_V2.md, council motion.html): a damped spring, c = 2 z sqrt(k), integrated with
// semi-implicit Euler at 240 Hz substeps, all springs on one rAF loop that stops when everything is at rest. Retargeting keeps
// the current velocity, so every motion can be interrupted. LOCAL HELPER for WP-C: WP-F is adding src/lib/spring.ts with the
// same integrator; the lead folds this file into it when both land.

export interface SpringPreset { k: number; z: number }

export const SPRING = {
  snappy: { k: 620, z: 0.68 },
  smooth: { k: 300, z: 0.74 },
  gentle: { k: 140, z: 0.9 },
  press: { k: 1100, z: 1 },
  release: { k: 420, z: 0.5 },
} as const satisfies Record<string, SpringPreset>

export class Spring {
  x: number
  t: number
  v = 0
  k = 0
  c = 0
  readonly eps: number
  constructor(x: number, p: SpringPreset = SPRING.smooth, eps = 0.02) {
    this.eps = eps
    this.x = this.t = x
    this.set(p)
  }
  set(p: SpringPreset) { this.k = p.k; this.c = 2 * p.z * Math.sqrt(p.k) }
  /** Moves the target; velocity is kept, so a spring in flight bends toward the new target. */
  to(t: number, p?: SpringPreset) { if (p) this.set(p); this.t = t; wake() }
  snap(t: number) { this.x = this.t = t; this.v = 0 }
  step(dt: number) { this.v += (-this.k * (this.x - this.t) - this.c * this.v) * dt; this.x += this.v * dt }
  get rest() { return Math.abs(this.v) < this.eps * 10 && Math.abs(this.x - this.t) < this.eps }
}

export interface SpringSystem { springs: Spring[]; render: () => void; dirty?: boolean }

const systems = new Set<SpringSystem>()
let raf = 0
let last = 0

/** Advances every system by dt seconds; returns true while anything still moves. Exported for tests. */
export function advance(dt: number): boolean {
  let busy = false
  for (const s of systems) {
    let moving = false
    for (const sp of s.springs) {
      if (!sp.rest) {
        moving = true
        const n = Math.max(1, Math.ceil(dt * 240))
        for (let i = 0; i < n; i++) sp.step(dt / n)
      } else { sp.x = sp.t; sp.v = 0 }
    }
    if (moving || s.dirty) { s.dirty = false; s.render() }
    busy ||= moving
  }
  return busy
}

function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  raf = advance(dt) ? requestAnimationFrame(tick) : 0
}

/** Starts the loop if it is idle. */
export function wake() {
  if (raf || typeof requestAnimationFrame === 'undefined') return
  last = performance.now()
  raf = requestAnimationFrame(tick)
}

/** Registers a system; returns its remover. Mark `dirty` (and wake) to render once without motion. */
export function addSystem(s: SpringSystem): () => void {
  systems.add(s)
  return () => { systems.delete(s) }
}

/** 160 ms opacity crossfade, the reduced-motion stand-in for every spring motion. */
export function crossfade(el: Element | null | undefined, from = 0, to = 1) {
  el?.animate?.([{ opacity: from }, { opacity: to }], { duration: 160, easing: 'linear' })
}
