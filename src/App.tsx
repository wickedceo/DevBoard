import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import { useAuth } from './context/useAuth'
import './App.css'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Team = lazy(() => import('./pages/Team'))
const Settings = lazy(() => import('./pages/Settings'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Auth = lazy(() => import('./pages/Auth'))

function RouteLoading() {
  return <div className="route-loading" role="status">Loading page...</div>
}

function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <div className="auth-page" role="status">Restoring your session...</div>

  return user ? <Outlet /> : <Navigate to="/auth" replace />
}

function PublicRoute() {
  const { user, loading } = useAuth()

  if (loading) return <div className="auth-page" role="status">Restoring your session...</div>

  return user ? <Navigate to="/" replace /> : <Auth />
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/auth" element={<PublicRoute />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="projects/:projectId" element={<ProjectDetails />} />
              <Route path="projects" element={<Projects />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="team" element={<Team />} />
              <Route path="settings" element={<Settings />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
