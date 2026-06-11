import React from 'react';
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
  PanelsTopLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const sectionTitles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/orders': 'Orders',
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

  return (
    <div className="admin-layout">
      {/* Sidebar navigation */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-logo">
            <Sprout className="logo-icon" style={{ color: 'var(--primary)' }} />
            <span>CF Admin Panel</span>
          </div>
        </div>

        <ul className="admin-sidebar-nav">
          <li>
            <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <ListOrdered size={18} />
              <span>Orders</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/products" className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <ShoppingBag size={18} />
              <span>Products</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/farms" className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <Home size={18} />
              <span>Partner Farms</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/visits" className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <CalendarDays size={18} />
              <span>Visit Bookings</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/cms" className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <PanelsTopLeft size={18} />
              <span>CMS</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/applications" className={({ isActive }) => (isActive ? 'admin-nav-link active' : 'admin-nav-link')}>
              <UserCheck size={18} />
              <span>Farmer Apps</span>
            </NavLink>
          </li>
        </ul>

        <div className="admin-sidebar-footer">
          <button className="btn btn-outline" onClick={handleLogout} style={{ width: '100%', display: 'flex', gap: '0.5rem', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <LogOut size={16} />
            <span>Sign Out</span>
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
