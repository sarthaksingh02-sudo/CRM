import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import DiscussionPage from './pages/DiscussionPage';
import AnalyticsPage from './pages/AnalyticsPage';
import UsersPage from './pages/UsersPage';
import DepartmentsPage from './pages/DepartmentsPage';
import BrandsPage from './pages/BrandsPage';
import { Spinner, Toast } from './components/ui/Shared';
import NotificationBell from './components/ui/NotificationBell';
import { Menu } from 'lucide-react';
import { useEffect, useRef } from 'react';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    let socket;
    let reconnectTimeout;

    const connect = () => {
      const defaultUrl = 'http://localhost:8001/api/v1';
      const baseUrl = import.meta.env.VITE_API_URL || defaultUrl;
      const hostname = window.location.hostname;
      let wsUrl;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProtocol}//127.0.0.1:8001/ws`;
      } else if (baseUrl.startsWith('/')) {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProtocol}//${window.location.host}/ws`;
      } else {
        try {
          const urlObj = new URL(baseUrl);
          const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${wsProtocol}//${urlObj.host}/ws`;
        } catch (e) {
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${wsProtocol}//${window.location.host}/ws`;
        }
      }

      console.log('Connecting to WebSocket:', wsUrl);
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket event received:', data);

          // Dispatch global custom event for components to listen and reload data
          const wsEvent = new CustomEvent('voxomate-ws-update', { detail: data });
          window.dispatchEvent(wsEvent);

          // Show Toast notification if applicable, but avoid sending it to the user who triggered it
          if (data.message && data.sender_id !== user.id) {
            setToast({
              message: data.message,
              type: data.type === 'TASK_CREATED' ? 'success' : 'info'
            });
          }
        } catch (err) {
          console.error('Error parsing WebSocket message content:', err);
        }
      };

      socket.onclose = (event) => {
        console.log('WebSocket connection closed. Will reconnect in 5 seconds...', event.reason);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      socket.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        socket.close();
      };
    };

    connect();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [user]);

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {/* Mobile Header Bar */}
      <div className="mobile-topbar">
        <div className="mobile-logo">
          <img src="/voxo-logo.png" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} alt="Voxo Logo" />
          <span style={{ fontSize: '1rem', fontWeight: 800 }}>Mate</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell />
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
        </div>
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
        <Route path="/discussion" element={<DiscussionPage />} />
        <Route path="/analytics" element={
          <TierGuard minTier={2}><AnalyticsPage /></TierGuard>
        } />
        <Route path="/users" element={
          <TierGuard minTier={2}><UsersPage /></TierGuard>
        } />
        <Route path="/departments" element={
          <TierGuard minTier={1}><DepartmentsPage /></TierGuard>
        } />
        <Route path="/brands" element={
          <TierGuard minTier={3}><BrandsPage /></TierGuard>
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
