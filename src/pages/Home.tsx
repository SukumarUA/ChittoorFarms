import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Award, Leaf, Pin, Sprout } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../lib/supabase';

interface SettingsData {
  hero_heading: string;
  hero_subtext: string;
  banner_img_url: string;
  wa_number: string;
  notice_board: string;
}

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [activeNoticeIndex, setActiveNoticeIndex] = useState(0);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('hero_heading, hero_subtext, banner_img_url, wa_number, notice_board')
          .eq('id', 'main')
          .single();

        if (error) throw error;
        setSettings(data);
      } catch (err) {
        console.error('Error fetching home page settings:', err);
      }
    };

    fetchSettings();
  }, []);

  // Default fallbacks in case Supabase loading fails or is empty
  const heroHeading = settings?.hero_heading || 'Delicious Chittoor Mangoes, Straight from Farms';
  const heroSubtext =
    settings?.hero_subtext ||
    'Experience the unparalleled taste of premium, naturally ripened mangoes directly from local family orchards. Delivered fresh to you within hours of picking, bypassing cold storage entirely.';
  const waNumber = settings?.wa_number || '919390033516';
  
  const noticeBoardText = settings?.notice_board ?? 
    "• Notice: Fresh Banganapalli harvest arriving this Friday! Pre-orders are open now.\n• Orchard Visits: Bookings for Sri Venkateswara Farm visits are available for the coming Sunday.";
  const notices = noticeBoardText.split('\n').filter(line => line.trim() !== '');
  const currentNoticeIndex = notices.length > 0 ? activeNoticeIndex % notices.length : 0;

  useEffect(() => {
    if (notices.length <= 1) return;

    const rotationTimer = window.setTimeout(() => {
      setActiveNoticeIndex((currentIndex) => (currentIndex + 1) % notices.length);
    }, 6000);

    return () => window.clearTimeout(rotationTimer);
  }, [activeNoticeIndex, notices.length]);

  const formatNotice = (notice: string) => {
    const cleanNotice = notice.replace(/^[•*-]\s*/, '').trim();
    const separatorIndex = cleanNotice.indexOf(':');

    if (separatorIndex === -1) {
      return { label: 'Farm update', message: cleanNotice };
    }

    return {
      label: cleanNotice.slice(0, separatorIndex).trim(),
      message: cleanNotice.slice(separatorIndex + 1).trim(),
    };
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container hero-container">
          <div className="hero-content">
            <h1 className="hero-heading">{heroHeading}</h1>
            <p className="hero-subtext">{heroSubtext}</p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => navigate('/shop')}>
                Shop Mangoes
              </button>
              <button className="btn btn-outline-green" onClick={() => navigate('/farms')}>
                Explore Partner Farms
              </button>
            </div>
          </div>

          {/* Bulletin Notice Board */}
          {notices.length > 0 && (
            <aside className="bulletin-board" aria-labelledby="orchard-board-title">
              <div className="bulletin-board-inner">
                <header className="bulletin-board-header">
                  <span className="bulletin-board-mark" aria-hidden="true">
                    <Sprout size={18} />
                  </span>
                  <div>
                    <span className="bulletin-board-eyebrow">Fresh from Chittoor</span>
                    <h2 id="orchard-board-title">Orchard Notice Board</h2>
                  </div>
                </header>

                <div className="bulletin-notes-container" aria-live="polite" aria-atomic="true">
                  {(() => {
                    const { label, message } = formatNotice(notices[currentNoticeIndex]);

                    return (
                      <article
                        key={currentNoticeIndex}
                        className={`bulletin-note bulletin-note-${(currentNoticeIndex % 3) + 1}`}
                      >
                        <span className="bulletin-note-pin" aria-hidden="true">
                          <Pin size={17} strokeWidth={2.4} />
                        </span>
                        <span className="bulletin-note-label">{label}</span>
                        <p className="bulletin-note-text">{message}</p>
                      </article>
                    );
                  })()}
                </div>

                {notices.length > 1 && (
                  <div className="bulletin-board-navigation" aria-label="Choose an orchard notice">
                    <div className="bulletin-board-progress" aria-hidden="true">
                      <span key={currentNoticeIndex} />
                    </div>
                    <div className="bulletin-board-dots">
                      {notices.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`bulletin-board-dot ${idx === currentNoticeIndex ? 'active' : ''}`}
                          aria-label={`Show notice ${idx + 1} of ${notices.length}`}
                          aria-current={idx === currentNoticeIndex ? 'true' : undefined}
                          onClick={() => setActiveNoticeIndex(idx)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <footer className="bulletin-board-footer">
                  <Leaf size={15} aria-hidden="true" />
                  <span>Seasonal notes from our partner farms</span>
                </footer>
              </div>
            </aside>
          )}
        </div>
      </section>

      <div className="container" style={{ marginTop: '2.5rem' }}>

        {/* WhatsApp Checkout CTA (Conditional) */}
        {waNumber.trim() !== '' && (
          <section className="whatsapp-card-section">
            <div className="whatsapp-info">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaWhatsapp size={22} aria-hidden="true" />
                <span>Prefer to order on WhatsApp?</span>
              </h3>
              <p>Skip the cart and message our operations desk directly to place your order.</p>
            </div>
            <a
              href={`https://wa.me/${waNumber}?text=Hi!%20I%20want%20to%20order%20mangoes.`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary whatsapp-btn"
            >
              <FaWhatsapp size={19} aria-hidden="true" />
              Order on WhatsApp →
            </a>
          </section>
        )}

        {/* Value Propositions / Features */}
        <section className="features-section">
          <div className="feature-title">
            <h2>Why Chittoor Farms?</h2>
            <p style={{ maxWidth: '600px', margin: '0.5rem auto 0 auto' }}>
              We bypass middle-men, cold chambers, and chemicals to offer you fruit the way nature intended.
            </p>
          </div>

          <div className="grid-responsive">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Truck size={28} />
              </div>
              <h3>Bypasses Cold Storage</h3>
              <p>Our mangoes go straight from tree branches to delivery boxes. We never store fruit in nitrogenated cold warehouses.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: 'var(--secondary)', background: 'var(--secondary-light)' }}>
                <Leaf size={28} />
              </div>
              <h3>Naturally Ripened</h3>
              <p>We do not use hazardous chemicals like calcium carbide. All mangoes are ripened using traditional hay-sorting methods.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
                <Award size={28} />
              </div>
              <h3>Direct Support</h3>
              <p>We pay our partner farmers in Chittoor district up to 40% more than wholesale markets, supporting local agriculture directly.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
