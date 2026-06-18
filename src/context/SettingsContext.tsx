import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface SiteSettings {
  hero_heading: string;
  hero_subtext: string;
  wa_number: string;
  notice_board: string;
  shop_cta_text: string;
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  social_youtube: string;
}

const DEFAULTS: SiteSettings = {
  hero_heading: 'Delicious Chittoor Mangoes, Straight from Farms',
  hero_subtext:
    'Experience the unparalleled taste of premium, naturally ripened mangoes directly from local family orchards. Delivered fresh to you within hours of picking, bypassing cold storage entirely.',
  wa_number: '919390033516',
  notice_board:
    '• Notice: Fresh Banganapalli harvest arriving this Friday! Pre-orders are open now.\n• Orchard Visits: Bookings for Sri Venkateswara Farm visits are available for the coming Sunday.',
  shop_cta_text: 'Shop Mangoes',
  social_facebook: '',
  social_instagram: '',
  social_twitter: '',
  social_youtube: '',
};

interface SettingsContextValue {
  settings: SiteSettings;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  isLoading: true,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('hero_heading, hero_subtext, wa_number, notice_board, shop_cta_text, social_facebook, social_instagram, social_twitter, social_youtube')
          .eq('id', 'main')
          .single();
        if (!error && data) {
          setSettings({
            hero_heading:     data.hero_heading     || DEFAULTS.hero_heading,
            hero_subtext:     data.hero_subtext     || DEFAULTS.hero_subtext,
            wa_number:        data.wa_number        || DEFAULTS.wa_number,
            notice_board:     data.notice_board     ?? DEFAULTS.notice_board,
            shop_cta_text:    data.shop_cta_text    || DEFAULTS.shop_cta_text,
            social_facebook:  data.social_facebook  || '',
            social_instagram: data.social_instagram || '',
            social_twitter:   data.social_twitter   || '',
            social_youtube:   data.social_youtube   || '',
          });
        }
      } catch (err) {
        console.error('SettingsContext: failed to load settings', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
