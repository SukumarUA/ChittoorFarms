import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award, BarChart3, Bell, BookOpen, Building2, CheckCircle,
  Globe, Heart, Image as ImageIcon, Leaf, MapPin, Megaphone,
  Package, Plus, Save, Share2, Shield, Sparkles, Sprout, Star,
  Tag, Trash2, TreePine, Truck, Upload, Users, X, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import type { FeatureCard, HeritageStat } from '../../context/SettingsContext';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface CmsSettings {
  // Homepage
  hero_heading: string;
  hero_subtext: string;
  wa_number: string;
  shop_cta_text: string;
  // Social
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  social_youtube: string;
  // Footer
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  footer_tagline: string;
  // About — story
  about_story_heading: string;
  about_story_body: string;
  // About — visit CTA
  visit_cta_heading: string;
  visit_cta_text: string;
  // Home — features
  features_heading: string;
  features_subtext: string;
  feature_cards: FeatureCard[];
  heritage_stats: HeritageStat[];
  // Lists
  team: TeamMember[];
  categories: string[];
  farm_types: string[];
  use_categories: string[];
}

// ─── Icon options for feature cards ──────────────────────────────────────────

const ICON_OPTIONS: { name: string; Icon: React.FC<{ size?: number }> }[] = [
  { name: 'Truck',       Icon: Truck       },
  { name: 'Leaf',        Icon: Leaf        },
  { name: 'Award',       Icon: Award       },
  { name: 'Shield',      Icon: Shield      },
  { name: 'Star',        Icon: Star        },
  { name: 'CheckCircle', Icon: CheckCircle },
  { name: 'Heart',       Icon: Heart       },
  { name: 'Zap',         Icon: Zap         },
  { name: 'Users',       Icon: Users       },
  { name: 'Globe',       Icon: Globe       },
  { name: 'Package',     Icon: Package     },
];

const DEFAULT_CARD_ICONS = ['Truck', 'Leaf', 'Award'];

// ─── Navigation structure ─────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  Icon: React.FC<{ size?: number }>;
}
interface NavGroup {
  label: string;
  color: string;
  group: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'HOMEPAGE', color: '#f59e0b', group: 'homepage',
    items: [
      { id: 'sec-homepage', label: 'Hero & CTA',         Icon: Megaphone },
      { id: 'sec-notices',  label: 'Notice Board',       Icon: Bell      },
      { id: 'sec-features', label: 'Why Chittoor Farms', Icon: Sparkles  },
    ],
  },
  {
    label: 'ABOUT PAGE', color: '#16a34a', group: 'about',
    items: [
      { id: 'sec-story',    label: 'Our Story',      Icon: BookOpen  },
      { id: 'sec-heritage', label: 'Heritage Stats', Icon: BarChart3 },
      { id: 'sec-visit',    label: 'Visit CTA',      Icon: MapPin    },
    ],
  },
  {
    label: 'FOOTER', color: '#64748b', group: 'footer',
    items: [
      { id: 'sec-footer', label: 'Contact & Tagline', Icon: Building2 },
      { id: 'sec-social', label: 'Social Links',      Icon: Share2    },
    ],
  },
  {
    label: 'PRODUCTS', color: '#c49a2a', group: 'products',
    items: [
      { id: 'sec-categories', label: 'Product Categories', Icon: Tag      },
      { id: 'sec-farmtypes',  label: 'Farm Types',          Icon: TreePine },
      { id: 'sec-usecat',     label: 'Use Categories',      Icon: Sprout   },
    ],
  },
  {
    label: 'TEAM', color: '#7c3aed', group: 'team',
    items: [
      { id: 'sec-team', label: 'Team Members', Icon: Users },
    ],
  },
];

// Flat map: section id → { group, color, Icon } — built at module level
interface SectionMeta { group: string; color: string; Icon: React.FC<{ size?: number }> }
const SECTION_META: Record<string, SectionMeta> = {};
NAV_GROUPS.forEach((g) => {
  g.items.forEach((item) => {
    SECTION_META[item.id] = { group: g.group, color: g.color, Icon: item.Icon };
  });
});

// ─── Module-level helpers ─────────────────────────────────────────────────────

