import { Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './lib/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import MetricDetailPage from './pages/MetricDetailPage'
import DataPage from './pages/DataPage'
import ManageMetricsPage from './pages/ManageMetricsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/metrics/:id" element={<RequireAuth><MetricDetailPage /></RequireAuth>} />
      <Route path="/data" element={<RequireAuth><DataPage /></RequireAuth>} />
      <Route path="/manage" element={<RequireAuth><ManageMetricsPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
