import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Team from './pages/Team'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'
import Auth from './pages/Auth'
import { useAuth } from './context/AuthContext'
import './App.css'

function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <div className="auth-page">Loading workspace...</div>

  return user ? <Outlet /> : <Navigate to="/auth" replace />
}

function PublicRoute() {
  const { user, loading } = useAuth()

  if (loading) return <div className="auth-page">Loading...</div>

  return user ? <Navigate to="/" replace /> : <Auth />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<PublicRoute />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
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
    </BrowserRouter>
  )
}

export default App
