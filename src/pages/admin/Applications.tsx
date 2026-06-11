import React, { useEffect, useState } from 'react';
import { Phone, MapPin, CalendarDays, Scroll } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface Application {
  id: string;
  created_at: string;
  contact_name: string;
  phone: string;
  farmer_name: string | null;
  location: string;
  orchard_size: number | null;
  farming_since: number | null;
  varieties_grown: string | null;
  story: string;
  status: 'new' | 'contacted' | 'approved' | 'rejected';
}

export const Applications: React.FC = () => {
  const { showToast } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApps(data || []);
    } catch (err) {
      console.error('Error fetching applications:', err);
      showToast('Failed to load farmer applications.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('apps-db-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => {
          fetchApplications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleStatusChange = async (id: string, newStatus: 'new' | 'contacted' | 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setApps((prev) =>
        prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
      );
      showToast(`Application status updated to ${newStatus.toUpperCase()}.`, 'success');
    } catch (err) {
      console.error('Error updating status:', err);
      showToast('Failed to update application status.', 'error');
    }
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
        <h2>Manage Farmer Partnership Applications</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Review farmer partnership applications submitted from the Our Farms page.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Loading applications...
        </div>
      ) : apps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No farmer applications received.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date Submitted</th>
                <th>Contact Name</th>
                <th>Phone</th>
                <th>Farmer Name</th>
                <th>Location</th>
                <th>Orchard Detail</th>
                <th>Varieties Grown</th>
                <th>Farmer's Story</th>
                <th style={{ width: '130px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id}>
                  {/* Date */}
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatDateTime(app.created_at)}
                  </td>

                  {/* Contact Name */}
                  <td style={{ fontWeight: 600 }}>{app.contact_name}</td>

                  {/* Phone */}
                  <td>
                    <a href={`tel:${app.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Phone size={12} />
                      <span>{app.phone}</span>
                    </a>
                  </td>

                  {/* Farmer Name */}
                  <td>{app.farmer_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Same as Contact</span>}</td>

                  {/* Location */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                      <span>{app.location}</span>
                    </div>
                  </td>

                  {/* Orchard details */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                      {app.orchard_size && (
                        <span>
                          <strong>Size:</strong> {app.orchard_size} Acres
                        </span>
                      )}
                      {app.farming_since && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <CalendarDays size={12} />
                          <span>Since {app.farming_since}</span>
                        </span>
                      )}
                      {!app.orchard_size && !app.farming_since && (
                        <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </div>
                  </td>

                  {/* Varieties */}
                  <td style={{ fontSize: '0.85rem' }}>{app.varieties_grown || 'N/A'}</td>

                  {/* Story */}
                  <td style={{ fontSize: '0.85rem', maxWidth: '250px', whiteSpace: 'normal' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'flex-start' }}>
                      <Scroll size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '0.15rem' }} />
                      <span style={{ fontStyle: 'italic' }}>"{app.story}"</span>
                    </div>
                  </td>

                  {/* Status Dropdown selector */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span className={`badge badge-${app.status}`} style={{ alignSelf: 'flex-start' }}>
                        {app.status}
                      </span>
                      <select
                        className="form-control"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '100%', height: 'auto' }}
                        value={app.status}
                        onChange={(e: any) => handleStatusChange(app.id, e.target.value)}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
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
