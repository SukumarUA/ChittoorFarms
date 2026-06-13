import React, { useCallback, useEffect, useState } from 'react';
import { Phone, MapPin, CalendarDays, Scroll, X, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

const farmerImageFallback = '/CTRFLOGO.jpeg';
const useFarmerImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = farmerImageFallback;
};

interface Application {
  id: string;
  created_at: string;
  contact_name: string;
  phone: string;
  farmer_name: string | null;
  location: string;
  farm_type: string | null;
  district: string | null;
  mandal: string | null;
  village: string | null;
  pincode: string | null;
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
  const [activeTab, setActiveTab] = useState<'new' | 'contacted'>('new');

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .in('status', ['new', 'contacted'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApps(data || []);
    } catch (err) {
      console.error('Error fetching applications:', err);
      showToast('Failed to load farmer applications.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void Promise.resolve().then(fetchApplications);

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
  }, [fetchApplications]);

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
        newStatus === 'approved' || newStatus === 'rejected'
          ? prev.filter((item) => item.id !== app.id)
          : prev.map((item) => (item.id === app.id ? { ...item, status: newStatus } : item))
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
          farm_type: approveTarget.farm_type,
          district: approveTarget.district,
          mandal: approveTarget.mandal,
          village: approveTarget.village,
          pincode: approveTarget.pincode,
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

      setApps((prev) => prev.filter((item) => item.id !== approveTarget.id));
      setApproveTarget(null);
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

  const visibleApplications = apps.filter((app) => app.status === activeTab);
  const newCount = apps.filter((app) => app.status === 'new').length;
  const holdCount = apps.filter((app) => app.status === 'contacted').length;

  return (
    <div>
      <div className="application-page-heading">
        <div>
          <h2>Manage Farmer Partnership Applications</h2>
          <p>Review farmer partnership applications submitted from the Our Farms page.</p>
        </div>
        <div className="application-review-tabs" role="tablist" aria-label="Farmer application status">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'new'}
            className={activeTab === 'new' ? 'active' : ''}
            onClick={() => setActiveTab('new')}
          >
            New Applications <span>{newCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'contacted'}
            className={activeTab === 'contacted' ? 'active' : ''}
            onClick={() => setActiveTab('contacted')}
          >
            On Hold <span>{holdCount}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Loading applications...
        </div>
      ) : visibleApplications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          {activeTab === 'new' ? 'No new farmer applications.' : 'No applications are currently on hold.'}
        </div>
      ) : (
        <div className="farmer-application-grid">
          {visibleApplications.map((app) => (
            <article key={app.id} className={`farmer-application-card status-${app.status}`}>
              <div className="farmer-application-card-header">
                {app.photo_url ? (
                  <a href={app.photo_url} target="_blank" rel="noreferrer" className="farmer-application-photo-link">
                    <img className="farmer-application-photo" src={app.photo_url} alt={app.farmer_name || app.contact_name} onError={useFarmerImageFallback} />
                  </a>
                ) : (
                  <img className="farmer-application-photo" src={farmerImageFallback} alt="Chittoor Farms" />
                )}
                <div className="farmer-application-identity">
                  <div className="farmer-application-title-row">
                    <div>
                      <h3>{app.farmer_name || app.contact_name}</h3>
                      {app.farmer_name && <p>Contact: {app.contact_name}</p>}
                    </div>
                    <span className={`badge badge-${app.status}`}>{app.status === 'contacted' ? 'On Hold' : app.status}</span>
                  </div>
                  <div className="farmer-application-contact-row">
                    <a href={`tel:${app.phone}`}><Phone size={15} /> {app.phone}</a>
                    <span><MapPin size={15} /> {app.location}</span>
                  </div>
                </div>
              </div>

              <div className="farmer-application-details">
                <div className="farmer-application-detail">
                  <span>Submitted</span>
                  <strong>{formatDateTime(app.created_at)}</strong>
                </div>
                <div className="farmer-application-detail">
                  <span>Farm Type</span>
                  <strong>{app.farm_type || 'Not provided'}</strong>
                </div>
                <div className="farmer-application-detail">
                  <span>Farm Size</span>
                  <strong>{app.orchard_size ? `${app.orchard_size} Acres` : 'Not provided'}</strong>
                </div>
                <div className="farmer-application-detail">
                  <span>Farming Since</span>
                  <strong>{app.farming_since ? <><CalendarDays size={14} /> {app.farming_since}</> : 'Not provided'}</strong>
                </div>
              </div>

              <div className="farmer-application-varieties">
                <span>Produce / Breeds / Varieties</span>
                <p>{app.varieties_grown || 'Not provided'}</p>
              </div>

              <div className="farmer-application-story">
                <Scroll size={18} />
                <div>
                  <span>Farmer's Story</span>
                  <p>"{app.story}"</p>
                </div>
              </div>

              {app.farm_id && <div className="farmer-profile-created"><CheckCircle2 size={16} /> Farm profile created</div>}

              <div className="farmer-application-actions">
                <button
                  className="application-action application-action-accept"
                  onClick={() => handleStatusChange(app, 'approved')}
                  disabled={Boolean(app.farm_id)}
                >
                  <CheckCircle2 size={18} /> {app.farm_id ? 'Accepted' : 'Accept'}
                </button>
                <button
                  className="application-action application-action-hold"
                  onClick={() => handleStatusChange(app, app.status === 'contacted' ? 'new' : 'contacted')}
                  disabled={Boolean(app.farm_id)}
                >
                  <PauseCircle size={18} /> {app.status === 'contacted' ? 'Return to New' : 'Hold'}
                </button>
                <button
                  className="application-action application-action-reject"
                  onClick={() => handleStatusChange(app, 'rejected')}
                  disabled={app.status === 'rejected' || Boolean(app.farm_id)}
                >
                  <XCircle size={18} /> {app.status === 'rejected' ? 'Rejected' : 'Reject'}
                </button>
              </div>
            </article>
          ))}
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
                <img
                  className="approval-farmer-photo"
                  src={approveTarget.photo_url || farmerImageFallback}
                  alt={approveTarget.farmer_name || approveTarget.contact_name}
                  onError={useFarmerImageFallback}
                />
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
