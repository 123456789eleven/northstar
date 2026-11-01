// Motion helpers shared by primitives. Durations mirror the --dur-* tokens in index.css; every helper honours reduced motion.
import { useCallback, useEffect, useRef, useState } from 'react'

export const DUR = { fast: 120, base: 200, slow: 320 } as const

export function prefersReducedMotion(): boolean {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Exit animation for overlays: returns [closing, requestClose]. requestClose adds the closing state, waits for the
 * exit keyframes (--dur-fast) and then calls onClose. If the parent keeps the overlay mounted, it resets.
 */
export function useExit(onClose: () => void, ms: number = DUR.fast) {
  const [closing, setClosing] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const requestClose = useCallback(() => {
    if (timer.current !== undefined) return
    if (prefersReducedMotion()) { close.current(); return }
    setClosing(true)
    timer.current = window.setTimeout(() => {
      timer.current = undefined
      close.current()
      setClosing(false)
    }, ms)
  }, [ms])
  return [closing, requestClose] as const
}

/** Splits "-$1,234.50 left" into parts so the number can be animated; null when there is not exactly one number. */
export function parseNumeric(v: unknown): { sign: string; prefix: string; n: number; decimals: number; grouped: boolean; suffix: string } | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null
  const m = /^(-?)([^\d-]*)(-?)(\d[\d,]*(?:\.\d+)?)([^\d]*)$/.exec(String(v).trim())
  if (!m) return null
  const digits = m[4]
  const n = Number(digits.replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  return { sign: m[1] || m[3], prefix: m[2], n, decimals: digits.split('.')[1]?.length ?? 0, grouped: digits.includes(','), suffix: m[5] }
}

export function formatNumeric(p: NonNullable<ReturnType<typeof parseNumeric>>, n: number): string {
  const body = n.toLocaleString('en-US', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals, useGrouping: p.grouped })
  return p.sign && n > 0 ? (p.prefix ? `${p.sign}${p.prefix}${body}${p.suffix}` : `${p.sign}${body}${p.suffix}`) : `${p.prefix}${body}${p.suffix}`
}
