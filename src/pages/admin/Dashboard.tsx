import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  IndianRupee,
  CalendarDays,
  UserCheck,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface Stats {
  pendingOrders: number;
  totalRevenue: number;
  newVisits: number;
  pendingApps: number;
  lowStockProducts: number;
}

interface RecentOrder {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  total: number;
  items: Array<{ name: string; quantity: number; unit: string }>;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
}

interface Settings {
  hero_heading: string;
  hero_subtext: string;
  banner_img_url: string;
  wa_number: string;
  notice_board: string;
  team: TeamMember[];
  categories: string[];
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [stats, setStats] = useState<Stats>({
    pendingOrders: 0,
    totalRevenue: 0,
    newVisits: 0,
    pendingApps: 0,
    lowStockProducts: 0,
  });

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [settings, setSettings] = useState<Settings>({
    hero_heading: '',
    hero_subtext: '',
    banner_img_url: '',
    wa_number: '',
    notice_board: '',
    team: [],
    categories: [],
  });

  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Stats Loader
  const loadStatsAndOrders = useCallback(async () => {
    try {
      // 1. Pending orders count
      const { count: pendingCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 2. Total revenue sum
      const { data: fulfilledOrders } = await supabase
        .from('orders')
        .select('total')
        .eq('status', 'fulfilled');
      const revenue = fulfilledOrders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;

      // 3. New visits count
      const { count: visitsCount } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 4. Pending applications count (status is 'new')
      const { count: appsCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');

      // 5. Low-stock products count (active = true, stock <= 5)
      const { count: lowStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .lte('stock', 5);

      setStats({
        pendingOrders: pendingCount || 0,
        totalRevenue: revenue,
        newVisits: visitsCount || 0,
        pendingApps: appsCount || 0,
        lowStockProducts: lowStockCount || 0,
      });

      // Fetch 5 most recent pending orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, created_at, customer_name, phone, total, items')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentOrders((ordersData as any[]) || []);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Settings Loader
  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('hero_heading, hero_subtext, banner_img_url, wa_number, notice_board, team, categories')
        .eq('id', 'main')
        .single();

      if (error) throw error;
      if (data) {
        setSettings({
          hero_heading: data.hero_heading || '',
          hero_subtext: data.hero_subtext || '',
          banner_img_url: data.banner_img_url || '',
          wa_number: data.wa_number || '',
          notice_board: data.notice_board || '',
          team: Array.isArray(data.team) ? data.team : [],
          categories: Array.isArray(data.categories) ? data.categories : [],
        });
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatsAndOrders();
    loadSettings();

    // Set up Real-Time DB listener to auto-refresh statistics and recent orders
    const subscription = supabase
      .channel('dashboard-db-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          loadStatsAndOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadStatsAndOrders, loadSettings]);

  // Settings Save Handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    try {
      const { error } = await supabase
        .from('settings')
        .update({
          hero_heading: settings.hero_heading.trim(),
          hero_subtext: settings.hero_subtext.trim(),
          banner_img_url: settings.banner_img_url.trim(),
          wa_number: settings.wa_number.trim(),
          notice_board: settings.notice_board.trim(),
          team: settings.team,
          categories: settings.categories,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'main');

      if (error) throw error;
      showToast('Site Settings updated successfully!', 'success');
    } catch (err) {
      console.error('Error saving settings:', err);
      showToast('Failed to save settings. Please try again.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Team Member modification helpers
  const handleTeamMemberChange = (index: number, field: keyof TeamMember, value: string) => {
    const updatedTeam = [...settings.team];
    updatedTeam[index] = { ...updatedTeam[index], [field]: value };
    setSettings({ ...settings, team: updatedTeam });
  };

  const handleAddTeamMember = () => {
    setSettings({
      ...settings,
      team: [...settings.team, { name: '', role: '', bio: '' }],
    });
  };

  const handleRemoveTeamMember = (index: number) => {
    const updatedTeam = settings.team.filter((_, idx) => idx !== index);
    setSettings({ ...settings, team: updatedTeam });
  };

  const handleAddCategory = () => {
    const val = newCategory.trim();
    if (!val) return;
    if (settings.categories.includes(val)) {
      showToast('Category already exists.', 'warning');
      return;
    }
    setSettings({
      ...settings,
      categories: [...settings.categories, val],
    });
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    setSettings({
      ...settings,
      categories: settings.categories.filter((c) => c !== cat),
    });
  };

  return (
    <div>
      {/* Metric Cards Grid */}
      <section className="admin-stats-grid">
        <div className="stat-card" onClick={() => navigate('/admin/orders')}>
          <div className="stat-header">
            <span className="stat-label">Pending Orders</span>
            <Package size={20} className="stat-icon" />
          </div>
          <div className="stat-value">{stats.pendingOrders}</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/orders')}>
          <div className="stat-header">
            <span className="stat-label">Total Revenue</span>
            <IndianRupee size={20} className="stat-icon" style={{ color: 'var(--success)' }} />
          </div>
          <div className="stat-value">₹{stats.totalRevenue}</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/visits')}>
          <div className="stat-header">
            <span className="stat-label">New Visit Bookings</span>
            <CalendarDays size={20} className="stat-icon" style={{ color: 'var(--secondary)' }} />
          </div>
          <div className="stat-value">{stats.newVisits}</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/applications')}>
          <div className="stat-header">
            <span className="stat-label">Pending Apps</span>
            <UserCheck size={20} className="stat-icon" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="stat-value">{stats.pendingApps}</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/products')}>
          <div className="stat-header">
            <span className="stat-label">Low-Stock Items</span>
            <AlertTriangle size={20} className="stat-icon" style={{ color: 'var(--danger)' }} />
          </div>
          <div className="stat-value">{stats.lowStockProducts}</div>
        </div>
      </section>

      {/* Dashboard Sub-layouts */}
      <div className="dashboard-columns">
        {/* Recent Orders List */}
        <div className="dashboard-panel">
          <h2>Recent Pending Orders</h2>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading recent orders...
            </div>
          ) : recentOrders.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              🎉 No pending orders to display!
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600 }}>{order.customer_name}</td>
                      <td>
                        <a href={`tel:${order.phone}`}>{order.phone}</a>
                      </td>
                      <td>
                        <div className="order-items-list">
                          {order.items.map((item, i) => (
                            <div key={i} className="order-item-row">
                              <span>{item.name} × {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--secondary)' }}>
                        ₹{order.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Global Settings Editor */}
        <div className="dashboard-panel">
          <h2>Edit Site Settings</h2>
          {settingsLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading settings data...
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="settingsHeading">Hero Main Headline</label>
                <input
                  type="text"
                  id="settingsHeading"
                  className="form-control"
                  value={settings.hero_heading}
                  onChange={(e) => setSettings({ ...settings, hero_heading: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="settingsSubtext">Hero Subtitle</label>
                <textarea
                  id="settingsSubtext"
                  className="form-control"
                  value={settings.hero_subtext}
                  onChange={(e) => setSettings({ ...settings, hero_subtext: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="settingsBannerImg">Hero Background Image URL</label>
                <input
                  type="url"
                  id="settingsBannerImg"
                  className="form-control"
                  value={settings.banner_img_url}
                  onChange={(e) => setSettings({ ...settings, banner_img_url: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="settingsWa">WhatsApp Operational Number</label>
                <input
                  type="text"
                  id="settingsWa"
                  className="form-control"
                  placeholder="Digits only, e.g. 919876543210"
                  value={settings.wa_number}
                  onChange={(e) => setSettings({ ...settings, wa_number: e.target.value.replace(/\D/g, '') })}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  * Leave completely blank to hide the WhatsApp CTA button from the landing page.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="settingsNotice">Notice Board / Farm Updates</label>
                <textarea
                  id="settingsNotice"
                  className="form-control"
                  placeholder="Enter notice board updates (separate multiple updates with newlines)"
                  value={settings.notice_board}
                  onChange={(e) => setSettings({ ...settings, notice_board: e.target.value })}
                  rows={4}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  * Enter announcements or updates to display on the Notice Board section of the home page.
                </span>
              </div>

              {/* Categories Editor Subsection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Manage Product Categories</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Coconuts"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ padding: '0.5rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddCategory}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {settings.categories.map((cat) => (
                    <span
                      key={cat}
                      className="badge"
                      style={{
                        background: 'var(--secondary-light)',
                        color: 'var(--secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Remove Category"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Team Editor Subsection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>About Team Roster</label>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', gap: '0.25rem' }}
                    onClick={handleAddTeamMember}
                  >
                    <Plus size={12} />
                    <span>Add Member</span>
                  </button>
                </div>

                <div className="team-editor-list">
                  {settings.team.map((member, idx) => (
                    <div key={idx} className="team-editor-item">
                      <button
                        type="button"
                        className="team-editor-remove"
                        onClick={() => handleRemoveTeamMember(idx)}
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Member Name"
                          value={member.name}
                          onChange={(e) => handleTeamMemberChange(idx, 'name', e.target.value)}
                          required
                          style={{ padding: '0.5rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Member Role (e.g. Chief Orchardist)"
                          value={member.role}
                          onChange={(e) => handleTeamMemberChange(idx, 'role', e.target.value)}
                          required
                          style={{ padding: '0.5rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <textarea
                          className="form-control"
                          placeholder="Short Bio..."
                          value={member.bio}
                          onChange={(e) => handleTeamMemberChange(idx, 'bio', e.target.value)}
                          rows={2}
                          required
                          style={{ padding: '0.5rem' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                disabled={isSavingSettings}
                style={{ width: '100%', display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}
              >
                <Save size={16} />
                <span>{isSavingSettings ? 'Saving Changes...' : 'Save Site Settings'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
