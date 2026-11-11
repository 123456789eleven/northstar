// Page loading fallback and the keyed route fade. The building frame (BuildingFrame.tsx) wraps every non-home page.
import { Suspense, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

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
