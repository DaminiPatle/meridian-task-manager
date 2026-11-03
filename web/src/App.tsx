import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldAlert, Compass, ArrowLeft } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ApprovalsPage from './pages/ApprovalsPage';
import TeamPage from './pages/TeamPage';
import ReportsPage from './pages/ReportsPage';
import MeetingsPage from './pages/MeetingsPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import InsightsPage from './pages/InsightsPage';
import AdminPage from './pages/AdminPage';
import type { Role } from './lib/types';
import { useNavigate } from 'react-router-dom';

function Splash() {
  return (
    <div className="splash">
      <div className="splash-mark" />
      <div className="splash-text">Loading Meridian…</div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) return <AccessDenied roles={roles} />;
  return <>{children}</>;
}

function AccessDenied({ roles }: { roles: Role[] }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="card">
        <div className="empty" style={{ padding: '54px 24px' }}>
          <ShieldAlert size={30} />
          <h3>This area is outside your role</h3>
          <p>
            {user ? `${user.fullName} is signed in as ${user.role.replace(/_/g, ' ').toLowerCase()}. ` : ''}
            This page is limited to {roles.map((role) => role.replace(/_/g, ' ').toLowerCase()).join(', ')}.
            The API enforces the same restriction, so no data was loaded.
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-subtle btn-sm" onClick={() => navigate('/')}>
              <ArrowLeft size={13} /> Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <div className="card">
        <div className="empty" style={{ padding: '54px 24px' }}>
          <Compass size={30} />
          <h3>Page not found</h3>
          <p>The page you requested does not exist or has moved.</p>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
              Go to dashboard
            </button>
            <button className="btn btn-subtle btn-sm" onClick={() => navigate(-1)}>
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route
          path="/team"
          element={
            <RoleGate roles={['MANAGER', 'SENIOR_MANAGER', 'ADMIN']}>
              <TeamPage />
            </RoleGate>
          }
        />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/meetings/:id" element={<MeetingDetailPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route
          path="/admin"
          element={
            <RoleGate roles={['ADMIN']}>
              <AdminPage />
            </RoleGate>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
