import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { ROLE_LABELS } from '../lib/constants';
import { relativeTime } from '../lib/format';
import type { Notification, Role } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { Avatar } from './ui';

const NAV_ITEMS: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  end?: boolean;
}[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/approvals', label: 'Action Center', icon: Inbox },
  { to: '/team', label: 'Team', icon: Users, roles: ['MANAGER', 'SENIOR_MANAGER', 'ADMIN'] },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/meetings', label: 'Meetings', icon: MessagesSquare },
  { to: '/insights', label: 'AI Insights', icon: Sparkles },
  { to: '/admin', label: 'Administration', icon: Settings, roles: ['ADMIN'] },
];

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/tasks': 'Tasks',
  '/approvals': 'Action Center',
  '/team': 'Team',
  '/reports': 'Reports',
  '/meetings': 'Meetings',
  '/insights': 'AI Insights',
  '/admin': 'Administration',
};

function notificationIcon(type: string) {
  switch (type) {
    case 'APPROVAL_REQUEST':
      return <Inbox size={15} />;
    case 'TASK_COMPLETED':
      return <CheckCircle2 size={15} />;
    case 'REWORK_REQUESTED':
      return <RefreshCw size={15} />;
    case 'EXTENSION_REQUEST':
    case 'EXTENSION_DECISION':
      return <CalendarClock size={15} />;
    case 'COMMENT':
      return <MessageSquare size={15} />;
    case 'RATING_RECEIVED':
      return <Star size={15} />;
    case 'TASK_ASSIGNED':
    case 'GROUP_UPDATE':
      return <ClipboardList size={15} />;
    default:
      return <Bell size={15} />;
  }
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [search, setSearch] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const approvals = useApi(() => api.approvals(), [location.pathname]);
  const notifications = useApi(() => api.notifications.list(), [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const role = user.role;
  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
  const actionCount = approvals.data?.total || 0;
  const unread = notifications.data?.unread || 0;

  const segment = `/${location.pathname.split('/')[1] || ''}`;
  let title = TITLES[segment] || 'Meridian';
  if (segment === '/tasks' && location.pathname !== '/tasks') title = 'Task detail';
  if (segment === '/meetings' && location.pathname !== '/meetings') title = 'Meeting intelligence';

  const scope =
    role === 'ADMIN'
      ? 'Organisation-wide administration'
      : role === 'SENIOR_MANAGER'
        ? `${user.departmentName || 'Department'} oversight`
        : role === 'MANAGER'
          ? `${user.fullName.split(' ')[0]}’s reporting team`
          : 'Your personal workspace';

  function openNotification(item: Notification) {
    void api.notifications.read(item.id).then(() => notifications.reload());
    setNotifOpen(false);
    if (item.meetingId) navigate(`/meetings/${item.meetingId}`);
    else if (item.taskId) navigate(`/tasks/${item.taskId}`);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/tasks?q=${encodeURIComponent(query)}` : '/tasks');
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Gauge size={19} strokeWidth={2.2} />
          </div>
          <div>
            <div className="brand-name">Meridian</div>
            <div className="brand-sub">Task intelligence</div>
          </div>
        </div>

        <div className="nav-section">Workspace</div>
        <nav className="nav">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const badge =
              item.to === '/approvals' && actionCount > 0 ? (
                <span className="nav-badge">{actionCount}</span>
              ) : null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} strokeWidth={2} />
                <span>{item.label}</span>
                {badge}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-scope">{scope}</div>
          <div className="sidebar-user">
            <Avatar name={user.fullName} color={user.avatarColor} size={34} />
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name">{user.fullName}</div>
              <div className="sidebar-user-role">{ROLE_LABELS[role]}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu-btn"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="topbar-context">
            <span className="topbar-eyebrow">{user.departmentName || 'Meridian'}</span>
            <span className="topbar-title">{title}</span>
          </div>
          <div className="topbar-spacer" />
          <form className="topbar-search" onSubmit={submitSearch}>
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
            />
          </form>
          {role !== 'ADMIN' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/tasks?new=1')}
              title="Create a task"
            >
              <Plus size={15} />
              New task
            </button>
          )}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              className="icon-btn"
              onClick={() => {
                setNotifOpen((open) => !open);
                setUserOpen(false);
                if (!notifOpen) notifications.reload();
              }}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {unread > 0 && <span className="dot" />}
            </button>
            {notifOpen && (
              <div className="dropdown">
                <div className="dropdown-head">
                  <h4>Notifications</h4>
                  {unread > 0 && <span className="badge badge-rose">{unread} new</span>}
                  <button
                    className="btn-link small"
                    style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--accent)' }}
                    onClick={() => {
                      void api.notifications.readAll().then(() => notifications.reload());
                    }}
                  >
                    Mark all read
                  </button>
                </div>
                <div className="dropdown-body">
                  {(notifications.data?.items || []).length === 0 && (
                    <div className="empty" style={{ padding: '30px 20px' }}>
                      <Bell size={18} />
                      <p>You’re all caught up.</p>
                    </div>
                  )}
                  {(notifications.data?.items || []).map((item) => (
                    <div
                      key={item.id}
                      className={`notif-item ${item.isRead ? '' : 'unread'}`}
                      onClick={() => openNotification(item)}
                    >
                      <span className="notif-icon">{notificationIcon(item.type)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="notif-title">{item.title}</div>
                        <div className="notif-body">{item.body}</div>
                        <div className="notif-time">{relativeTime(item.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }} ref={userRef}>
            <button
              className="icon-btn"
              onClick={() => {
                setUserOpen((open) => !open);
                setNotifOpen(false);
              }}
              aria-label="Account menu"
              style={{ padding: 3 }}
            >
              <Avatar name={user.fullName} color={user.avatarColor} size={30} />
            </button>
            {userOpen && (
              <div className="user-pop">
                <div style={{ padding: '8px 10px 10px' }}>
                  <div className="strong" style={{ fontSize: 13 }}>
                    {user.fullName}
                  </div>
                  <div className="muted tiny">{user.email}</div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>
                    {ROLE_LABELS[user.role]}
                  </div>
                </div>
                <div className="divider" />
                <button
                  onClick={() => {
                    setUserOpen(false);
                    logout();
                    navigate('/login');
                  }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
