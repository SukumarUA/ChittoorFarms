import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartContext';

// Layout & Global Components
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { WhatsAppWidget } from './components/WhatsAppWidget';

// Public Pages
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { Farms } from './pages/Farms';
import { About } from './pages/About';

// Admin Pages
import { Login } from './pages/admin/Login';
import { AdminLayout } from './pages/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { Orders } from './pages/admin/Orders';
import { Products } from './pages/admin/Products';
import { FarmsManager } from './pages/admin/FarmsManager';
import { VisitsManager } from './pages/admin/VisitsManager';
import { Applications } from './pages/admin/Applications';

// Public Layout Wrapper
const PublicLayout: React.FC = () => {
  return (
    <div className="layout-wrapper">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppWidget />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Facing Pages */}
              <Route path="/" element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="shop" element={<Shop />} />
                <Route path="farms" element={<Farms />} />
                <Route path="about" element={<About />} />
              </Route>

              {/* Admin login */}
              <Route path="/admin/login" element={<Login />} />

              {/* Guarded Admin Dashboard */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="orders" element={<Orders />} />
                <Route path="products" element={<Products />} />
                <Route path="farms" element={<FarmsManager />} />
                <Route path="visits" element={<VisitsManager />} />
                <Route path="applications" element={<Applications />} />
              </Route>

              {/* Catch-all Redirect */}
              <Route path="*" element={<Home />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
