import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
}

interface SiteSettings {
  hero_heading: string;
  hero_subtext: string;
  banner_img_url: string;
  wa_number: string;
  notice_board: string;
  team: TeamMember[];
  categories: string[];
}

const emptySettings: SiteSettings = {
  hero_heading: '',
  hero_subtext: '',
  banner_img_url: '',
  wa_number: '',
  notice_board: '',
  team: [],
  categories: [],
};

export const CMS: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SiteSettings>(emptySettings);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('hero_heading, hero_subtext, banner_img_url, wa_number, notice_board, team, categories')
        .eq('id', 'main')
        .single();

      if (error) throw error;
      setSettings({
        hero_heading: data.hero_heading || '',
        hero_subtext: data.hero_subtext || '',
        banner_img_url: data.banner_img_url || '',
        wa_number: data.wa_number || '',
        notice_board: data.notice_board || '',
        team: Array.isArray(data.team) ? data.team : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
      });
    } catch (error) {
      console.error('Error loading CMS settings:', error);
      showToast('Could not load site content.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void Promise.resolve().then(loadSettings);
  }, [loadSettings]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
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
      showToast('CMS content saved successfully.', 'success');
    } catch (error) {
      console.error('Error saving CMS settings:', error);
      showToast('Failed to save CMS content.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const team = [...settings.team];
    team[index] = { ...team[index], [field]: value };
    setSettings({ ...settings, team });
  };

  const addCategory = () => {
    const category = newCategory.trim();
    if (!category) return;
    if (settings.categories.includes(category)) {
      showToast('Category already exists.', 'warning');
      return;
    }
    setSettings({ ...settings, categories: [...settings.categories, category] });
    setNewCategory('');
  };

  if (loading) return <div className="admin-empty-state">Loading CMS content...</div>;

  return (
    <div className="cms-page">
      <div className="cms-page-heading">
        <div>
          <h1>Content Management</h1>
          <p>Manage homepage content, notices, product categories, and the About team.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="cms-form">
        <section className="dashboard-panel cms-section">
          <h2>Homepage</h2>
          <div className="form-group"><label htmlFor="cmsHeading">Hero Main Headline</label><input id="cmsHeading" className="form-control" value={settings.hero_heading} onChange={(e) => setSettings({ ...settings, hero_heading: e.target.value })} required /></div>
          <div className="form-group"><label htmlFor="cmsSubtext">Hero Subtitle</label><textarea id="cmsSubtext" className="form-control" value={settings.hero_subtext} onChange={(e) => setSettings({ ...settings, hero_subtext: e.target.value })} rows={4} required /></div>
          <div className="form-group"><label htmlFor="cmsBanner">Hero Background Image URL</label><input type="url" id="cmsBanner" className="form-control" value={settings.banner_img_url} onChange={(e) => setSettings({ ...settings, banner_img_url: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="cmsWhatsapp">WhatsApp Operational Number</label><input id="cmsWhatsapp" className="form-control" placeholder="Digits only, e.g. 919876543210" value={settings.wa_number} onChange={(e) => setSettings({ ...settings, wa_number: e.target.value.replace(/\D/g, '') })} /><small>Leave blank to hide the WhatsApp calls to action.</small></div>
          <div className="form-group"><label htmlFor="cmsNotices">Notice Board / Farm Updates</label><textarea id="cmsNotices" className="form-control" placeholder="One notice per line" value={settings.notice_board} onChange={(e) => setSettings({ ...settings, notice_board: e.target.value })} rows={6} /><small>Enter one rotating notice per line. Use a label followed by a colon for a notice heading.</small></div>
        </section>

        <section className="dashboard-panel cms-section">
          <h2>Product Categories</h2>
          <div className="cms-add-row">
            <input className="form-control" placeholder="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <button type="button" className="btn btn-secondary" onClick={addCategory}><Plus size={16} /> Add</button>
          </div>
          <div className="cms-category-list">
            {settings.categories.map((category) => (
              <span key={category} className="cms-category-chip">
                {category}
                <button type="button" onClick={() => setSettings({ ...settings, categories: settings.categories.filter((item) => item !== category) })} aria-label={`Remove ${category}`}><X size={13} /></button>
              </span>
            ))}
          </div>
        </section>

        <section className="dashboard-panel cms-section">
          <div className="cms-section-header">
            <h2>About Team</h2>
            <button type="button" className="btn btn-outline" onClick={() => setSettings({ ...settings, team: [...settings.team, { name: '', role: '', bio: '' }] })}><Plus size={15} /> Add Member</button>
          </div>
          <div className="team-editor-list">
            {settings.team.map((member, index) => (
              <div key={index} className="team-editor-item">
                <button type="button" className="team-editor-remove" onClick={() => setSettings({ ...settings, team: settings.team.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remove ${member.name || 'team member'}`}><Trash2 size={15} /></button>
                <div className="form-row">
                  <div className="form-group"><label>Name</label><input className="form-control" value={member.name} onChange={(e) => updateTeamMember(index, 'name', e.target.value)} required /></div>
                  <div className="form-group"><label>Role</label><input className="form-control" value={member.role} onChange={(e) => updateTeamMember(index, 'role', e.target.value)} required /></div>
                </div>
                <div className="form-group"><label>Bio</label><textarea className="form-control" value={member.bio} onChange={(e) => updateTeamMember(index, 'bio', e.target.value)} rows={3} required /></div>
              </div>
            ))}
          </div>
        </section>

        <div className="cms-save-bar">
          <button type="submit" className="btn btn-secondary" disabled={saving}><Save size={17} /> {saving ? 'Saving...' : 'Save CMS Changes'}</button>
        </div>
      </form>
    </div>
  );
};
