/*
  App.tsx — Application Shell
  Renders the sidebar navigation and the main content area.
  The <Outlet> component is where the active page renders.
*/
import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, GitBranch, BarChart3, Zap } from 'lucide-react'
import './App.css'

/*
  NAV_ITEMS defines the sidebar navigation links.
  Each item has a label, URL path, and an icon component.
  To add a new page, just add an entry here and a Route in main.tsx.
*/
const NAV_ITEMS = [
  { label: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen },
  { label: 'Workflow Builder', path: '/workflow-builder', icon: GitBranch },
  { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
]

function App() {
  return (
    <div className="app-layout">
      {/* ---- Sidebar ---- */}
      <aside className="sidebar">
        {/* Logo / Brand */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Zap size={22} />
          </div>
          <span className="logo-text">Coherence</span>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer area in sidebar */}
        <div className="sidebar-footer">
          <p className="sidebar-version">v0.1.0 — MVP</p>
        </div>
      </aside>

      {/* ---- Main Content Area ---- */}
      <main className="main-content">
        {/*
          <Outlet> is a react-router concept.
          It renders whichever page component matches the current URL.
          Think of it as a "slot" where page content appears.
        */}
        <Outlet />
      </main>
    </div>
  )
}

export default App
