import { lazy, Suspense, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { prefersReducedMotion } from './components/motion'
import { routeTitle } from './components/nav'
import { CaptureHost, CaptureOrb, TopBar } from './components/Shell'
import DistrictStrip from './components/DistrictStrip'
import { districtForPath } from './components/districts'
import { useMedia, PHONE_QUERY } from './components/useMedia'
import { LifeMapProvider } from './features/lifemap/useLifeMap'
import { CityDefs } from './features/lifemap/CityScene'
import { CityHead } from './components/DistrictFrame'
import HubLayout, { RouteFade } from './components/HubLayout'
import { GlassDefs } from './components/GlassDefs'
import { PlayerProvider } from './features/game/ui/PlayerProvider'
import './features/game/ui/game.css'
import ToastProvider from './components/Toast'
import UpdatePrompt from './components/UpdatePrompt'
import { ShortcutsHost } from './components/Shortcuts'
import { useDensity } from './components/density'

const MomentHost = lazy(() => import('./features/game/ui/MomentHost').then((m) => ({ default: m.MomentHost })))
const Today = lazy(() => import('./pages/Today'))
const Ops = lazy(() => import('./pages/Ops'))
const Ontology = lazy(() => import('./pages/Ontology'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Goals = lazy(() => import('./pages/Goals'))
const Food = lazy(() => import('./pages/Food'))
const Body = lazy(() => import('./pages/Body'))
const Interview = lazy(() => import('./pages/Interview'))
const StyleTile = lazy(() => import('./pages/StyleTile'))
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
const Career = lazy(() => import('./pages/Career'))
const PlanHub = lazy(() => import('./pages/PlanHub'))
const Home = lazy(() => import('./pages/Home'))
const SkillsHub = lazy(() => import('./pages/SkillsHub'))
const MindHub = lazy(() => import('./pages/MindHub'))
const YouHub = lazy(() => import('./pages/YouHub'))

type VTDoc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }

/**
 * Route change: nav-level links (district strip, hub tab strip) cross-fade with the View Transitions API where supported.
 * Everywhere else, and in browsers without it, `.route-view` (keyed by path) plays a short CSS fade. Reduced motion: neither.
 */
function useNavTransitions() {
  const navigate = useNavigate()
  useEffect(() => {
    const doc = document as VTDoc
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (!doc.startViewTransition || prefersReducedMotion()) return
      const a = (e.target as Element | null)?.closest?.('a.dstrip-tab, a.hub-tab') as HTMLAnchorElement | null
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

function Shell() {
  const { pathname } = useLocation()
  useEffect(() => { document.title = routeTitle(pathname) }, [pathname])
  useNavTransitions()
  useDensity()
  const phone = useMedia(PHONE_QUERY)
  return (
      <div className={`shell${pathname === '/' || pathname === '/map' ? ' is-home' : ''}`} data-district={districtForPath(pathname)}>
        <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
        <GlassDefs />
        <CityDefs />
        <div className="stage">
        <TopBar />
        <main className="main" id="main" tabIndex={-1}>
          <CityHead />
          <Routes>
            <Route element={<RouteFade />}>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<Home />} />
            </Route>
            <Route element={<HubLayout hub="plan" />}>
              <Route path="/today" element={<Today />} />
              <Route path="/plan" element={<PlanHub />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/habits" element={<Habits />} />
            </Route>
            <Route element={<RouteFade />}>
              <Route path="/finance" element={<Finance />} />
            </Route>
            <Route element={<HubLayout hub="skills" />}>
              <Route path="/skills" element={<SkillsHub />} />
              <Route path="/body" element={<Body />} />
              <Route path="/interview" element={<Interview />} />
              <Route path="/style" element={<StyleTile />} />
              <Route path="/food" element={<Food />} />
              <Route path="/mind" element={<MindHub />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/learning" element={<Learning />} />
              <Route path="/career" element={<Career />} />
              <Route path="/people" element={<People />} />
            </Route>
            <Route element={<HubLayout hub="you" />}>
              <Route path="/you" element={<YouHub />} />
              <Route path="/history" element={<History />} />
              <Route path="/review" element={<Review />} />
              <Route path="/ops" element={<Ops />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/data" element={<DataHub />} />
              <Route path="/ontology" element={<Ontology />} />
            </Route>
          </Routes>
        </main>
        </div>
        <DistrictStrip phone={phone} />
        {phone && <CaptureOrb />}
        <CaptureHost />
        <Suspense fallback={null}><MomentHost /></Suspense>
        <UpdatePrompt />
        <ShortcutsHost />
      </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <PlayerProvider>
          <LifeMapProvider>
            <Shell />
          </LifeMapProvider>
        </PlayerProvider>
      </ToastProvider>
    </HashRouter>
  )
}
