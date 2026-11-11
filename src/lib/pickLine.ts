// Deterministic, non-repeating line picker for toasts and small messages. Same (key, seed) always gives the same line,
// and consecutive seeds (1, 2, 3 ...) walk the list so the same line never shows twice in a row.
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function pickLine<T extends string>(key: string, seed: number, lines: readonly T[]): T {
  if (lines.length === 0) throw new Error('pickLine needs at least one line')
  const base = hash(key) % lines.length
  const step = Math.abs(Math.trunc(seed)) % lines.length
  return lines[(base + step) % lines.length]
}
