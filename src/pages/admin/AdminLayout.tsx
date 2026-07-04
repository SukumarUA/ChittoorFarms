import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  ListOrdered,
  CalendarDays,
  UserCheck,
  Home,
  LogOut,
  ChevronRight,
  Sprout,
  PanelsTopLeft,
  CreditCard,
  ChevronLeft,
  Share2,
  Percent,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;  // 15 minutes
const WARN_BEFORE_MS  = 60 * 1000;        // warn 60 s before logout

export const AdminLayout: React.FC = () => {
  const { user, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('cf-admin-sidebar-collapsed') === 'true');
  const [idleWarning, setIdleWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = () => {
    if (idleTimer.current)    clearTimeout(idleTimer.current);
    if (warnTimer.current)    clearTimeout(warnTimer.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const handleAutoSignOut = useCallback(async () => {
    clearAllTimers();
    setIdleWarning(false);
    await signOut();
    navigate('/admin/login');
  }, [signOut, navigate]);

  const resetIdleTimer = useCallback(() => {
    if (!user || !isAdmin) return;
    clearAllTimers();
    setIdleWarning(false);
    setCountdown(60);

    warnTimer.current = setTimeout(() => {
      setIdleWarning(true);
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) return 0;
          return c - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    idleTimer.current = setTimeout(handleAutoSignOut, IDLE_TIMEOUT_MS);
  }, [user, isAdmin, handleAutoSignOut]);

  // Start / restart timers on mount and when auth state changes
  useEffect(() => {
    if (!user || !isAdmin) return;
    resetIdleTimer();
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      clearAllTimers();
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
    };
  }, [user, isAdmin, resetIdleTimer]);

  const sectionTitles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/orders': 'Orders',
    '/admin/payments': 'Payments',
    '/admin/products': 'Products',
    '/admin/farms': 'Partner Farms',
    '/admin/visits': 'Visit Bookings',
    '/admin/applications': 'Farmer Applications',
    '/admin/cms': 'CMS',
    '/admin/referrals': 'Referrals',
    '/admin/promos': 'Promos',
  };
  const activeSection = sectionTitles[location.pathname] || 'Admin Workspace';

  // Show a clean loading state while verifying auth session
  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>🔒 Verifying credentials...</div>
        <p style={{ color: 'var(--text-muted)' }}>Checking admin session integrity</p>
      </div>
    );
  }

  // Auth Guard redirect
  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem('cf-admin-sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <div className={`admin-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar navigation */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-logo">
            <span className="admin-sidebar-label">CF Admin</span>
          </div>
          <button type="button" className="admin-sidebar-toggle" onClick={toggleSidebar} aria-label={isSidebarCollapsed ? 'Expand admin navigation' : 'Collapse admin navigation'} title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <ul className="admin-sidebar-nav">
          <li>
            <NavLink to="/admin" end title={isSidebarCollapsed ? 'Dashboard' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <LayoutDashboard size={18} />
              <span className="admin-sidebar-label">Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/orders" title={isSidebarCollapsed ? 'Orders' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <ListOrdered size={18} />
              <span className="admin-sidebar-label">Orders</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/payments" title={isSidebarCollapsed ? 'Payments' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <CreditCard size={18} />
              <span className="admin-sidebar-label">Payments</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/products" title={isSidebarCollapsed ? 'Products' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <ShoppingBag size={18} />
              <span className="admin-sidebar-label">Products</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/farms" title={isSidebarCollapsed ? 'Partner Farms' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <Home size={18} />
              <span className="admin-sidebar-label">Partner Farms</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/visits" title={isSidebarCollapsed ? 'Visit Bookings' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <CalendarDays size={18} />
              <span className="admin-sidebar-label">Visit Bookings</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/cms" title={isSidebarCollapsed ? 'CMS' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <PanelsTopLeft size={18} />
              <span className="admin-sidebar-label">CMS</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/applications" title={isSidebarCollapsed ? 'Farmer Applications' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <UserCheck size={18} />
              <span className="admin-sidebar-label">Farmer Apps</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/referrals" title={isSidebarCollapsed ? 'Referrals' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <Share2 size={18} />
              <span className="admin-sidebar-label">Referrals</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/promos" title={isSidebarCollapsed ? 'Promos' : undefined} className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <Percent size={18} />
              <span className="admin-sidebar-label">Promos</span>
            </NavLink>
          </li>
        </ul>

        <div className="admin-sidebar-footer">
          <button className="btn btn-outline admin-signout-button" onClick={handleLogout} title={isSidebarCollapsed ? 'Sign Out' : undefined}>
            <LogOut size={16} />
            <span className="admin-sidebar-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Inactivity warning banner */}
      {idleWarning && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: '#1a1a1a', color: '#fff', borderRadius: '10px',
          padding: '1rem 1.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: '1.2rem', fontSize: '0.95rem',
          border: '1px solid rgba(255,100,100,0.4)', minWidth: '320px',
        }}>
          <span style={{ fontSize: '1.3rem' }}>⏱️</span>
          <span>Session idle — signing out in <strong style={{ color: '#ff8a80' }}>{countdown}s</strong></span>
          <button
            type="button"
            onClick={resetIdleTimer}
            style={{ marginLeft: 'auto', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            Stay logged in
          </button>
        </div>
      )}

      {/* Main Admin Workspace Area */}
      <div className="admin-workspace">
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
            <span>Admin</span>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{activeSection}</span>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
            Active: <span style={{ color: 'var(--secondary)' }}>{user.email}</span>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
