import React, { useEffect, useState } from 'react';
import { Phone, Calendar, Check, X, RotateCcw, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { esc, logoRow, footer, wrapHtml, openPrint } from '../../lib/printUtils';

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

  const printConfirmation = (visit: Visit) => {
    const body = `
      ${logoRow('Visit Confirmation', `#${esc(visit.id.slice(0, 8).toUpperCase())}`)}
      <p style="margin-bottom:14px;color:#15803d;font-weight:600;font-size:1rem">✓ Your farm visit has been confirmed!</p>
      <div class="info-grid">
        <div class="info-box">
          <div class="lbl">Visitor</div>
          <div class="val">${esc(visit.name)}</div>
          <div class="sub">📞 ${esc(visit.phone)}</div>
        </div>
        <div class="info-box">
          <div class="lbl">Visit Details</div>
          <div class="val">${esc(visit.preferred_date ? formatDate(visit.preferred_date) : 'Date to be confirmed')}</div>
          <div class="sub">Farm: ${esc(visit.preferred_farm || 'Any Chittoor Farm')}</div>
          <div class="sub">Group: ${esc(visit.group_size || 'Not specified')}</div>
        </div>
      </div>
      ${visit.purpose ? `<div class="info-box" style="margin-top:10px"><div class="lbl">Purpose</div><div class="val">${esc(visit.purpose)}</div></div>` : ''}
      ${visit.message ? `<div class="info-box" style="margin-top:10px"><div class="lbl">Notes</div><div class="val" style="font-weight:400;font-style:italic">${esc(visit.message)}</div></div>` : ''}
      <p style="margin-top:20px;font-size:0.82rem;color:#374151">Please carry this slip on arrival. Contact us at chittoorfarms.in if you need to reschedule.</p>
      <div class="sig-block">
        <div class="sig-line"><div class="line"></div><div class="label">Farm Coordinator Sign</div></div>
        <div class="sig-line"><div class="line"></div><div class="label">Date &amp; Time of Arrival</div></div>
      </div>
      ${footer()}`;
    openPrint(wrapHtml(`Visit Confirmation – ${visit.name}`, body));
  };

  const printDailySchedule = () => {
    const confirmed = visits.filter((v) => v.status === 'confirmed').sort((a, b) => {
      const da = a.preferred_date || '9999';
      const db = b.preferred_date || '9999';
      return da < db ? -1 : da > db ? 1 : 0;
    });
    if (!confirmed.length) return;
    const rows = confirmed.map((v, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(v.preferred_date ? formatDate(v.preferred_date) : 'TBD')}</td>
        <td><strong>${esc(v.name)}</strong></td>
        <td>${esc(v.phone)}</td>
        <td>${esc(v.preferred_farm || 'Any')}</td>
        <td>${esc(v.group_size || '—')}</td>
        <td style="font-size:0.78rem">${esc(v.purpose || '—')}</td>
        <td style="width:60px"></td>
      </tr>`).join('');
    const body = `
      ${logoRow('Visitor Schedule', new Date().toLocaleDateString('en-IN'))}
      <p style="margin-bottom:10px;color:#374151">Confirmed visits: <strong>${confirmed.length}</strong></p>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Visitor</th><th>Phone</th><th>Farm</th><th>Group</th><th>Purpose</th><th>✓</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${footer()}`;
    openPrint(wrapHtml('Visitor Schedule', body));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Manage Farm Visit Bookings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Review tourist and media visit requests submitted from the About page.
          </p>
        </div>
        <button
          className="btn btn-outline"
          style={{ display: 'flex', gap: '0.4rem' }}
          onClick={printDailySchedule}
          disabled={visits.filter((v) => v.status === 'confirmed').length === 0}
          title="Print confirmed visitor schedule"
        >
          <Printer size={16} /> Visitor Schedule
        </button>
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

                      {visit.status === 'confirmed' && (
                        <button
                          className="btn-icon"
                          onClick={() => printConfirmation(visit)}
                          title="Print booking confirmation slip"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Printer size={15} />
                        </button>
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
