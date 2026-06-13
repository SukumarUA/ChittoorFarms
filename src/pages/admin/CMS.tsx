import React, { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image_url?: string;
}

interface NoticeItem {
  label: string;
  message: string;
}

interface SiteSettings {
  hero_heading: string;
  hero_subtext: string;
  banner_img_url: string;
  wa_number: string;
  team: TeamMember[];
  categories: string[];
  farm_types: string[];
  shop_cta_text: string;
}

const emptySettings: SiteSettings = {
  hero_heading: '',
  hero_subtext: '',
  banner_img_url: '',
  wa_number: '',
  team: [],
  categories: [],
  farm_types: [],
  shop_cta_text: 'Shop Mangoes',
};

/** Parse the stored newline-separated string into individual notice items */
function parseNotices(raw: string): NoticeItem[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^[•*-]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return { label: '', message: line };
      return {
        label: line.slice(0, colonIdx).trim(),
        message: line.slice(colonIdx + 1).trim(),
      };
    });
}

/** Serialize notice items back to the stored string format */
function serializeNotices(notices: NoticeItem[]): string {
  return notices
    .filter((n) => n.message.trim())
    .map((n) => (n.label.trim() ? `${n.label.trim()}: ${n.message.trim()}` : n.message.trim()))
    .join('\n');
}

