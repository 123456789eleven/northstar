import { useEffect, useRef } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import QuickCapture from './components/QuickCapture'
import Today from './pages/Today'
import Ops from './pages/Ops'
import Ontology from './pages/Ontology'
import Tasks from './pages/Tasks'
import Goals from './pages/Goals'
import Food from './pages/Food'
import Finance from './pages/Finance'
import Learning from './pages/Learning'
import People from './pages/People'
import History from './pages/History'
import Review from './pages/Review'
import Settings from './pages/Settings'
import Habits from './pages/Habits'
import Journal from './pages/Journal'
import Planner from './pages/Planner'
import DataHub from './pages/DataHub'

const NAV: { section?: string; to: string; label: string }[] = [
  { to: '/ops', label: 'Command' },
  { to: '/', label: 'Today' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/goals', label: 'Goals' },
  { section: 'Life', to: '/finance', label: 'Finance' },
  { to: '/food', label: 'Food' },
  { to: '/learning', label: 'Learning' },
  { to: '/people', label: 'People' },
  { section: 'Reflect', to: '/history', label: 'History' },
  { to: '/review', label: 'Review' },
  { to: '/ontology', label: 'Ontology' },
  { to: '/settings', label: 'Settings' },
]

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" strokeLinecap="round" opacity="0.35" />
      <path d="M12 4l2 8-2 8-2-8z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Links() {
  return (
    <>
      {NAV.map((n) => (
        <span key={n.to} style={{ display: 'contents' }}>
          {n.section && <div className="nav-section">{n.section}</div>}
          <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-dot" />
            {n.label}
          </NavLink>
        </span>
      ))}
    </>
  )
}

function Shell() {
  const tabbar = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    tabbar.current?.querySelector<HTMLElement>('.active')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])
  return (
      <div className="shell">
        <nav className="sidebar" aria-label="Main">
          <div className="brand"><Mark />Northstar</div>
          <Links />
        </nav>
        <main className="main">
          <QuickCapture />
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/ops" element={<Ops />} />
            <Route path="/ontology" element={<Ontology />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/food" element={<Food />} />
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
        </main>
        <nav className="tabbar" aria-label="Main mobile" ref={tabbar}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-dot" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
