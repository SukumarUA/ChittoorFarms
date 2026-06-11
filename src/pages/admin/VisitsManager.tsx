import React, { useEffect, useState } from 'react';
import { Phone, Calendar, Check, X, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface Visit {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  preferred_farm: string | null;
  preferred_date: string | null;
  group_size: string | null;
  purpose: string | null;
  message: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export const VisitsManager: React.FC = () => {
  const { showToast } = useToast();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (err) {
      console.error('Error fetching visits:', err);
      showToast('Failed to load visit requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('visits-db-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        () => {
          fetchVisits();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'pending' | 'confirmed' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setVisits((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v))
      );
      showToast(`Visit status updated to ${newStatus}.`, 'success');
    } catch (err) {
      console.error('Update status error:', err);
      showToast('Failed to update visit status.', 'error');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Any Date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Manage Farm Visit Bookings</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Review tourist and media visit requests submitted from the About page.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Loading visit bookings...
        </div>
      ) : visits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No farm visit bookings found.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Booking Date</th>
                <th>Visitor Name</th>
                <th>Phone</th>
                <th>Preferred Farm</th>
                <th>Visit Date</th>
                <th>Group Size</th>
                <th>Purpose</th>
                <th>Notes / Message</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => (
                <tr key={visit.id}>
                  {/* Requested At */}
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatDateTime(visit.created_at)}
                  </td>

                  {/* Visitor details */}
                  <td style={{ fontWeight: 600 }}>{visit.name}</td>
                  <td>
                    <a href={`tel:${visit.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Phone size={12} />
                      <span>{visit.phone}</span>
                    </a>
                  </td>

                  {/* Farm Preference */}
                  <td>{visit.preferred_farm || <span style={{ color: 'var(--text-muted)' }}>Any Farm</span>}</td>

                  {/* Visit Date */}
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                      <Calendar size={12} />
                      <span>{formatDate(visit.preferred_date)}</span>
                    </span>
                  </td>

                  {/* Group info */}
                  <td>{visit.group_size || 'N/A'}</td>

                  {/* Purpose */}
                  <td>{visit.purpose || 'N/A'}</td>

                  {/* Message */}
                  <td style={{ fontSize: '0.85rem', maxWidth: '200px', whiteSpace: 'normal' }}>
                    {visit.message || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No message</span>}
                  </td>

                  {/* Status Badge */}
                  <td>
                    <span className={`badge badge-${visit.status}`}>{visit.status}</span>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="admin-table-actions">
                      {visit.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', gap: '0.2rem' }}
                            onClick={() => handleUpdateStatus(visit.id, 'confirmed')}
                          >
                            <Check size={12} />
                            <span>Confirm</span>
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', gap: '0.2rem', color: 'var(--danger)', borderColor: 'var(--border-color)' }}
                            onClick={() => handleUpdateStatus(visit.id, 'cancelled')}
                          >
                            <X size={12} />
                            <span>Cancel</span>
                          </button>
                        </>
                      )}

                      {visit.status !== 'pending' && (
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', gap: '0.2rem' }}
                          onClick={() => handleUpdateStatus(visit.id, 'pending')}
                        >
                          <RotateCcw size={12} />
                          <span>Re-open</span>
                        </button>
                      )}
                    </div>
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