export const CMS: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SiteSettings>(emptySettings);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newFarmType, setNewFarmType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTeamIndex, setUploadingTeamIndex] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('hero_heading, hero_subtext, banner_img_url, wa_number, notice_board, team, categories, farm_types, shop_cta_text')
        .eq('id', 'main')
        .single();

      if (error) throw error;
      setSettings({
        hero_heading: data.hero_heading || '',
        hero_subtext: data.hero_subtext || '',
        banner_img_url: data.banner_img_url || '',
        wa_number: data.wa_number || '',
        team: Array.isArray(data.team) ? data.team : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
        farm_types: Array.isArray(data.farm_types) ? data.farm_types : [],
        shop_cta_text: data.shop_cta_text || 'Shop Mangoes',
      });
      setNotices(parseNotices(data.notice_board || ''));
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
          notice_board: serializeNotices(notices),
          team: settings.team,
          categories: settings.categories,
          farm_types: settings.farm_types,
          shop_cta_text: settings.shop_cta_text.trim() || 'Shop Mangoes',
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

  const addNotice = () => {
    setNotices((prev) => [...prev, { label: '', message: '' }]);
  };

  const updateNotice = (index: number, field: keyof NoticeItem, value: string) => {
    setNotices((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeNotice = (index: number) => {
    setNotices((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    setSettings((current) => {
      const team = [...current.team];
      team[index] = { ...team[index], [field]: value };
      return { ...current, team };
    });
  };

  const uploadTeamImage = async (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Team photos must be smaller than 5 MB.', 'error');
      return;
    }

    setUploadingTeamIndex(index);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `team/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${extension}`;
      const { error } = await supabase.storage
        .from('chittoor-farms')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from('chittoor-farms').getPublicUrl(fileName);
      updateTeamMember(index, 'image_url', data.publicUrl);
      showToast('Team photo uploaded. Save CMS changes to publish it.', 'success');
    } catch (error) {
      console.error('Error uploading team photo:', error);
      showToast('Failed to upload team photo.', 'error');
    } finally {
      setUploadingTeamIndex(null);
    }
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

  const addFarmType = () => {
    const farmType = newFarmType.trim();
    if (!farmType) return;
    if (settings.farm_types.some((item) => item.toLowerCase() === farmType.toLowerCase())) {
      showToast('Farm type already exists.', 'warning');
      return;
    }
    setSettings({ ...settings, farm_types: [...settings.farm_types, farmType] });
    setNewFarmType('');
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
          <div className="form-group"><label htmlFor="cmsShopCta">Primary Shop Button Text</label><input id="cmsShopCta" className="form-control" placeholder="e.g. Shop Mangoes, Buy Fresh Rice" value={settings.shop_cta_text} onChange={(e) => setSettings({ ...settings, shop_cta_text: e.target.value })} maxLength={40} required /><small>Change this seasonally without editing code.</small></div>
          <div className="form-group"><label htmlFor="cmsBanner">Hero Background Image URL</label><input type="url" id="cmsBanner" className="form-control" value={settings.banner_img_url} onChange={(e) => setSettings({ ...settings, banner_img_url: e.target.value })} /></div>
          <div className="form-group"><label htmlFor="cmsWhatsapp">WhatsApp Operational Number</label><input id="cmsWhatsapp" className="form-control" placeholder="Digits only, e.g. 919876543210" value={settings.wa_number} onChange={(e) => setSettings({ ...settings, wa_number: e.target.value.replace(/\D/g, '') })} /><small>Leave blank to hide the WhatsApp calls to action.</small></div>

          {/* Notice Board — individual items */}
          <div className="form-group">
            <div className="cms-section-header" style={{ marginBottom: '0.75rem' }}>
              <label style={{ margin: 0 }}>Notice Board / Farm Updates</label>
              <button type="button" className="btn btn-outline" onClick={addNotice}>
                <Plus size={14} /> Add Notice
              </button>
            </div>
            {notices.length === 0 && (
              <p className="cms-empty-notices">No notices yet. Click "Add Notice" to add one.</p>
            )}
            <div className="cms-notices-list">
              {notices.map((notice, index) => (
                <div key={index} className="cms-notice-item">
                  <div className="cms-notice-fields">
                    <input
                      className="form-control cms-notice-label-input"
                      placeholder="Label (e.g. Notice, Orchard Visit)"
                      value={notice.label}
                      onChange={(e) => updateNotice(index, 'label', e.target.value)}
                    />
                    <input
                      className="form-control cms-notice-message-input"
                      placeholder="Message"
                      value={notice.message}
                      onChange={(e) => updateNotice(index, 'message', e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-icon cms-notice-remove"
                    onClick={() => removeNotice(index)}
                    aria-label="Remove notice"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <small>Each notice rotates on the home page. The label appears as the heading.</small>
          </div>
        </section>

        <section className="dashboard-panel cms-section">
          <h2>Farm Types</h2>
          <p className="cms-section-description">Manage the choices used for partner farms and farmer applications.</p>
          <div className="cms-add-row">
            <input className="form-control" placeholder="e.g. Vegetable Farm" value={newFarmType} onChange={(e) => setNewFarmType(e.target.value)} />
            <button type="button" className="btn btn-secondary" onClick={addFarmType}><Plus size={16} /> Add</button>
          </div>
          <div className="cms-category-list">
            {settings.farm_types.map((farmType) => (
              <span key={farmType} className="cms-category-chip">
                {farmType}
                <button type="button" onClick={() => setSettings({ ...settings, farm_types: settings.farm_types.filter((item) => item !== farmType) })} aria-label={`Remove ${farmType}`}><X size={13} /></button>
              </span>
            ))}
          </div>
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
            <button type="button" className="btn btn-outline" onClick={() => setSettings({ ...settings, team: [...settings.team, { name: '', role: '', bio: '', image_url: '' }] })}><Plus size={15} /> Add Member</button>
          </div>
          <div className="team-editor-list">
            {settings.team.map((member, index) => (
              <div key={index} className="team-editor-item">
                <button type="button" className="team-editor-remove" onClick={() => setSettings({ ...settings, team: settings.team.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remove ${member.name || 'team member'}`}><Trash2 size={15} /></button>
                <div className="team-image-editor">
                  <label className="team-image-upload" htmlFor={`teamImage-${index}`}>
                    <div className="team-image-preview">
                      {member.image_url ? (
                        <img src={member.image_url} alt={`${member.name || 'Team member'} preview`} />
                      ) : (
                        <ImageIcon size={30} />
                      )}
                    </div>
                    <span className="btn btn-outline team-image-button">
                      <Upload size={15} />
                      {uploadingTeamIndex === index ? 'Uploading...' : member.image_url ? 'Replace Photo' : 'Upload Photo'}
                    </span>
                  </label>
                  <input
                    id={`teamImage-${index}`}
                    type="file"
                    accept="image/*"
                    disabled={uploadingTeamIndex !== null}
                    onChange={(event) => {
                      void uploadTeamImage(index, event.target.files?.[0]);
                      event.target.value = '';
                    }}
                    hidden
                  />
                  {member.image_url && (
                    <button type="button" className="btn btn-link team-image-remove" onClick={() => updateTeamMember(index, 'image_url', '')}>Remove Photo</button>
                  )}
                  <small>JPG, PNG, or WebP up to 5 MB.</small>
                </div>
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
