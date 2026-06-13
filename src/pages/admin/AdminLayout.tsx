import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('cf-admin-sidebar-collapsed') === 'true');

  const sectionTitles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/orders': 'Orders',
    '/admin/payments': 'Payments',
    '/admin/products': 'Products',
    '/admin/farms': 'Partner Farms',
    '/admin/visits': 'Visit Bookings',
    '/admin/applications': 'Farmer Applications',
    '/admin/cms': 'CMS',
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
            <Sprout className="logo-icon" style={{ color: 'var(--primary)' }} />
            <span className="admin-sidebar-label">CF Admin Panel</span>
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
        </ul>

        <div className="admin-sidebar-footer">
          <button className="btn btn-outline admin-signout-button" onClick={handleLogout} title={isSidebarCollapsed ? 'Sign Out' : undefined}>
            <LogOut size={16} />
            <span className="admin-sidebar-label">Sign Out</span>
          </button>
        </div>
      </aside>

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
