// Single-weight inline SVG set (16px, 1.5px stroke, currentColor). No icon fonts.
import type { ReactNode } from 'react'

const P = {
  command: <><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" /></>,
  today: <><circle cx="8" cy="8" r="5.5" /><path d="M8 4.5V8l2.5 1.5" /></>,
  planner: <><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></>,
  tasks: <><rect x="2.5" y="2.5" width="11" height="11" rx="2" /><path d="M5.5 8.2l1.8 1.8 3.2-3.5" /></>,
  goals: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.5" /></>,
  habits: <><path d="M2 8a6 6 0 0 1 10.5-4M14 8a6 6 0 0 1-10.5 4" /><path d="M12.5 1.5V4H10M3.5 14.5V12H6" /></>,
  finance: <path d="M2 13.5h12M4 13.5V8M8 13.5V3.5M12 13.5V6" />,
  food: <path d="M4.5 2v5a1.5 1.5 0 0 0 3 0V2M6 7v7M11.5 14V2c-1.7 1-2.5 3-2.5 5.5h2.5" />,
  learning: <path d="M2 3.5h4.5A1.5 1.5 0 0 1 8 5v8.5A1.5 1.5 0 0 0 6.5 12H2zM14 3.5H9.5A1.5 1.5 0 0 0 8 5v8.5a1.5 1.5 0 0 1 1.5-1.5H14z" />,
  people: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 14c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" /></>,
  journal: <><rect x="3" y="2" width="10" height="12" rx="1.5" /><path d="M6 5.5h4M6 8.5h4" /></>,
  history: <><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5v3h3" /><path d="M8 5v3.2l2 1.3" /></>,
  review: <path d="M3 2.5h10v11H3zM5.5 6l1.2 1.2L9 5M5.5 10.5h5" />,
  ontology: <><circle cx="4" cy="4" r="1.8" /><circle cx="12" cy="4" r="1.8" /><circle cx="8" cy="12" r="1.8" /><path d="M5.6 4h4.8M5 5.5l2 5M11 5.5l-2 5" /></>,
  data: <><ellipse cx="8" cy="4" rx="5" ry="2" /><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" /></>,
  settings: <><path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" /><circle cx="10.5" cy="4.5" r="1.5" /><circle cx="5.5" cy="11.5" r="1.5" /></>,
  more: <><circle cx="3.5" cy="8" r="1" fill="currentColor" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="12.5" cy="8" r="1" fill="currentColor" /></>,
  plus: <path d="M8 3v10M3 8h10" />,
  capture: <path d="M2.5 13.5l1-3.5 7-7 2.5 2.5-7 7zM9 4.5l2.5 2.5" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof P

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {P[name]}
    </svg>
  )
}
