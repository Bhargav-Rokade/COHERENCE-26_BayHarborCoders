/*
  main.tsx — Application entry point
  Sets up React Router with routes for the 3 modules.
*/
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import './index.css'
import App from './App'
import KnowledgeBasePage from './pages/KnowledgeBasePage'
import WorkflowBuilderPage from './pages/WorkflowBuilderPage'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      BrowserRouter enables client-side routing.
      App renders the sidebar + an <Outlet> where page content appears.
      Each Route maps a URL path to a page component.
    */}
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          {/* Default route → redirect to knowledge base */}
          <Route index element={<Navigate to="/knowledge-base" replace />} />
          <Route path="knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="workflow-builder" element={<WorkflowBuilderPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="leads" element={<LeadsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
