import { lazy, Suspense, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { prefersReducedMotion } from './components/motion'
import { routeTitle } from './components/nav'
import { Rail, TabBar, TopBar } from './components/Shell'
import ToastProvider from './components/Toast'
import UpdatePrompt from './components/UpdatePrompt'

const Today = lazy(() => import('./pages/Today'))
const Ops = lazy(() => import('./pages/Ops'))
const Ontology = lazy(() => import('./pages/Ontology'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Goals = lazy(() => import('./pages/Goals'))
const Food = lazy(() => import('./pages/Food'))
const Body = lazy(() => import('./pages/Body'))
const Finance = lazy(() => import('./pages/Finance'))
const Learning = lazy(() => import('./pages/Learning'))
const People = lazy(() => import('./pages/People'))
const History = lazy(() => import('./pages/History'))
const Review = lazy(() => import('./pages/Review'))
const Settings = lazy(() => import('./pages/Settings'))
const Habits = lazy(() => import('./pages/Habits'))
const Journal = lazy(() => import('./pages/Journal'))
const Planner = lazy(() => import('./pages/Planner'))
const DataHub = lazy(() => import('./pages/DataHub'))

type VTDoc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }

/**
 * Route change: nav-level links (rail, phone tab bar, More sheet) cross-fade with the View Transitions API where supported.
 * Everywhere else, and in browsers without it, `.route-view` (keyed by path) plays a short CSS fade. Reduced motion: neither.
 */
function useNavTransitions() {
  const navigate = useNavigate()
  useEffect(() => {
    const doc = document as VTDoc
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (!doc.startViewTransition || prefersReducedMotion()) return
      const a = (e.target as Element | null)?.closest?.('a.nav-link, a.tab-item, a.more-link') as HTMLAnchorElement | null
      const href = a?.getAttribute('href')
      if (!href?.startsWith('#/')) return
      const to = href.slice(1)
      if (to === window.location.hash.slice(1)) return
      e.preventDefault() // Link's own handler skips navigation; its onClick (e.g. closing the More sheet) still runs
      const root = document.documentElement
      root.classList.add('vt-running')
      const vt = doc.startViewTransition(() => flushSync(() => navigate(to)))
      void vt.finished.finally(() => root.classList.remove('vt-running'))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [navigate])
}

function PageFallback() {
  return (
    <div className="page-skel" aria-busy="true" aria-label="Loading">
      <div className="skel skel-title" />
      <div className="skel skel-strip" />
      <div className="skel skel-block" />
    </div>
  )
}

function Shell() {
  const { pathname } = useLocation()
  useEffect(() => { document.title = routeTitle(pathname) }, [pathname])
  useNavTransitions()
  return (
      <div className="shell">
        <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
        <Rail />
        <div className="stage">
        <TopBar />
        <main className="main" id="main" tabIndex={-1}>
          <Suspense fallback={<PageFallback />}>
          <div className="route-view" key={pathname}>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/ops" element={<Ops />} />
            <Route path="/ontology" element={<Ontology />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/food" element={<Food />} />
            <Route path="/body" element={<Body />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/people" element={<People />} />
            <Route path="/history" element={<History />} />
            <Route path="/review" element={<Review />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/data" element={<DataHub />} />
          </Routes>
          </div>
          </Suspense>
        </main>
        </div>
        <TabBar />
        <UpdatePrompt />
      </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </HashRouter>
  )
}
