import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

type Mode = 'login' | 'forgot';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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
        // isAdmin check happens in AuthContext via app_metadata
        // AdminLayout will redirect non-admins away
        navigate('/admin');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast(err.message || 'Authentication failed. Please verify your credentials.', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Please enter your email address.', 'error');
      return;
    }
    setIsBusy(true);
    try {
      // Only allow reset for emails already registered as admins in Supabase
      const { data: isAdminEmail, error: rpcError } = await supabase.rpc('is_admin_email', {
        p_email: email.trim().toLowerCase(),
      });
      if (rpcError) throw rpcError;
      if (!isAdminEmail) {
        showToast('This email is not registered as an admin.', 'error');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/admin/reset-password` }
      );
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      console.error('Reset error:', err);
      showToast(err.message || 'Failed to send reset email. Please try again.', 'error');
    } finally {
      setIsBusy(false);
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

        {/* ── LOGIN MODE ── */}
        {mode === 'login' && (
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
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('forgot'); setResetSent(false); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'underline',
                }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {/* ── FORGOT PASSWORD MODE ── */}
        {mode === 'forgot' && !resetSent && (
          <form onSubmit={handleForgotPassword}>
            <p style={{ fontSize: '0.87rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Enter your admin email and we'll send a password reset link.
            </p>
            <div className="form-group">
              <label htmlFor="resetEmail">Email Address</label>
              <input
                type="email"
                id="resetEmail"
                className="form-control"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={isBusy}
            >
              {isBusy ? 'Sending…' : 'Send Reset Link'}
            </button>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'underline',
                }}
              >
                ← Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ── RESET EMAIL SENT ── */}
        {mode === 'forgot' && resetSent && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📬</div>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Check your inbox</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              A password reset link has been sent to <strong>{email}</strong>. Click the link in the email to set a new password.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%' }}
              onClick={() => { setMode('login'); setResetSent(false); }}
            >
              Back to sign in
            </button>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          🔒 Restricted Area. Authorized Access Only.
        </div>
      </div>
    </div>
  );
};
