import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
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
  return (
      <div className="shell">
        <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
        <Rail />
        <div className="stage">
        <TopBar />
        <main className="main" id="main" tabIndex={-1}>
          <Suspense fallback={<PageFallback />}>
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
