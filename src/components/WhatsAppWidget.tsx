import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { useSettings } from '../context/SettingsContext';

export const WhatsAppWidget: React.FC = () => {
  const { settings } = useSettings();
  const waNumber = settings.wa_number;

  if (waNumber.trim() === '') {
    return null;
  }

  const waUrl = `https://wa.me/${waNumber}?text=Hello%20Chittoor%20farms!`;

  return (
    <div className="wa-widget-container">
      {/* Floating Chat Bubble Button directly pointing to WhatsApp */}
      <a 
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-bubble" 
        aria-label="WhatsApp chat widget"
      >
        <div className="wa-bubble-pulse"></div>
        <FaWhatsapp className="wa-brand-icon" aria-hidden="true" />
      </a>
    </div>
  );
};