function parseNotices(raw: string): NoticeItem[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^[•*-]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { label: '', message: line };
      return { label: line.slice(0, idx).trim(), message: line.slice(idx + 1).trim() };
    });
}

function serializeNotices(notices: NoticeItem[]): string {
  return notices
    .filter((n) => n.message.trim())
    .map((n) => (n.label.trim() ? `${n.label.trim()}: ${n.message.trim()}` : n.message.trim()))
    .join('\n');
}

function fmtSaveTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const emptySettings: CmsSettings = {
  hero_heading: '', hero_subtext: '', wa_number: '', shop_cta_text: 'Shop Mangoes',
  social_facebook: '', social_instagram: '', social_twitter: '', social_youtube: '',
  contact_phone: '', contact_email: '', contact_address: '', footer_tagline: '',
  about_story_heading: '', about_story_body: '',
  visit_cta_heading: '', visit_cta_text: '',
  features_heading: '', features_subtext: '', feature_cards: [], heritage_stats: [],
  team: [], categories: [], farm_types: [], use_categories: [],
};

// ─── Module-level sub-components ─────────────────────────────────────────────

const CharCounter: React.FC<{ value: string; max: number }> = ({ value, max }) => (
  <span className={`cms-char-counter${value.length > max * 0.85 ? ' cms-char-warn' : ''}`}>
    {value.length}/{max}
  </span>
);

