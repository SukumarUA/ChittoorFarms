import React, { useEffect, useState } from 'react';
import { Phone, MapPin, CalendarDays, Scroll, X, CheckCircle2 } from 'lucide-react';
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
  photo_url: string | null;
  farm_id: string | null;
  status: 'new' | 'contacted' | 'approved' | 'rejected';
}

export const Applications: React.FC = () => {
  const { showToast } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState<Application | null>(null);
  const [farmName, setFarmName] = useState('');
  const [farmVarieties, setFarmVarieties] = useState('');
  const [farmActive, setFarmActive] = useState(true);
  const [isApproving, setIsApproving] = useState(false);

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

  const handleStatusChange = async (app: Application, newStatus: 'new' | 'contacted' | 'approved' | 'rejected') => {
    if (newStatus === 'approved' && !app.farm_id) {
      setApproveTarget(app);
      setFarmName(`${app.farmer_name || app.contact_name}'s Farm`);
      setFarmVarieties(app.varieties_grown || 'To be updated');
      setFarmActive(true);
      return;
    }

    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', app.id);

      if (error) throw error;

      setApps((prev) =>
        prev.map((item) => (item.id === app.id ? { ...item, status: newStatus } : item))
      );
      showToast(`Application status updated to ${newStatus.toUpperCase()}.`, 'success');
    } catch (err) {
      console.error('Error updating status:', err);
      showToast('Failed to update application status.', 'error');
    }
  };

  const handleApproveAndCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTarget || !farmName.trim() || !farmVarieties.trim()) return;

    setIsApproving(true);
    try {
      const { data: farm, error: farmError } = await supabase
        .from('farms')
        .insert([{
          farm_name: farmName.trim(),
          farmer_name: approveTarget.farmer_name || approveTarget.contact_name,
          phone: approveTarget.phone,
          location: approveTarget.location,
          varieties: farmVarieties.trim(),
          acres: approveTarget.orchard_size,
          since_year: approveTarget.farming_since,
          story: approveTarget.story,
          photo_url: approveTarget.photo_url,
          sort_order: 0,
          active: farmActive,
        }])
        .select('id')
        .single();

      if (farmError) throw farmError;

      const { error: appError } = await supabase
        .from('applications')
        .update({ status: 'approved', farm_id: farm.id })
        .eq('id', approveTarget.id);

      if (appError) throw appError;

      setApproveTarget(null);
      await fetchApplications();
      showToast(`Application approved and farm profile created as ${farmActive ? 'visible' : 'inactive'}.`, 'success');
    } catch (err) {
      console.error('Error approving farmer:', err);
      showToast('Failed to approve and create the farm profile.', 'error');
    } finally {
      setIsApproving(false);
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
                <th>Photo</th>
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

                  <td>
                    {app.photo_url ? (
                      <a href={app.photo_url} target="_blank" rel="noreferrer">
                        <img className="application-photo-thumb" src={app.photo_url} alt={app.farmer_name || app.contact_name} />
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)' }}>No photo</span>}
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
                        onChange={(e) => handleStatusChange(app, e.target.value as Application['status'])}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      {app.farm_id && <small style={{ color: 'var(--success)' }}>Farm profile created</small>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approveTarget && (
        <div className="modal-backdrop open" onClick={() => setApproveTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Approve and Create Farm Profile</h3>
              <button className="btn-icon" onClick={() => setApproveTarget(null)} aria-label="Close approval form"><X size={20} /></button>
            </div>
            <form onSubmit={handleApproveAndCreateFarm}>
              <div className="modal-body">
                {approveTarget.photo_url && (
                  <img className="approval-farmer-photo" src={approveTarget.photo_url} alt={approveTarget.farmer_name || approveTarget.contact_name} />
                )}
                <div className="form-group">
                  <label htmlFor="approvedFarmName">Farm Name *</label>
                  <input id="approvedFarmName" className="form-control" value={farmName} onChange={(e) => setFarmName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="approvedVarieties">Varieties Grown *</label>
                  <input id="approvedVarieties" className="form-control" value={farmVarieties} onChange={(e) => setFarmVarieties(e.target.value)} required />
                </div>
                <label className="farm-visibility-option">
                  <span>
                    <strong>Show on Our Farms</strong>
                    <small>Turn this off to create the profile without publishing it yet.</small>
                  </span>
                  <span className="toggle-switch">
                    <input type="checkbox" checked={farmActive} onChange={(e) => setFarmActive(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </span>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setApproveTarget(null)} disabled={isApproving}>Cancel</button>
                <button type="submit" className="btn btn-secondary" disabled={isApproving}>
                  <CheckCircle2 size={16} /> {isApproving ? 'Approving...' : 'Approve and Create Farm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
