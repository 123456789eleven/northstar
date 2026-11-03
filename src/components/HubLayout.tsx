// Hub layout: a tab strip across the hub's pages (plus the Body / Mind sub-strip), then the page. Routes stay absolute
// (/tasks, /food, /journal ...), so every old URL, deep link and ?focus= param keeps working unchanged.
import { Suspense, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { HUBS, SUBTABS, tabActive, type HubTab } from './nav'

export function PageFallback() {
  return (
    <div className="page-skel" aria-busy="true" aria-label="Loading">
      <div className="skel skel-title" />
      <div className="skel skel-strip" />
      <div className="skel skel-block" />
    </div>
  )
}

/** Keyed by path: each page fades in (CSS) unless a View Transition is running. */
export function RouteFade({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <Suspense fallback={<PageFallback />}>
      <div className="route-view" key={pathname}>{children ?? <Outlet />}</div>
    </Suspense>
  )
}

function Strip({ label, tabs, sub = false }: { label: string; tabs: HubTab[]; sub?: boolean }) {
  const { pathname } = useLocation()
  return (
    <nav className={sub ? 'hub-sub' : 'hub-strip'} aria-label={label}>
      <div className={sub ? 'hub-sub-row' : 'hub-strip-row'}>
        {tabs.map((t) => {
          const active = tabActive(t, pathname)
          return (
            <Link key={t.to} to={t.to} className={`hub-tab ${active ? 'active' : ''}`} aria-current={pathname === t.to ? 'page' : active ? 'true' : undefined}>
              {t.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function HubLayout({ hub }: { hub: keyof typeof HUBS }) {
  const { pathname } = useLocation()
  const def = HUBS[hub]
  const sub = SUBTABS.find((s) => s.tabs.some((t) => t.to === pathname))
  return (
    <>
      <Strip label={`${def.label} sections`} tabs={def.tabs} />
      {sub && <Strip label={`${sub.label} pages`} tabs={sub.tabs} sub />}
      <RouteFade />
    </>
  )
}
