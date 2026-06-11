import React, { useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Sprout, Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const { cartCount, setIsCartOpen } = useCart();
  const { isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const startPress = () => {
    isLongPress.current = false;
    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPressing(false);
      navigate('/admin');
    }, 3000);
  };

  const endPress = () => {
    setIsPressing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const isCurrentAdminPage = location.pathname.startsWith('/admin');

  return (
    <header className="navbar-header glassmorphism">
      <div className="container navbar-container">
        {/* Brand Logo */}
        <NavLink 
          to="/" 
          className="logo-link" 
          onClick={(e) => {
            if (isLongPress.current) {
              e.preventDefault();
              isLongPress.current = false;
            } else {
              setIsOpen(false);
            }
          }}
        >
          <div 
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onTouchCancel={endPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            {isPressing && (
              <svg 
                style={{ position: 'absolute', top: '-3px', left: '-3px', width: '42px', height: '42px', transform: 'rotate(-90deg)', pointerEvents: 'none', zIndex: 10 }}
              >
                <circle 
                  cx="21" 
                  cy="21" 
                  r="19" 
                  fill="none" 
                  stroke="var(--accent)" 
                  strokeWidth="3" 
                  strokeDasharray="120"
                  strokeDashoffset="120"
                  style={{
                    animation: 'logoProgress 3s linear forwards'
                  }}
                />
              </svg>
            )}
            <Sprout className="logo-icon" />
          </div>
          <span>Chittoor Farms</span>
        </NavLink>

        {/* Desktop/Mobile Navigation links */}
        <ul className={`nav-links ${isOpen ? 'open' : ''}`}>
          <li>
            <NavLink
              to="/"
              className={({ isActive }) => (isActive ? 'nav-item-link active' : 'nav-item-link')}
              onClick={() => setIsOpen(false)}
            >
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/shop"
              className={({ isActive }) => (isActive ? 'nav-item-link active' : 'nav-item-link')}
              onClick={() => setIsOpen(false)}
            >
              Shop
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/farms"
              className={({ isActive }) => (isActive ? 'nav-item-link active' : 'nav-item-link')}
              onClick={() => setIsOpen(false)}
            >
              Our Farms
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/about"
              className={({ isActive }) => (isActive ? 'nav-item-link active' : 'nav-item-link')}
              onClick={() => setIsOpen(false)}
            >
              About Us
            </NavLink>
          </li>
        </ul>

        {/* Toolbar actions */}
        <div className="navbar-actions">
          {/* Cart Icon (Not shown on admin panel pages) */}
          {!isCurrentAdminPage && (
            <button
              className="btn-icon cart-btn"
              onClick={() => setIsCartOpen(true)}
              aria-label="Open Cart"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          )}

          {/* Admin panel buttons */}
          {isAdmin ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!isCurrentAdminPage ? (
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => navigate('/admin')}
                  title="Admin Dashboard"
                >
                  <LayoutDashboard size={18} />
                </button>
              ) : (
                <button
                  className="btn btn-outline btn-icon"
                  onClick={() => navigate('/')}
                  title="Go to Public Site"
                >
                  <Sprout size={18} />
                </button>
              )}
              <button
                className="btn btn-danger btn-icon"
                onClick={handleLogout}
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : null}

          {/* Burger menu toggle */}
          <button
            className="mobile-nav-toggle btn-icon"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
};
