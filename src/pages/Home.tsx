import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, CheckCircle, Globe, Heart, Leaf,
  Package, Pin, Shield, Sprout, Star, Truck, Users, Zap,
} from 'lucide-react';

// Icon map for CMS-driven feature cards
const FEATURE_ICON_MAP: Record<string, React.ReactNode> = {
  Truck:       <Truck size={28} />,
  Leaf:        <Leaf size={28} />,
  Award:       <Award size={28} />,
  Shield:      <Shield size={28} />,
  Star:        <Star size={28} />,
  CheckCircle: <CheckCircle size={28} />,
  Heart:       <Heart size={28} />,
  Zap:         <Zap size={28} />,
  Users:       <Users size={28} />,
  Globe:       <Globe size={28} />,
  Package:     <Package size={28} />,
};

// Colour cycle for cards when no specific colour is set
const CARD_COLORS = [
  {},
  { color: 'var(--secondary)', background: 'var(--secondary-light)' },
  { color: 'var(--accent)',    background: 'var(--accent-light)' },
];
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';

interface FeaturedFarmUpdate {
  id: string;
  farm_name: string;
  farm_update: string;
}

const greetings = [
  { native: 'नमस्ते', english: 'Namaste', language: 'hi' },
  { native: 'নমস্কার', english: 'Nomoshkar', language: 'bn' },
  { native: 'नमस्कार', english: 'Namaskar', language: 'mr' },
  { native: 'నమస్కారం', english: 'Namaskaram', language: 'te' },
  { native: 'வணக்கம்', english: 'Vanakkam', language: 'ta' },
  { native: 'નમસ્તે', english: 'Namaste', language: 'gu' },
  { native: 'السلام علیکم', english: 'Assalamu Alaikum', language: 'ur', direction: 'rtl' as const },
  { native: 'ನಮಸ್ಕಾರ', english: 'Namaskara', language: 'kn' },
  { native: 'ନମସ୍କାର', english: 'Namaskar', language: 'or' },
  { native: 'നമസ്കാരം', english: 'Namaskaram', language: 'ml' },
  { native: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', english: 'Sat Sri Akal', language: 'pa' },
  { native: 'নমস্কাৰ', english: 'Nomoskar', language: 'as' },
  { native: 'प्रणाम', english: 'Pranam', language: 'hi' },
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [featuredFarmUpdates, setFeaturedFarmUpdates] = useState<FeaturedFarmUpdate[]>([]);
  const [activeNoticeIndex, setActiveNoticeIndex] = useState(0);
  const [activeGreetingIndex, setActiveGreetingIndex] = useState(0);

  useEffect(() => {
    const fetchFeaturedFarmUpdates = async () => {
      try {
        const { data, error } = await supabase
          .from('farms')
          .select('id, farm_name, farm_update')
          .eq('active', true)
          .eq('feature_update_on_notice_board', true)
          .not('farm_update', 'is', null)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setFeaturedFarmUpdates((data || []).filter((farm) => farm.farm_update?.trim()));
      } catch (err) {
        console.error('Error fetching featured farm updates:', err);
      }
    };

    fetchFeaturedFarmUpdates();
  }, []);

  const heroHeading   = settings.hero_heading;
  const heroSubtext   = settings.hero_subtext;
  const waNumber      = settings.wa_number;
  const shopCtaText   = settings.shop_cta_text;
  const noticeBoardText = settings.notice_board;
  const cmsNotices = noticeBoardText.split('\n').filter(line => line.trim() !== '');
  const farmNotices = featuredFarmUpdates.map((farm) => `${farm.farm_name}: ${farm.farm_update}`);
  const notices = [...cmsNotices, ...farmNotices];
  const currentNoticeIndex = notices.length > 0 ? activeNoticeIndex % notices.length : 0;

  useEffect(() => {
    if (notices.length <= 1) return;

    const rotationTimer = window.setTimeout(() => {
      setActiveNoticeIndex((currentIndex) => (currentIndex + 1) % notices.length);
    }, 6000);

    return () => window.clearTimeout(rotationTimer);
  }, [activeNoticeIndex, notices.length]);

  useEffect(() => {
    const rotationTimer = window.setInterval(() => {
      setActiveGreetingIndex((currentIndex) => (currentIndex + 1) % greetings.length);
    }, 3200);

    return () => window.clearInterval(rotationTimer);
  }, []);

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
            <div className="hero-greeting" aria-live="polite" aria-atomic="true">
              <div key={activeGreetingIndex} className="hero-greeting-content">
                <span
                  className="hero-greeting-native"
                  lang={greetings[activeGreetingIndex].language}
                  dir={greetings[activeGreetingIndex].direction}
                >
                  {greetings[activeGreetingIndex].native}
                </span>
                <span className="hero-greeting-english">
                  ({greetings[activeGreetingIndex].english})
                </span>
              </div>
            </div>
            <h1 className="hero-heading">{heroHeading}</h1>
            <p className="hero-subtext">{heroSubtext}</p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => navigate('/shop')}>
                {shopCtaText}
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
              href={`https://wa.me/${waNumber}?text=Hi!%20I%20want%20to%20place%20an%20order.`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary whatsapp-btn"
            >
              <FaWhatsapp size={19} aria-hidden="true" />
              Order on WhatsApp →
            </a>
          </section>
        )}

        {/* Value Propositions / Features — driven by CMS */}
        {settings.feature_cards.length > 0 && (
          <section className="features-section">
            <div className="feature-title">
              <h2>{settings.features_heading}</h2>
              {settings.features_subtext && (
                <p style={{ maxWidth: '600px', margin: '0.5rem auto 0 auto' }}>
                  {settings.features_subtext}
                </p>
              )}
            </div>
            <div className="grid-responsive">
              {settings.feature_cards.map((card, idx) => {
                const iconName = card.icon || ['Truck', 'Leaf', 'Award'][idx] || 'Star';
                const colorStyle = CARD_COLORS[idx % CARD_COLORS.length];
                return (
                  <div key={idx} className="feature-card">
                    <div className="feature-icon-wrapper" style={colorStyle}>
                      {FEATURE_ICON_MAP[iconName] ?? <Star size={28} />}
                    </div>
                    <h3>{card.heading}</h3>
                    <p>{card.body}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
