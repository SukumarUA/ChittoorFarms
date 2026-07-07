import React, { useEffect, useState } from 'react';
import { Users, X, Leaf, Truck, ShieldCheck, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image_url?: string;
}

export const About: React.FC = () => {
  useEffect(() => {
    document.title = 'About Us | Chittoor Farms';
    return () => { document.title = 'Chittoor Farms — Fresh from Farm to Home'; };
  }, []);

  const { showToast } = useToast();
  const { settings } = useSettings();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredFarm, setPreferredFarm] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('team')
          .eq('id', 'main')
          .single();
        if (error) throw error;
        if (data && Array.isArray(data.team)) setTeam(data.team);
      } catch (err) {
        console.error('Error fetching team settings:', err);
      }
    };
    fetchTeamData();
  }, []);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { showToast('Please enter your name.', 'error'); return; }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) { showToast('Please enter a valid 10-digit mobile number.', 'error'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('visits').insert([{
        name: name.trim(), phone: phoneDigits,
        preferred_farm: preferredFarm.trim() || null,
        preferred_date: preferredDate || null,
        group_size: groupSize.trim() || null,
        purpose: purpose.trim() || null,
        message: message.trim() || null,
        status: 'pending',
      }]);
      if (error) throw error;
      showToast('Booking requested! We will call you to confirm.', 'success');
      setIsBookingOpen(false);
      setName(''); setPhone(''); setPreferredFarm(''); setPreferredDate(''); setGroupSize(''); setPurpose(''); setMessage('');
    } catch (err) {
      console.error('Error submitting booking:', err);
      showToast('Failed to submit booking request. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="about-page">

      {/* ── HERO: Story + Logo ─────────────────────────────────────────── */}
      <section className="about-hero-section">
        <div className="container">
          <div className="about-hero-grid">

            {/* Left — story content */}
            <div className="about-hero-content">
              <span className="about-eyebrow">Our Story</span>
              <h1 className="about-hero-h1">{settings.about_story_heading}</h1>
              <div
                className="about-hero-body"
                dangerouslySetInnerHTML={{ __html: settings.about_story_body.replace(/<br\s*\/?>/gi, '<br/>') }}
              />
              <div className="about-trust-row">
                <span className="about-trust-chip"><Leaf size={13} /> Farm Direct</span>
                <span className="about-trust-chip"><Truck size={13} /> No Middlemen</span>
                <span className="about-trust-chip"><ShieldCheck size={13} /> Naturally Ripened Fresh Produce</span>
              </div>
            </div>

            {/* Right — logo visual */}
            <div className="about-hero-visual">
              <div className="about-logo-orbit">
                <div className="about-logo-ring">
                  <div className="about-logo-inner">
                    <img src="/CTRFLOGO.jpeg" alt="Chittoor Farms" className="about-logo-img" loading="lazy" />
                  </div>
                </div>
                <div className="about-logo-tag">
                  <span>Chittoor, Andhra Pradesh</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── HERITAGE: Dark editorial section ──────────────────────────── */}
      <section className="heritage-section">
        <div className="container">

          <div className="heritage-intro">
            {settings.heritage_badge && (
              <span className="heritage-badge">{settings.heritage_badge}</span>
            )}
            <h2 className="heritage-title">{settings.heritage_title}</h2>
          </div>

          {settings.heritage_body && (
            <div className="heritage-body">
              {settings.heritage_body.split('\n\n').filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}

          {settings.heritage_stats.length > 0 && (
            <div className="heritage-stats-row">
              {settings.heritage_stats.map((stat, idx) => (
                <div key={idx} className="heritage-stat-item">
                  <div className="hstat-num">{stat.num}</div>
                  <div className="hstat-label">{stat.label}</div>
                  <div className="hstat-desc">{stat.desc}</div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* ── TEAM ──────────────────────────────────────────────────────── */}
      {team.length > 0 && (
        <section className="team-section">
          <div className="container">
            <div className="team-section-header">
              <span className="about-eyebrow">The People</span>
              <h2>Meet the Team</h2>
              <p>Working behind the scenes to connect farms directly to your doorstep.</p>
            </div>
            <div className="team-grid">
              {team.map((member, idx) => (
                <div key={idx} className="team-card">
                  <div className="team-avatar-placeholder">
                    {member.image_url ? (
                      <img className="team-avatar-image" src={member.image_url} alt={member.name} loading="lazy" />
                    ) : (
                      <Users size={28} />
                    )}
                  </div>
                  <div className="team-card-body">
                    <h3>{member.name}</h3>
                    <div className="team-role">{member.role}</div>
                    <p className="team-bio">{member.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── VISIT CTA ─────────────────────────────────────────────────── */}
      <section className="visit-cta-section">
        <div className="container">
          <div className="visit-cta-inner">
            <div className="visit-cta-icon"><MapPin size={26} /></div>
            <div className="visit-cta-content">
              <h2 className="visit-cta-heading">{settings.visit_cta_heading}</h2>
              <p className="visit-cta-text">{settings.visit_cta_text}</p>
            </div>
            <div className="visit-cta-actions">
              <button className="btn btn-secondary visit-cta-btn" onClick={() => setIsBookingOpen(true)}>
                Book a Farm Visit
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOOKING MODAL ─────────────────────────────────────────────── */}
      <div className={`modal-backdrop ${isBookingOpen ? 'open' : ''}`} onClick={() => setIsBookingOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Book a Farm Visit</h3>
            <button className="btn-icon" onClick={() => setIsBookingOpen(false)} aria-label="Close booking modal">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleBookingSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="bookingName">Full Name *</label>
                <input type="text" id="bookingName" className="form-control" placeholder="e.g. Sukumar"
                  value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="bookingPhone">Phone Number (10-digit mobile) *</label>
                <input type="tel" id="bookingPhone" className="form-control" placeholder="e.g. 9876543210"
                  value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="preferredFarm">Which Farm / Preference</label>
                <input type="text" id="preferredFarm" className="form-control"
                  placeholder="e.g. Sri Venkateswara Gardens (or leave blank for any)"
                  value={preferredFarm} onChange={(e) => setPreferredFarm(e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="visitDate">Preferred Visit Date</label>
                  <input type="date" id="visitDate" className="form-control" min={todayStr}
                    value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="groupSize">Group Size</label>
                  <input type="text" id="groupSize" className="form-control" placeholder="e.g. 2 adults, 1 child"
                    value={groupSize} onChange={(e) => setGroupSize(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="purpose">Purpose of Visit</label>
                <input type="text" id="purpose" className="form-control"
                  placeholder="e.g. Tourist / media / study / purchase"
                  value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="bookingMessage">Additional Message</label>
                <textarea id="bookingMessage" className="form-control" placeholder="Any requirements or questions..."
                  value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setIsBookingOpen(false)} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn btn-secondary" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
};
