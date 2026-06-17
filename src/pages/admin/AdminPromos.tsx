import React, { useEffect, useState } from 'react';
import { Plus, ToggleLeft, ToggleRight, Percent } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_pct: number;
  requires_returning_customer: boolean;
  is_active: boolean;
  uses_count: number;
  created_at: string;
}

export const AdminPromos: React.FC = () => {
  const { showToast } = useToast();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPct, setNewPct] = useState('5');
  const [newReturning, setNewReturning] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { showToast('Failed to load promo codes', 'error'); }
    else { setCodes(data ?? []); }
    setLoading(false);
  };

  useEffect(() => { void fetchCodes(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) { showToast('Code is required', 'error'); return; }
    const pct = parseFloat(newPct);
    if (isNaN(pct) || pct <= 0 || pct > 100) { showToast('Discount % must be between 1 and 100', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('promo_codes').insert({
      code: newCode.trim().toUpperCase(),
      description: newDesc.trim() || null,
      discount_pct: pct,
      requires_returning_customer: newReturning,
    });
    setSaving(false);
    if (error) {
      showToast(error.message.includes('unique') ? 'That code already exists.' : 'Failed to create code.', 'error');
    } else {
      showToast('Promo code created!', 'success');
      setNewCode(''); setNewDesc(''); setNewPct('5'); setNewReturning(false); setShowForm(false);
      void fetchCodes();
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('promo_codes').update({ is_active: !current }).eq('id', id);
    if (error) { showToast('Failed to update', 'error'); }
    else { setCodes((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !current } : c)); }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Promo Codes</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage discount codes. <strong>REORDER</strong> is pre-seeded for returning customers (5% off).
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> New Code
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem' }}>Create Promo Code</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Code *</label>
              <input className="form-control" placeholder="e.g. SUMMER20" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
            </div>
            <div className="form-group">
              <label>Discount %</label>
              <input type="number" min="1" max="100" className="form-control" value={newPct} onChange={(e) => setNewPct(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input className="form-control" placeholder="e.g. Summer sale discount" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="checkbox"
              id="requireReturning"
              checked={newReturning}
              onChange={(e) => setNewReturning(e.target.checked)}
              style={{ width: 'auto', accentColor: 'var(--secondary)' }}
            />
            <label htmlFor="requireReturning" style={{ margin: 0, cursor: 'pointer' }}>
              Requires returning customer (phone must exist in previous orders this year)
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-secondary" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : codes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Percent size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <p>No promo codes yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Discount</th>
                <th>Returning Only</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Created</th>
                <th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <td><code style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.code}</code></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{c.description ?? '—'}</td>
                  <td><strong>{c.discount_pct}%</strong></td>
                  <td style={{ textAlign: 'center' }}>
                    {c.requires_returning_customer ? (
                      <span style={{ color: 'var(--secondary)', fontWeight: 600, fontSize: '0.82rem' }}>Yes</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No</span>
                    )}
                  </td>
                  <td>{c.uses_count}</td>
                  <td>
                    <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, background: c.is_active ? 'rgba(34,139,34,0.12)' : 'rgba(160,160,160,0.15)', color: c.is_active ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button className="btn-icon" onClick={() => toggleActive(c.id, c.is_active)} title={c.is_active ? 'Deactivate' : 'Activate'}>
                      {c.is_active ? <ToggleRight size={22} color="var(--primary)" /> : <ToggleLeft size={22} color="var(--text-muted)" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
