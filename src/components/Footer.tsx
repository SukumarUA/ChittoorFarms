import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useSettings } from '../context/SettingsContext';

export const Footer: React.FC = () => {
  const { settings } = useSettings();
  const waNumber = settings.wa_number;

  return (
    <footer className="app-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Column 1: Brand & Socials */}
          <div className="footer-brand" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontFamily: 'Outfit', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-light)' }}>
              Chittoor Farms
            </span>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Empowering local family farms in Chittoor district, Andhra Pradesh by connecting them directly to consumers. Farm-picked, naturally ripened, and bypasses cold storage.
            </p>
            {/* Social Icons */}
            <div className="footer-socials" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              {/* Facebook Inline SVG */}
              <a href="https://www.facebook.com/profile.php?id=61590824004086" target="_blank" rel="noopener noreferrer" className="social-icon-link" aria-label="Facebook">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.8z" />
                </svg>
              </a>
              {/* Instagram Inline SVG */}
              <a href="https://www.instagram.com/chittoor_farms?igsh=MWMxNjZ2NG84MDE3bA%3D%3D" target="_blank" rel="noopener noreferrer" className="social-icon-link" aria-label="Instagram">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              {/* Twitter Inline SVG */}
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-icon-link" aria-label="Twitter">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* YouTube Inline SVG */}
              <a href="https://youtube.com/@chittoorfarms?si=aM3cIHJoy2rvMdTA" target="_blank" rel="noopener noreferrer" className="social-icon-link" aria-label="YouTube">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              {waNumber.trim() !== '' && (
                <a href={`https://wa.me/${waNumber}?text=Hello%20Chittoor%20farms!`} target="_blank" rel="noopener noreferrer" className="social-icon-link" aria-label="WhatsApp">
                  <FaWhatsapp size={17} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="footer-nav">
            <h4>Quick Links</h4>
            <ul className="footer-nav-links">
              <li>
                <Link to="/" className="footer-nav-link">Home Page</Link>
              </li>
              <li>
                <Link to="/shop" className="footer-nav-link">Shop Products</Link>
              </li>
              <li>
                <Link to="/farms" className="footer-nav-link">Partner Farms</Link>
              </li>
              <li>
                <Link to="/about" className="footer-nav-link">About Us</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Partnerships */}
          <div className="footer-nav">
            <h4>Grow With Us</h4>
            <ul className="footer-nav-links">
              <li>
                <Link to="/farms" className="footer-nav-link">Farmer Partnership</Link>
              </li>
              <li>
                <Link to="/about" className="footer-nav-link">Book a Farm Visit</Link>
              </li>
              <li>
                <Link to="/farms" className="footer-nav-link">Verified Orchards</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Operations */}
          <div className="footer-nav">
            <h4>Contact Operations</h4>
            <ul className="footer-nav-links" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={14} />
                <span>+91 93900 33516</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={14} />
                <span>contact@chittoorfarms.in</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={14} />
                <span>Chittoor, Andhra Pradesh, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Chittoor Farms. All rights reserved.</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
            Bypassing middle-men & cold storage for authentic farm sweetness.
          </p>
          <p style={{ marginTop: '0.4rem' }}>
            <Link to="/privacy" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', textDecoration: 'underline' }}>
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
};
