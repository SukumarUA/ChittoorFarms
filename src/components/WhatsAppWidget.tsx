import React, { useEffect, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../lib/supabase';

export const WhatsAppWidget: React.FC = () => {
  const [waNumber, setWaNumber] = useState('919390033516');

  useEffect(() => {
    const fetchWaNumber = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('wa_number')
          .eq('id', 'main')
          .single();
        if (data?.wa_number) {
          setWaNumber(data.wa_number);
        }
      } catch (err) {
        console.error('Error fetching WA number in widget:', err);
      }
    };
    fetchWaNumber();
  }, []);

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