const PanelHeader: React.FC<{
  id: string;
  title: string;
  desc: string;
  action?: React.ReactNode;
}> = ({ id, title, desc, action }) => {
  const meta = SECTION_META[id];
  const { Icon } = meta;
  return (
    <div className="cms-panel-header" style={{ borderTop: `3px solid ${meta.color}` }}>
      <div className="cms-panel-header-left">
        <div className="cms-panel-header-icon" style={{ color: meta.color }}>
          <Icon size={18} />
        </div>
        <div>
          <h2 className="cms-panel-title">{title}</h2>
          <p className="cms-panel-desc">{desc}</p>
        </div>
      </div>
      {action && <div className="cms-panel-header-action">{action}</div>}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

export const CMS: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<CmsSettings>(emptySettings);
  const [notices,  setNotices]  = useState<NoticeItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [isDirty,  setIsDirty]  = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [activeSection, setActiveSection] = useState<string>('sec-homepage');

  // Chip-add inputs
  const [newCategory,    setNewCategory]    = useState('');
  const [newFarmType,    setNewFarmType]    = useState('');
  const [newUseCategory, setNewUseCategory] = useState('');

  // Team image upload
  const [uploadingTeamIndex, setUploadingTeamIndex] = useState<number | null>(null);

  // Dirty tracking — skip the first render after load
  const didLoad = useRef(false);
  useEffect(() => {
    if (!didLoad.current) return;
    setIsDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, notices]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      const { data: rawData, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'main')
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = rawData as any;
      if (error) throw error;
      setSettings({
        hero_heading:        data.hero_heading        || '',
        hero_subtext:        data.hero_subtext        || '',
        wa_number:           data.wa_number           || '',
        shop_cta_text:       data.shop_cta_text       || 'Shop Mangoes',
        social_facebook:     data.social_facebook     || '',
        social_instagram:    data.social_instagram    || '',
        social_twitter:      data.social_twitter      || '',
        social_youtube:      data.social_youtube      || '',
        contact_phone:       data.contact_phone       || '',
        contact_email:       data.contact_email       || '',
        contact_address:     data.contact_address     || '',
        footer_tagline:      data.footer_tagline      || '',
        about_story_heading: data.about_story_heading || '',
        about_story_body:    data.about_story_body    || '',
        visit_cta_heading:   data.visit_cta_heading   || '',
        visit_cta_text:      data.visit_cta_text      || '',
        features_heading:    data.features_heading    || '',
        features_subtext:    data.features_subtext    || '',
        feature_cards:       Array.isArray(data.feature_cards)  ? data.feature_cards  : [],
        heritage_stats:      Array.isArray(data.heritage_stats) ? data.heritage_stats : [],
        team:                Array.isArray(data.team)           ? data.team           : [],
        categories:          Array.isArray(data.categories)     ? data.categories     : [],
        farm_types:          Array.isArray(data.farm_types)     ? data.farm_types     : [],
        use_categories:      Array.isArray(data.use_categories) ? data.use_categories : [],
      });
      setNotices(parseNotices(data.notice_board || ''));
    } catch (err) {
      console.error('CMS: load error', err);
      showToast('Could not load site content.', 'error');
    } finally {
      setLoading(false);
      setTimeout(() => { didLoad.current = true; }, 100);
    }
  }, [showToast]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const doSave = async (s: CmsSettings, n: NoticeItem[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .update({
          hero_heading:        s.hero_heading.trim(),
          hero_subtext:        s.hero_subtext.trim(),
          wa_number:           s.wa_number.trim(),
          notice_board:        serializeNotices(n),
          shop_cta_text:       s.shop_cta_text.trim() || 'Shop Mangoes',
          social_facebook:     s.social_facebook.trim(),
          social_instagram:    s.social_instagram.trim(),
          social_twitter:      s.social_twitter.trim(),
          social_youtube:      s.social_youtube.trim(),
          contact_phone:       s.contact_phone.trim(),
          contact_email:       s.contact_email.trim(),
          contact_address:     s.contact_address.trim(),
          footer_tagline:      s.footer_tagline.trim(),
          about_story_heading: s.about_story_heading.trim(),
          about_story_body:    s.about_story_body.trim(),
          visit_cta_heading:   s.visit_cta_heading.trim(),
          visit_cta_text:      s.visit_cta_text.trim(),
          features_heading:    s.features_heading.trim(),
          features_subtext:    s.features_subtext.trim(),
          feature_cards:       s.feature_cards,
          heritage_stats:      s.heritage_stats,
          team:                s.team,
          categories:          s.categories,
          farm_types:          s.farm_types,
          use_categories:      s.use_categories,
          updated_at:          new Date().toISOString(),
        })
        .eq('id', 'main');
      if (error) throw error;
      setIsDirty(false);
      setLastSaved(new Date());
      showToast('All CMS changes saved.', 'success');
    } catch (err) {
      console.error('CMS: save error', err);
      showToast('Failed to save changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Keep latest settings+notices in refs for ⌘S to avoid stale closures
  const settingsRef = useRef(settings);
  const noticesRef  = useRef(notices);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { noticesRef.current = notices; },  [notices]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    void doSave(settingsRef.current, noticesRef.current);
  };

  // ── ⌘S / Ctrl+S keyboard shortcut ────────────────────────────────────────
  const savingRef  = useRef(saving);
  const loadingRef = useRef(loading);
  useEffect(() => { savingRef.current  = saving;  }, [saving]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!savingRef.current && !loadingRef.current) {
          void doSave(settingsRef.current, noticesRef.current);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — uses refs only

  // ── Mutators ──────────────────────────────────────────────────────────────

  const set = (patch: Partial<CmsSettings>) => setSettings((s) => ({ ...s, ...patch }));

  // Notices
  const addNotice    = () => setNotices((n) => [...n, { label: '', message: '' }]);
  const updateNotice = (i: number, field: keyof NoticeItem, val: string) =>
    setNotices((n) => { const a = [...n]; a[i] = { ...a[i], [field]: val }; return a; });
  const removeNotice = (i: number) => setNotices((n) => n.filter((_, j) => j !== i));

  // Feature cards
  const addFeatureCard = () =>
    set({ feature_cards: [...settings.feature_cards, { icon: 'Star', heading: '', body: '' }] });
  const updateFeatureCard = (i: number, patch: Partial<FeatureCard>) =>
    set({ feature_cards: settings.feature_cards.map((c, j) => j === i ? { ...c, ...patch } : c) });
  const removeFeatureCard = (i: number) =>
    set({ feature_cards: settings.feature_cards.filter((_, j) => j !== i) });

  // Heritage stats
  const addHeritageStat = () =>
    set({ heritage_stats: [...settings.heritage_stats, { num: '', label: '', desc: '' }] });
  const updateHeritageStat = (i: number, patch: Partial<HeritageStat>) =>
    set({ heritage_stats: settings.heritage_stats.map((s, j) => j === i ? { ...s, ...patch } : s) });
  const removeHeritageStat = (i: number) =>
    set({ heritage_stats: settings.heritage_stats.filter((_, j) => j !== i) });

  // Team
  const updateTeamMember = (i: number, field: keyof TeamMember, val: string) =>
    set({ team: settings.team.map((m, j) => j === i ? { ...m, [field]: val } : m) });
  const removeTeamMember = (i: number) => set({ team: settings.team.filter((_, j) => j !== i) });
  const addTeamMember    = () =>
    set({ team: [...settings.team, { name: '', role: '', bio: '', image_url: '' }] });

  // Chip lists
  const addChip = (key: 'categories' | 'farm_types' | 'use_categories', val: string) => {
    const v = val.trim();
    if (!v) return;
    if (settings[key].some((x) => x.toLowerCase() === v.toLowerCase())) {
      showToast('Already exists.', 'warning');
      return;
    }
    set({ [key]: [...settings[key], v] });
  };
  const removeChip = (key: 'categories' | 'farm_types' | 'use_categories', val: string) =>
    set({ [key]: settings[key].filter((x) => x !== val) });

  // Team image upload
  const uploadTeamImage = async (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024)     { showToast('Team photos must be < 5 MB.', 'error');  return; }
    setUploadingTeamIndex(index);
    try {
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const name = `team/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error } = await supabase.storage
        .from('chittoor-farms')
        .upload(name, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('chittoor-farms').getPublicUrl(name);
      updateTeamMember(index, 'image_url', data.publicUrl);
      showToast('Photo uploaded — save to publish.', 'success');
    } catch (err) {
      console.error('Team image upload error', err);
      showToast('Failed to upload photo.', 'error');
    } finally {
      setUploadingTeamIndex(null);
    }
  };

  // ── Count badges ──────────────────────────────────────────────────────────

  const getCount = (id: string): number | null => {
    switch (id) {
      case 'sec-notices':    return notices.length;
      case 'sec-features':   return settings.feature_cards.length;
      case 'sec-heritage':   return settings.heritage_stats.length;
      case 'sec-team':       return settings.team.length;
      case 'sec-categories': return settings.categories.length;
      case 'sec-farmtypes':  return settings.farm_types.length;
      case 'sec-usecat':     return settings.use_categories.length;
      default:               return null;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-muted)' }}>
        Loading CMS…
      </div>
    );
  }

  return (
    <div className="cms-layout">

      {/* ── Single flat tab bar ────────────────────────────────────────── */}
      <div className="cms-tabbar">
        <div className="cms-tabbar-nav">
          {NAV_GROUPS.map((group, gi) => (
            <React.Fragment key={group.label}>
              {gi > 0 && <span className="cms-tabbar-divider" />}
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                const count    = getCount(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`cms-tab${isActive ? ' active' : ''}`}
                    style={isActive ? { color: group.color, borderBottomColor: group.color } : undefined}
                    onClick={() => setActiveSection(item.id)}
                  >
                    <item.Icon size={13} />
                    <span>{item.label}</span>
                    {count !== null && (
                      <span
                        className="cms-nav-badge"
                        style={isActive ? { background: group.color, color: '#fff' } : undefined}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div className="cms-tabbar-actions">
          {isDirty ? (
            <span className="cms-status-unsaved">
              <span className="cms-dirty-dot" />
              Unsaved
            </span>
          ) : lastSaved ? (
            <span className="cms-status-saved">✓ {fmtSaveTime(lastSaved)}</span>
          ) : null}
          <button
            form="cms-form"
            type="submit"
            className="btn btn-secondary cms-save-btn-inline"
            disabled={saving}
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
          <span className="cms-shortcut-hint"><kbd>⌘S</kbd></span>
        </div>
      </div>

      {/* ── Content: only the active section ──────────────────────────── */}
      <main className="cms-main">
        <form id="cms-form" onSubmit={handleSave}>

          {/* ── 1. Homepage Hero ──────────────────────────────────────── */}
          {activeSection === 'sec-homepage' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-homepage"
                title="Homepage Hero"
                desc="The big headline and CTA customers see when they first land on the site."
              />
              <div className="cms-panel-body">
                <div className="form-group">
                  <div className="cms-label-row">
                    <label htmlFor="heroHeading">Main Headline</label>
                    <CharCounter value={settings.hero_heading} max={90} />
                  </div>
                  <input
                    id="heroHeading" className="form-control" maxLength={90}
                    value={settings.hero_heading}
                    onChange={(e) => set({ hero_heading: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="heroSubtext">Subtitle</label>
                  <textarea
                    id="heroSubtext" className="form-control" rows={3}
                    value={settings.hero_subtext}
                    onChange={(e) => set({ hero_subtext: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <div className="cms-label-row">
                      <label htmlFor="shopCta">Shop Button Label</label>
                      <CharCounter value={settings.shop_cta_text} max={40} />
                    </div>
                    <input
                      id="shopCta" className="form-control" maxLength={40}
                      value={settings.shop_cta_text}
                      onChange={(e) => set({ shop_cta_text: e.target.value })}
                      placeholder="e.g. Shop Mangoes"
                    />
                    <small>Appears on the hero CTA button.</small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="waNumber">WhatsApp Number</label>
                    <input
                      id="waNumber" className="form-control"
                      value={settings.wa_number}
                      onChange={(e) => set({ wa_number: e.target.value.replace(/\D/g, '') })}
                      placeholder="Digits only — e.g. 919390033516"
                    />
                    <small>Leave blank to hide WhatsApp CTAs.</small>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 2. Notice Board ───────────────────────────────────────── */}
          {activeSection === 'sec-notices' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-notices"
                title="Notice Board"
                desc="Rotating updates on the homepage. Each notice shows as a ticker item."
                action={
                  <button type="button" className="btn btn-outline" onClick={addNotice}>
                    <Plus size={14} /> Add Notice
                  </button>
                }
              />
              <div className="cms-panel-body">
                {notices.length === 0 && (
                  <p className="cms-empty-notices">No notices yet. Click "Add Notice" to add one.</p>
                )}
                <div className="cms-notices-list">
                  {notices.map((notice, i) => (
                    <div key={i} className="cms-notice-item">
                      <div className="cms-notice-fields">
                        <input
                          className="form-control cms-notice-label-input"
                          placeholder="Label (e.g. Notice)"
                          value={notice.label}
                          onChange={(e) => updateNotice(i, 'label', e.target.value)}
                        />
                        <input
                          className="form-control cms-notice-message-input"
                          placeholder="Message text"
                          value={notice.message}
                          onChange={(e) => updateNotice(i, 'message', e.target.value)}
                        />
                      </div>
                      <button
                        type="button" className="btn-icon cms-notice-remove"
                        onClick={() => removeNotice(i)} aria-label="Remove notice"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 3. Why Chittoor Farms ─────────────────────────────────── */}
          {activeSection === 'sec-features' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-features"
                title="Why Chittoor Farms"
                desc="The feature cards on the homepage that explain your value proposition."
                action={
                  <button type="button" className="btn btn-outline" onClick={addFeatureCard}>
                    <Plus size={14} /> Add Card
                  </button>
                }
              />
              <div className="cms-panel-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Section Heading</label>
                    <input
                      className="form-control"
                      value={settings.features_heading}
                      onChange={(e) => set({ features_heading: e.target.value })}
                      placeholder="Why Chittoor Farms?"
                    />
                  </div>
                  <div className="form-group">
                    <label>Section Subtext</label>
                    <input
                      className="form-control"
                      value={settings.features_subtext}
                      onChange={(e) => set({ features_subtext: e.target.value })}
                      placeholder="One-line description below the heading"
                    />
                  </div>
                </div>
                <div className="cms-feature-cards">
                  {settings.feature_cards.map((card, i) => (
                    <div key={i} className="cms-feature-card-editor">
                      <div className="cms-feature-card-top">
                        <span className="cms-feature-card-num">{i + 1}</span>
                        <button
                          type="button" className="btn-icon" style={{ color: 'var(--danger)' }}
                          onClick={() => removeFeatureCard(i)} aria-label="Remove card"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <div className="form-group">
                        <label>Icon</label>
                        <div className="icon-picker">
                          {ICON_OPTIONS.map(({ name, Icon }) => (
                            <button
                              key={name} type="button"
                              className={`icon-picker-btn ${(card.icon || DEFAULT_CARD_ICONS[i] || 'Star') === name ? 'selected' : ''}`}
                              onClick={() => updateFeatureCard(i, { icon: name })}
                              title={name}
                            >
                              <Icon size={17} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Card Heading</label>
                        <input
                          className="form-control"
                          value={card.heading}
                          onChange={(e) => updateFeatureCard(i, { heading: e.target.value })}
                          placeholder="e.g. Bypasses Cold Storage"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Card Body</label>
                        <textarea
                          className="form-control" rows={2}
                          value={card.body}
                          onChange={(e) => updateFeatureCard(i, { body: e.target.value })}
                          placeholder="1–2 sentence description"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 4. Our Story ──────────────────────────────────────────── */}
          {activeSection === 'sec-story' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-story"
                title="Our Story"
                desc="The brand narrative shown at the top of the About page."
              />
              <div className="cms-panel-body">
                <div className="form-group">
                  <div className="cms-label-row">
                    <label htmlFor="storyHeading">Story Heading</label>
                    <CharCounter value={settings.about_story_heading} max={60} />
                  </div>
                  <input
                    id="storyHeading" className="form-control" maxLength={60}
                    value={settings.about_story_heading}
                    onChange={(e) => set({ about_story_heading: e.target.value })}
                    placeholder="e.g. Connecting You to the Soil"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="storyBody">Story Body</label>
                  <textarea
                    id="storyBody" className="form-control" rows={6}
                    value={settings.about_story_body}
                    onChange={(e) => set({ about_story_body: e.target.value })}
                  />
                  <small>Use <code>{'<br/>'}</code> for paragraph breaks. Rendered as HTML on the About page.</small>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. Heritage Stats ─────────────────────────────────────── */}
          {activeSection === 'sec-heritage' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-heritage"
                title="Heritage Stats"
                desc="The large-number stat cards on the About page. Update each season."
                action={
                  <button type="button" className="btn btn-outline" onClick={addHeritageStat}>
                    <Plus size={14} /> Add Stat
                  </button>
                }
              />
              <div className="cms-panel-body">
                <div className="cms-stat-grid">
                  {settings.heritage_stats.map((stat, i) => (
                    <div key={i} className="cms-stat-editor">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          Stat {i + 1}
                        </span>
                        <button
                          type="button" className="btn-icon" style={{ color: 'var(--danger)', padding: '2px' }}
                          onClick={() => removeHeritageStat(i)} aria-label="Remove stat"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="form-group">
                        <label>Number</label>
                        <input
                          className="form-control" style={{ fontWeight: 700, fontSize: '1.1rem' }}
                          value={stat.num}
                          onChange={(e) => updateHeritageStat(i, { num: e.target.value })}
                          placeholder="e.g. 100,000+"
                        />
                      </div>
                      <div className="form-group">
                        <label>Label</label>
                        <input
                          className="form-control"
                          value={stat.label}
                          onChange={(e) => updateHeritageStat(i, { label: e.target.value })}
                          placeholder="e.g. Acres Cultivated"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Description</label>
                        <input
                          className="form-control"
                          value={stat.desc}
                          onChange={(e) => updateHeritageStat(i, { desc: e.target.value })}
                          placeholder="One-line context"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 6. Visit CTA ──────────────────────────────────────────── */}
          {activeSection === 'sec-visit' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-visit"
                title="Visit CTA"
                desc="The farm-visit invitation banner at the bottom of the About page."
              />
              <div className="cms-panel-body">
                <div className="form-group">
                  <div className="cms-label-row">
                    <label htmlFor="visitHeading">Banner Heading</label>
                    <CharCounter value={settings.visit_cta_heading} max={60} />
                  </div>
                  <input
                    id="visitHeading" className="form-control" maxLength={60}
                    value={settings.visit_cta_heading}
                    onChange={(e) => set({ visit_cta_heading: e.target.value })}
                    placeholder="e.g. Visit a Real Mango Orchard"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="visitText">Banner Body</label>
                  <textarea
                    id="visitText" className="form-control" rows={3}
                    value={settings.visit_cta_text}
                    onChange={(e) => set({ visit_cta_text: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── 7. Contact & Footer ───────────────────────────────────── */}
          {activeSection === 'sec-footer' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-footer"
                title="Contact & Footer"
                desc="Contact details and the brand description shown in the footer."
              />
              <div className="cms-panel-body">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="footerPhone">Phone</label>
                    <input
                      id="footerPhone" className="form-control"
                      value={settings.contact_phone}
                      onChange={(e) => set({ contact_phone: e.target.value })}
                      placeholder="+91 93900 33516"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="footerEmail">Email</label>
                    <input
                      id="footerEmail" className="form-control" type="email"
                      value={settings.contact_email}
                      onChange={(e) => set({ contact_email: e.target.value })}
                      placeholder="contact@chittoorfarms.in"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="footerAddress">Address</label>
                  <input
                    id="footerAddress" className="form-control"
                    value={settings.contact_address}
                    onChange={(e) => set({ contact_address: e.target.value })}
                    placeholder="Chittoor, Andhra Pradesh, India"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="footerTagline">Brand Tagline</label>
                  <textarea
                    id="footerTagline" className="form-control" rows={2}
                    value={settings.footer_tagline}
                    onChange={(e) => set({ footer_tagline: e.target.value })}
                  />
                  <small>Short description shown under the brand name in the footer.</small>
                </div>
              </div>
            </div>
          )}

          {/* ── 8. Social Links ───────────────────────────────────────── */}
          {activeSection === 'sec-social' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-social"
                title="Social Links"
                desc="Icons appear in the footer. Leave a field blank to hide that icon."
              />
              <div className="cms-panel-body">
                {([
                  { key: 'social_facebook',  label: 'Facebook',    ph: 'https://facebook.com/…'  },
                  { key: 'social_instagram', label: 'Instagram',   ph: 'https://instagram.com/…' },
                  { key: 'social_twitter',   label: 'Twitter / X', ph: 'https://x.com/…'         },
                  { key: 'social_youtube',   label: 'YouTube',     ph: 'https://youtube.com/…'   },
                ] as const).map(({ key, label, ph }) => (
                  <div key={key} className="form-group cms-social-row">
                    <label className="cms-social-label">{label}</label>
                    <input
                      className="form-control" placeholder={ph}
                      value={settings[key]}
                      onChange={(e) => set({ [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 9. Product Categories ─────────────────────────────────── */}
          {activeSection === 'sec-categories' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-categories"
                title="Product Categories"
                desc="Drives the filter tabs on the Shop page and the Category dropdown in Products."
              />
              <div className="cms-panel-body">
                <div className="cms-add-row">
                  <input
                    className="form-control" placeholder="e.g. Vegetables"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip('categories', newCategory); setNewCategory(''); } }}
                  />
                  <button type="button" className="btn btn-outline"
                    onClick={() => { addChip('categories', newCategory); setNewCategory(''); }}>
                    <Plus size={15} /> Add
                  </button>
                </div>
                <div className="cms-category-list" style={{ marginTop: '0.75rem' }}>
                  {settings.categories.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No categories yet.</p>
                  )}
                  {settings.categories.map((cat) => (
                    <span key={cat} className="cms-category-chip">
                      {cat}
                      <button type="button" onClick={() => removeChip('categories', cat)} aria-label={`Remove ${cat}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 10. Farm Types ────────────────────────────────────────── */}
          {activeSection === 'sec-farmtypes' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-farmtypes"
                title="Farm Types"
                desc="Options in the Farmer Application form and partner farm profiles."
              />
              <div className="cms-panel-body">
                <div className="cms-add-row">
                  <input
                    className="form-control" placeholder="e.g. Vegetable Farm"
                    value={newFarmType}
                    onChange={(e) => setNewFarmType(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip('farm_types', newFarmType); setNewFarmType(''); } }}
                  />
                  <button type="button" className="btn btn-outline"
                    onClick={() => { addChip('farm_types', newFarmType); setNewFarmType(''); }}>
                    <Plus size={15} /> Add
                  </button>
                </div>
                <div className="cms-category-list" style={{ marginTop: '0.75rem' }}>
                  {settings.farm_types.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No farm types yet.</p>
                  )}
                  {settings.farm_types.map((ft) => (
                    <span key={ft} className="cms-category-chip">
                      {ft}
                      <button type="button" onClick={() => removeChip('farm_types', ft)} aria-label={`Remove ${ft}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 11. Use Categories ───────────────────────────────────── */}
          {activeSection === 'sec-usecat' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-usecat"
                title="Use Categories"
                desc='Options in the "Primary Use Category" dropdown when adding or editing any product (e.g. Fresh Eating, Pickling, Juicing, Export).'
              />
              <div className="cms-panel-body">
                <div className="cms-add-row">
                  <input
                    className="form-control" placeholder="e.g. Fresh Eating, Pickling, Export, Juicing"
                    value={newUseCategory}
                    onChange={(e) => setNewUseCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip('use_categories', newUseCategory); setNewUseCategory(''); } }}
                  />
                  <button type="button" className="btn btn-outline"
                    onClick={() => { addChip('use_categories', newUseCategory); setNewUseCategory(''); }}>
                    <Plus size={15} /> Add
                  </button>
                </div>
                <div className="cms-category-list" style={{ marginTop: '0.75rem' }}>
                  {settings.use_categories.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--warning)' }}>
                      No use categories yet — add at least one so products can be categorised by intended use.
                    </p>
                  )}
                  {settings.use_categories.map((uc) => (
                    <span key={uc} className="cms-category-chip">
                      {uc}
                      <button type="button" onClick={() => removeChip('use_categories', uc)} aria-label={`Remove ${uc}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 12. Team Members ──────────────────────────────────────── */}
          {activeSection === 'sec-team' && (
            <div className="cms-panel">
              <PanelHeader
                id="sec-team"
                title="Team Members"
                desc="Shown on the About page. Add photos, names, roles, and short bios."
                action={
                  <button type="button" className="btn btn-outline" onClick={addTeamMember}>
                    <Plus size={14} /> Add Member
                  </button>
                }
              />
              <div className="cms-panel-body">
                <div className="team-editor-list">
                  {settings.team.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                      No team members yet. Click "Add Member" to get started.
                    </p>
                  )}
                  {settings.team.map((member, i) => (
                    <div key={i} className="team-editor-item">
                      <button
                        type="button" className="team-editor-remove"
                        onClick={() => removeTeamMember(i)}
                        aria-label={`Remove ${member.name || 'team member'}`}
                      >
                        <Trash2 size={15} />
                      </button>
                      <div className="team-image-editor">
                        <label className="team-image-upload" htmlFor={`teamImg-${i}`}>
                          <div className="team-image-preview">
                            {member.image_url
                              ? <img src={member.image_url} alt={member.name || 'Member'} />
                              : <ImageIcon size={30} />}
                          </div>
                          <span className="btn btn-outline team-image-button">
                            <Upload size={15} />
                            {uploadingTeamIndex === i ? 'Uploading…' : member.image_url ? 'Replace Photo' : 'Upload Photo'}
                          </span>
                        </label>
                        <input
                          id={`teamImg-${i}`} type="file" accept="image/*" hidden
                          disabled={uploadingTeamIndex !== null}
                          onChange={(e) => { void uploadTeamImage(i, e.target.files?.[0]); e.target.value = ''; }}
                        />
                        {member.image_url && (
                          <button type="button" className="btn btn-link team-image-remove"
                            onClick={() => updateTeamMember(i, 'image_url', '')}>
                            Remove Photo
                          </button>
                        )}
                        <small>JPG / PNG / WebP, max 5 MB.</small>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Name</label>
                          <input className="form-control" value={member.name}
                            onChange={(e) => updateTeamMember(i, 'name', e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label>Role / Title</label>
                          <input className="form-control" value={member.role}
                            onChange={(e) => updateTeamMember(i, 'role', e.target.value)} required />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Bio</label>
                        <textarea className="form-control" rows={3} value={member.bio}
                          onChange={(e) => updateTeamMember(i, 'bio', e.target.value)} required />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </form>
      </main>
    </div>
  );
};
