import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface FeatureCard {
  heading: string;
  body: string;
  icon?: string;
}

export interface HeritageStat {
  num: string;
  label: string;
  desc: string;
}

export interface SiteSettings {
  // Hero
  hero_heading: string;
  hero_subtext: string;
  wa_number: string;
  notice_board: string;
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
  // About — heritage section
  heritage_badge: string;
  heritage_title: string;
  heritage_body: string;
  // About — visit CTA
  visit_cta_heading: string;
  visit_cta_text: string;
  // Home — feature cards
  features_heading: string;
  features_subtext: string;
  feature_cards: FeatureCard[];
  // About — heritage stats
  heritage_stats: HeritageStat[];
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
  contact_phone: '+91 93900 33516',
  contact_email: 'contact@chittoorfarms.in',
  contact_address: 'Chittoor, Andhra Pradesh, India',
  footer_tagline:
    'Empowering local family farms in Chittoor district, Andhra Pradesh by connecting them directly to consumers. Farm-picked, naturally ripened, and bypasses cold storage.',
  about_story_heading: 'Connecting You to the Soil',
  about_story_body:
    "Chittoor district in Andhra Pradesh is renowned for producing some of India's finest mango varieties, yet traditional supply chains keep growers impoverished and customers eating chemically-ripened, stale fruit.<br/><br/>Chittoor Farms was founded to fix this. We work directly with verified family orchards, cut out every middleman, and deliver naturally ripened mangoes to your door within hours of harvest.",
  heritage_badge: "• CHITTOOR, INDIA'S MANGO PARADISE •",
  heritage_title: "Discover Chittoor's Mango Cultivation Heritage",
  heritage_body: [
    "Chittoor district in Andhra Pradesh is a powerhouse of premium mango cultivation. Armed with decades of local expertise, our farmers have perfected the art of nurturing orchards on nutrient-rich red laterite soils, passing down specialized grafting and cultivation techniques across generations.",
    "Today, Chittoor stands as the state's largest mango-producing belt, with 100,000+ acres dedicated to orchards. In a peak season, these orchards yield close to 500,000+ metric tonnes of high-quality fruit, cementing the region's position as a major leader in India's mango market.",
    "While the signature Totapuri mango powers 50+ pulp processing units supplying juice globally, the region is celebrated for its diversity. Premium table varieties like Banganapalli, Neelum, Imam Pasand, Sindhura, and Mallika all thrive side-by-side in these fertile orchards.",
    "What sets Chittoor farms apart is their smart multi-variety orchard tradition. Growing 4+ distinct mango varieties together naturally extends the harvest season, enhances cross-pollination, and preserves rare heritage strains that are hard to find anywhere else.",
    "To maintain this high standard of quality, local farmers invest an average of ₹30,000 per acre each season in careful cultivation, soil nourishment, and natural harvesting techniques, ensuring every mango is picked at perfect maturity.",
    "However, without a direct market, these skilled farmers are often vulnerable to exploitative middlemen and pulp conglomerates. By purchasing from Chittoor Farms, you bridge this gap directly — ensuring fair profits reach the growers while enjoying premium, naturally ripened produce delivered straight to your home.",
  ].join('\n\n'),
  visit_cta_heading: 'Visit Our Farms',
  visit_cta_text:
    'You are welcome to visit our partner farms in Chittoor. Walk through the orchards, taste fresh produce straight from the source, and meet the farmers who grow it.',
  features_heading: 'Why Chittoor Farms?',
  features_subtext:
    'We bypass middle-men, cold chambers, and chemicals to offer you fruit the way nature intended.',
  feature_cards: [
    { heading: 'Bypasses Cold Storage', body: 'Our mangoes go straight from tree branches to delivery boxes. We never store fruit in nitrogenated cold warehouses.' },
    { heading: 'Naturally Ripened',     body: 'We do not use hazardous chemicals like calcium carbide. All mangoes are ripened using traditional hay-sorting methods.' },
    { heading: 'Direct Support',        body: 'We pay our partner farmers in Chittoor district up to 40% more than wholesale markets, supporting local agriculture directly.' },
  ],
  heritage_stats: [
    { num: '100,000+', label: 'Acres Cultivated',     desc: 'Mango orchards across Chittoor district — the largest in AP' },
    { num: '500,000+', label: 'Metric Tonnes / Year', desc: "Annual harvest in a good season — one of India's largest" },
    { num: '4+',       label: 'Varieties Per Farm',   desc: 'Average number of mango types grown on a single Chittoor orchard' },
    { num: '50+',      label: 'Pulp Industries',      desc: "Processing units powered by Chittoor's Totapuri surplus" },
  ],
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rawData, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'main')
          .single();
        // Cast to any so new columns added via migration are accessible without
        // regenerating Supabase types after every schema change.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = rawData as any;
        if (!error && data) {
          setSettings({
            hero_heading:          data.hero_heading          || DEFAULTS.hero_heading,
            hero_subtext:          data.hero_subtext          || DEFAULTS.hero_subtext,
            wa_number:             data.wa_number             || DEFAULTS.wa_number,
            notice_board:          data.notice_board          ?? DEFAULTS.notice_board,
            shop_cta_text:         data.shop_cta_text         || DEFAULTS.shop_cta_text,
            social_facebook:       data.social_facebook       || '',
            social_instagram:      data.social_instagram      || '',
            social_twitter:        data.social_twitter        || '',
            social_youtube:        data.social_youtube        || '',
            contact_phone:         data.contact_phone         || DEFAULTS.contact_phone,
            contact_email:         data.contact_email         || DEFAULTS.contact_email,
            contact_address:       data.contact_address       || DEFAULTS.contact_address,
            footer_tagline:        data.footer_tagline        || DEFAULTS.footer_tagline,
            about_story_heading:   data.about_story_heading   || DEFAULTS.about_story_heading,
            about_story_body:      data.about_story_body      || DEFAULTS.about_story_body,
            heritage_badge:        data.heritage_badge        || DEFAULTS.heritage_badge,
            heritage_title:        data.heritage_title        || DEFAULTS.heritage_title,
            heritage_body:         data.heritage_body         || DEFAULTS.heritage_body,
            visit_cta_heading:     data.visit_cta_heading     || DEFAULTS.visit_cta_heading,
            visit_cta_text:        data.visit_cta_text        || DEFAULTS.visit_cta_text,
            features_heading:      data.features_heading      || DEFAULTS.features_heading,
            features_subtext:      data.features_subtext      || DEFAULTS.features_subtext,
            feature_cards:         Array.isArray(data.feature_cards)  ? data.feature_cards  : DEFAULTS.feature_cards,
            heritage_stats:        Array.isArray(data.heritage_stats) ? data.heritage_stats : DEFAULTS.heritage_stats,
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
