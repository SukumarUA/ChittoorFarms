import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartContext';
import { SettingsProvider } from './context/SettingsContext';

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
import { NotFound } from './pages/NotFound';
import { PrivacyPolicy } from './pages/PrivacyPolicy';

// Admin Pages — lazy loaded so they're excluded from the public bundle
const Login       = lazy(() => import('./pages/admin/Login').then(m => ({ default: m.Login })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const Dashboard   = lazy(() => import('./pages/admin/Dashboard').then(m => ({ default: m.Dashboard })));
const Orders      = lazy(() => import('./pages/admin/Orders').then(m => ({ default: m.Orders })));
const Products    = lazy(() => import('./pages/admin/Products').then(m => ({ default: m.Products })));
const FarmsManager   = lazy(() => import('./pages/admin/FarmsManager').then(m => ({ default: m.FarmsManager })));
const VisitsManager  = lazy(() => import('./pages/admin/VisitsManager').then(m => ({ default: m.VisitsManager })));
const Applications   = lazy(() => import('./pages/admin/Applications').then(m => ({ default: m.Applications })));
const CMS            = lazy(() => import('./pages/admin/CMS').then(m => ({ default: m.CMS })));
const Payments       = lazy(() => import('./pages/admin/Payments').then(m => ({ default: m.Payments })));
const AdminReferrals = lazy(() => import('./pages/admin/AdminReferrals').then(m => ({ default: m.AdminReferrals })));
const AdminPromos    = lazy(() => import('./pages/admin/AdminPromos').then(m => ({ default: m.AdminPromos })));
const Customers      = lazy(() => import('./pages/admin/Customers').then(m => ({ default: m.Customers })));

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
        <SettingsProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Facing Pages */}
              <Route path="/" element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="shop" element={<Shop />} />
                <Route path="farms" element={<Farms />} />
                <Route path="about" element={<About />} />
                <Route path="privacy" element={<PrivacyPolicy />} />
              </Route>

              {/* Admin — lazy loaded, excluded from public bundle */}
              <Route path="/admin/login" element={<Suspense fallback={null}><Login /></Suspense>} />
              <Route path="/admin" element={<Suspense fallback={null}><AdminLayout /></Suspense>}>
                <Route index element={<Suspense fallback={null}><Dashboard /></Suspense>} />
                <Route path="orders" element={<Suspense fallback={null}><Orders /></Suspense>} />
                <Route path="payments" element={<Suspense fallback={null}><Payments /></Suspense>} />
                <Route path="products" element={<Suspense fallback={null}><Products /></Suspense>} />
                <Route path="farms" element={<Suspense fallback={null}><FarmsManager /></Suspense>} />
                <Route path="visits" element={<Suspense fallback={null}><VisitsManager /></Suspense>} />
                <Route path="applications" element={<Suspense fallback={null}><Applications /></Suspense>} />
                <Route path="cms" element={<Suspense fallback={null}><CMS /></Suspense>} />
                <Route path="referrals" element={<Suspense fallback={null}><AdminReferrals /></Suspense>} />
                <Route path="promos" element={<Suspense fallback={null}><AdminPromos /></Suspense>} />
                <Route path="customers" element={<Suspense fallback={null}><Customers /></Suspense>} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<PublicLayout />}>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
        </SettingsProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
