// Monochrome geometric insignia: one 48px grid, one 1.5 stroke, no fills except small solid points.
import type { ReactNode } from 'react'
import type { BadgeMark } from './badges'

const P: Record<BadgeMark, ReactNode> = {
  scale: <><rect x="11" y="12" width="26" height="24" rx="5" /><path d="M17 20a7 7 0 0 1 14 0" /><path d="M24 20l3-3" /></>,
  dumbbell: <><path d="M10 24h28" /><rect x="12" y="16" width="4" height="16" rx="1" /><rect x="32" y="16" width="4" height="16" rx="1" /><path d="M7 20v8M41 20v8" /></>,
  coin: <><circle cx="24" cy="24" r="12" /><path d="M18 24.5l4.5 4.5L31 19" /></>,
  ring: <><circle cx="24" cy="24" r="12" /><path d="M24 12a12 12 0 1 1-12 12" strokeWidth="3" /></>,
  peak: <><path d="M9 35l10-14 6 8 5-7 9 13z" /><path d="M9 35h30" /></>,
  bars: <><path d="M13 35V25M21 35V17M29 35V21M37 35V13" /><path d="M9 35h32" /></>,
  arrow: <><path d="M13 35l20-20" /><path d="M20 15h13v13" /></>,
  gauge: <><path d="M10 33a14 14 0 1 1 28 0" /><path d="M24 33l7-9" /><circle cx="24" cy="33" r="1.5" fill="currentColor" /></>,
  laurel: <><path d="M24 36V14" /><path d="M24 20c-5 0-8-3-8-7 5 0 8 3 8 7zM24 28c-5 0-8-3-8-7 5 0 8 3 8 7zM24 20c5 0 8-3 8-7-5 0-8 3-8 7zM24 28c5 0 8-3 8-7-5 0-8 3-8 7z" /></>,
  book: <><path d="M12 14h11v22H12zM25 14h11v22H25z" /><path d="M16 20h3M29 20h3" /></>,
  cap: <><path d="M6 20l18-8 18 8-18 8z" /><path d="M14 25v7c0 2 5 4 10 4s10-2 10-4v-7" /></>,
  calendar: <><rect x="10" y="13" width="28" height="25" rx="4" /><path d="M10 21h28M17 10v6M31 10v6" /><circle cx="24" cy="29" r="1.5" fill="currentColor" /></>,
  weeks: <><path d="M10 16h28M10 24h28M10 32h28" /><path d="M10 16h8M10 24h14M10 32h22" strokeWidth="3" /></>,
  plate: <><circle cx="24" cy="24" r="13" /><circle cx="24" cy="24" r="6" /></>,
  chain: <><rect x="8" y="19" width="16" height="10" rx="5" /><rect x="24" y="19" width="16" height="10" rx="5" /></>,
  page: <><path d="M14 10h14l7 7v21H14z" /><path d="M28 10v7h7M19 25h12M19 31h8" /></>,
  check: <><rect x="11" y="11" width="26" height="26" rx="6" /><path d="M18 24.5l4.5 4.5L31 19" /></>,
  loop: <><path d="M36 24a12 12 0 1 1-4-9" /><path d="M33 9v7h-7" /></>,
  flag: <><path d="M15 38V10" /><path d="M15 12h20l-5 6 5 6H15" /></>,
  stack: <><path d="M24 11l14 7-14 7-14-7z" /><path d="M10 25l14 7 14-7M10 32l14 7 14-7" /></>,
}

export function BadgeMarkSvg({ mark, size = 48 }: { mark: BadgeMark; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {P[mark]}
    </svg>
  )
}
