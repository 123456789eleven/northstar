// Pure: time-of-day lighting for the city. Dusk and night are the default look; daytime only lifts the haze a little and
// turns most window lights off. Palette stays raven and powder blue (lights are never warm, never gold).
export type Phase = 'night' | 'dawn' | 'day' | 'dusk'
export interface Lighting {
  phase: Phase
  /** 0 = full day, 1 = full night. */
  night: number
  /** Share of windows lit, 0..1, rounded to 0.05 so the scene redraws only on visible steps. */
  windows: number
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** Lighting at a local hour (0..24, fractional). Night 21:00 to 05:00, dawn ramps 05:00 to 08:00, dusk 17:00 to 21:00. */
export function lightingAt(hour: number): Lighting {
  const h = ((hour % 24) + 24) % 24
  const night = h < 12 ? 1 - smooth(5, 8, h) : smooth(17, 21, h)
  const phase: Phase = night > 0.85 ? 'night' : night < 0.15 ? 'day' : h < 12 ? 'dawn' : 'dusk'
  const windows = Math.round((0.12 + 0.56 * night) * 20) / 20
  return { phase, night: Math.round(night * 100) / 100, windows }
}

export const lightingFor = (d: Date) => lightingAt(d.getHours() + d.getMinutes() / 60)

/** Deterministic 0..1 hash of an integer (so a given window keeps its on/off state between renders). */
export function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** Is window `i` of building `seed` lit at this share? Raising the share only ever turns more windows on. */
export const windowOn = (seed: number, i: number, share: number) => hash01(seed * 977 + i * 131 + 7) < share

/** Atmospheric fog by depth (x + y in tiles after rotation): the back of the city fades into the night, the front stays clear. */
export const fogFor = (depth: number, max: number) => Math.round(Math.min(1, Math.max(0, (-depth - 3) / 18)) * max * 100) / 100
