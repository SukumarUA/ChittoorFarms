import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // If already logged in as admin, redirect immediately to dashboard
  useEffect(() => {
    if (user && isAdmin) navigate('/admin');
  }, [user, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Please enter both email and password.', 'error');
      return;
    }
    setIsBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      if (data.user) {
        navigate('/admin');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast(err.message || 'Authentication failed. Please verify your credentials.', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-logo">
          <img src="/CTRFLOGO.jpeg" alt="Chittoor Farms" className="logo-icon" style={{ objectFit: 'cover', padding: 0, width: 64, height: 64, margin: '0 auto 0.5rem auto' }} />
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
              placeholder="your@email.com"
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
            disabled={isBusy}
          >
            {isBusy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          🔒 Restricted Area. Authorized Access Only.
        </div>
      </div>
    </div>
  );
};
