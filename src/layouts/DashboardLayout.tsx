import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { useAuth } from '../context/useAuth'

function DashboardLayout() {
  const { user } = useAuth()

  return (
    <div className="app-layout" key={user?.id ?? 'anonymous'}>
      <Sidebar />
      <main className="main-content">
        <Header />
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default DashboardLayout
