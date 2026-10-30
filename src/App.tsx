import { HashRouter, Route, Routes } from 'react-router-dom'
import { Rail, TabBar, TopBar } from './components/Shell'
import ToastProvider from './components/Toast'
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

function Shell() {
  return (
      <div className="shell">
        <Rail />
        <div className="stage">
        <TopBar />
        <main className="main" id="main">
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
        </div>
        <TabBar />
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
