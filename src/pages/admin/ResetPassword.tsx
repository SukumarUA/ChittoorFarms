import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isReady, setIsReady] = useState(false); // true once Supabase confirms token is valid

  const { showToast } = useToast();
  const navigate = useNavigate();

  // Supabase fires PASSWORD_RECOVERY event when user arrives via reset link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (password !== confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    setIsBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      showToast('Password updated! Please sign in with your new password.', 'success');
      await supabase.auth.signOut();
      navigate('/admin/login');
    } catch (err: any) {
      console.error('Reset error:', err);
      showToast(err.message || 'Failed to update password. The link may have expired.', 'error');
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
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Set New Password</p>
        </div>

        {!isReady ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Verifying reset link…
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                className="form-control"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                className="form-control"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={isBusy}
            >
              {isBusy ? 'Saving…' : 'Set New Password'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          🔒 Restricted Area. Authorized Access Only.
        </div>
      </div>
    </div>
  );
};
