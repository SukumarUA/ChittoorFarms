import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // If already logged in as admin, redirect immediately to dashboard
  useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin');
    }
  }, [user, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      showToast('Please enter both email and password.', 'error');
      return;
    }

    if (email.trim().toLowerCase() !== (import.meta.env.VITE_ADMIN_EMAIL ?? '').toLowerCase()) {
      showToast('Access Denied. Only the designated administrator account is permitted.', 'error');
      return;
    }

    setIsLoggingIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        showToast('Successfully signed in as Admin!', 'success');
        navigate('/admin');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast(err.message || 'Authentication failed. Please verify credentials.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-logo">
          <Sprout size={48} className="logo-icon" style={{ margin: '0 auto 0.5rem auto' }} />
          <h2>Chittoor Farms</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Admin Panel Portal</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="loginEmail">Email Address</label>
            <input
              type="email"
              id="loginEmail"
              className="form-control"
              placeholder="e.g. admin@chittoorfarms.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="loginPassword">Password</label>
            <input
              type="password"
              id="loginPassword"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Verifying...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          🔒 Restricted Area. Authorized Access Only.
        </div>
      </div>
    </div>
  );
};
