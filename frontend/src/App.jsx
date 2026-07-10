import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import AnalyticsPage from './pages/AnalyticsPage';
import UsersPage from './pages/UsersPage';
import DepartmentsPage from './pages/DepartmentsPage';
import { Spinner } from './components/ui/Shared';
import { Menu } from 'lucide-react';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      {/* Mobile Header Bar */}
      <div className="mobile-topbar">
        <div className="mobile-logo">
          <img src="/voxo-logo.png" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} alt="Voxo Logo" />
          <span style={{ fontSize: '1rem', fontWeight: 800 }}>Mate</span>
        </div>
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile Drawer Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function TierGuard({ minTier, children }) {
  const { user } = useAuth();
  if (!user || user.role_tier > minTier) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/analytics" element={
          <TierGuard minTier={2}><AnalyticsPage /></TierGuard>
        } />
        <Route path="/users" element={
          <TierGuard minTier={2}><UsersPage /></TierGuard>
        } />
        <Route path="/departments" element={
          <TierGuard minTier={1}><DepartmentsPage /></TierGuard>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
