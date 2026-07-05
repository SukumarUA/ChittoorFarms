import React, { useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
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

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredFarm, setPreferredFarm] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState('');

  // Date picker limit: today or later
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
        if (data && Array.isArray(data.team)) {
          setTeam(data.team);
        }
      } catch (err) {
        console.error('Error fetching team settings:', err);
      }
    };

    fetchTeamData();
  }, []);

  const handleOpenBooking = () => {
    setIsBookingOpen(true);
  };

  const handleCloseBooking = () => {
    setIsBookingOpen(false);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!name.trim()) {
      showToast('Please enter your name.', 'error');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('visits').insert([
        {
          name: name.trim(),
          phone: phoneDigits,
          preferred_farm: preferredFarm.trim() || null,
          preferred_date: preferredDate || null,
          group_size: groupSize.trim() || null,
          purpose: purpose.trim() || null,
          message: message.trim() || null,
          status: 'pending',
        },
      ]);

      if (error) throw error;

      showToast('Booking requested! We will call you to confirm.', 'success');
      setIsBookingOpen(false);

      // Reset form
      setName('');
      setPhone('');
      setPreferredFarm('');
      setPreferredDate('');
      setGroupSize('');
      setPurpose('');
      setMessage('');
    } catch (err) {
      console.error('Error submitting booking:', err);
      showToast('Failed to submit booking request. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="about-page">

      {/* ── Intro: Story + Logo ───────────────────────────────────────── */}
      <section className="about-intro-section">
        <div className="container">
          <div className="about-grid">
            <div className="about-story">
              <h1>{settings.about_story_heading}</h1>
              {/* Supports basic HTML like <br/> for paragraph breaks */}
              <div dangerouslySetInnerHTML={{ __html: settings.about_story_body.replace(/<br\s*\/?>/gi, '<br/>') }} />
            </div>

            <div className="about-logo-wrapper">
              <div className="about-logo-circle">
                <img src="/CTRFLOGO.jpeg" alt="Chittoor Farms Logo" className="about-logo-img" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Heritage Section (full-bleed background) ─────────────────── */}
      <section className="heritage-section">
        <div className="container">
          <div className="heritage-intro">
            <span className="heritage-badge">• CHITTOOR, INDIA'S MANGO PARADISE •</span>
            <h2 className="heritage-title">Discover Chittoor's Mango Cultivation Heritage</h2>
          </div>

          <div className="heritage-grid">
            <div className="heritage-col">
              <p>Chittoor district in Andhra Pradesh is a powerhouse of premium mango cultivation. Armed with decades of local expertise, our farmers have perfected the art of nurturing orchards on nutrient-rich red laterite soils, passing down specialized grafting and cultivation techniques across generations.</p>
              <p>Today, Chittoor stands as the state's largest mango-producing belt, with 100,000+ acres dedicated to orchards. In a peak season, these orchards yield close to 500,000+ metric tonnes of high-quality fruit, cementing the region's position as a major leader in India's mango market.</p>
              <p>While the signature Totapuri mango powers 50+ pulp processing units supplying juice globally, the region is celebrated for its diversity. Premium table varieties like Banganapalli, Neelum, Imam Pasand, Sindhura, and Mallika all thrive side-by-side in these fertile orchards.</p>
            </div>
            <div className="heritage-col">
              <p>What sets Chittoor farms apart is their smart multi-variety orchard tradition. Growing 4+ distinct mango varieties together naturally extends the harvest season, enhances cross-pollination, and preserves rare heritage strains that are hard to find anywhere else.</p>
              <p>To maintain this high standard of quality, local farmers invest an average of ₹30,000 per acre each season in careful cultivation, soil nourishment, and natural harvesting techniques, ensuring every mango is picked at perfect maturity.</p>
              <p>However, without a direct market, these skilled farmers are often vulnerable to exploitative middlemen and pulp conglomerates. By purchasing from Chittoor Farms, you bridge this gap directly—ensuring fair profits reach the growers while enjoying premium, naturally ripened fruit delivered straight to your home.</p>
            </div>
          </div>

          {settings.heritage_stats.length > 0 && (
            <div className="heritage-stats-grid">
              {settings.heritage_stats.map((stat, idx) => (
                <div key={idx} className="heritage-stat-card">
                  <div className="stat-num">{stat.num}</div>
                  <div className="stat-sub">{stat.label}</div>
                  <p className="stat-desc">{stat.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Team Section ─────────────────────────────────────────────── */}
      {team.length > 0 && (
        <section className="team-section">
          <div className="container">
            <h2 style={{ textAlign: 'center' }}>Meet the Team</h2>
            <p style={{ textAlign: 'center', maxWidth: '600px', margin: '0.25rem auto 1.5rem auto' }}>
              The people working behind the scenes to streamline harvesting, packaging, and direct distribution.
            </p>
            <div className="team-grid">
              {team.map((member, idx) => (
                <div key={idx} className="team-card">
                  <div className="team-avatar-placeholder">
                    {member.image_url ? (
                      <img className="team-avatar-image" src={member.image_url} alt={member.name} loading="lazy" />
                    ) : (
                      <Users size={32} />
                    )}
                  </div>
                  <h3>{member.name}</h3>
                  <div className="team-role">{member.role}</div>
                  <p className="team-bio">{member.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Visit CTA Banner (full-bleed) ────────────────────────────── */}
      <section className="visit-booking-banner-section">
        <div className="container">
          <div className="visit-booking-banner">
            <h2>{settings.visit_cta_heading}</h2>
            <p>{settings.visit_cta_text}</p>
            <button className="btn btn-secondary" onClick={handleOpenBooking}>
              Book a farm visit
            </button>
          </div>
        </div>
      </section>

      {/* Booking Form Modal */}
      <div className={`modal-backdrop ${isBookingOpen ? 'open' : ''}`} onClick={handleCloseBooking}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Book a Farm Visit</h3>
            <button className="btn-icon" onClick={handleCloseBooking} aria-label="Close booking modal">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleBookingSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="bookingName">Full Name *</label>
                <input
                  type="text"
                  id="bookingName"
                  className="form-control"
                  placeholder="e.g. Sukumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="bookingPhone">Phone Number (10-digit mobile) *</label>
                <input
                  type="tel"
                  id="bookingPhone"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="preferredFarm">Which Farm / Preference</label>
                <input
                  type="text"
                  id="preferredFarm"
                  className="form-control"
                  placeholder="e.g. Sri Venkateswara Gardens (or leave blank for any)"
                  value={preferredFarm}
                  onChange={(e) => setPreferredFarm(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="visitDate">Preferred Visit Date</label>
                  <input
                    type="date"
                    id="visitDate"
                    className="form-control"
                    min={todayStr}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="groupSize">Group Size</label>
                  <input
                    type="text"
                    id="groupSize"
                    className="form-control"
                    placeholder="e.g. 2 adults, 1 child"
                    value={groupSize}
                    onChange={(e) => setGroupSize(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="purpose">Purpose of Visit</label>
                <input
                  type="text"
                  id="purpose"
                  className="form-control"
                  placeholder="e.g. Tourist / media / study / purchase"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="bookingMessage">Additional Message</label>
                <textarea
                  id="bookingMessage"
                  className="form-control"
                  placeholder="Any requirements or questions..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={handleCloseBooking} disabled={isSubmitting}>
                Cancel
              </button>
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
