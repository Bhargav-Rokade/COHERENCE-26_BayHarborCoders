/*
  App.tsx — Application Shell
  Renders the sidebar navigation and the main content area.
  The <Outlet> component is where the active page renders.
*/
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, GitBranch, BarChart3, Zap, Menu, Users } from 'lucide-react'
import './App.css'

/*
  NAV_ITEMS defines the sidebar navigation links.
  Each item has a label, URL path, and an icon component.
*/
const NAV_ITEMS = [
  { label: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen },
  { label: 'Workflow Builder', path: '/workflow-builder', icon: GitBranch },
  { label: 'Leads', path: '/leads', icon: Users },
  { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
]

function App() {
  // State to track if the sidebar is expanded (true) or collapsed into a mini-sidebar (false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="app-layout">
      {/* ---- Sidebar ---- */}
      <aside className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
        {/* Top Header inside Sidebar: Hamburger + Logo */}
        <div className="sidebar-header">
          <button
            className="menu-button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle Menu"
          >
            <Menu size={20} />
          </button>

          <div className="sidebar-logo">
            <div className="logo-icon">
              <Zap size={18} />
            </div>
            <span className="logo-text">Coherence</span>
          </div>
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
              title={!isSidebarOpen ? item.label : undefined}
            >
              <item.icon size={20} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer area in sidebar */}
        <div className="sidebar-footer">
          <p className="sidebar-version">v0.1.0</p>
        </div>
      </aside>

      {/* ---- Main Content Area ---- */}
      <main className={`main-content ${isSidebarOpen ? '' : 'expanded'}`}>
        <Outlet />
      </main>
    </div>
  )
}

export default App
