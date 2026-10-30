import { useSyncExternalStore } from 'react'

export const PHONE_QUERY = '(max-width: 819px)'

/** Subscribes to a CSS media query. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
