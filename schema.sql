-- Chittoor Farms Database Schema & Initial Seed Data
-- This file reflects the final schema after all migrations and should be
-- used for fresh project setup. Run migrations separately if upgrading an
-- existing database (supabase/migrations/).

-- =========================================================================
-- 1. Tables Creation
-- =========================================================================

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Mangoes',
    use TEXT CHECK (use IN ('fresh', 'juice', 'pickle')),
    description TEXT,
    price NUMERIC NOT NULL CHECK (price >= 0),
    unit TEXT NOT NULL,
    stock NUMERIC NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Farms table
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_name TEXT NOT NULL,
    farmer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    location TEXT NOT NULL,
    varieties TEXT NOT NULL,
    acres NUMERIC CHECK (acres > 0),
    since_year INTEGER,
    story TEXT NOT NULL,
    photo_url TEXT,
    instagram_url TEXT,
    youtube_url TEXT,
    farm_update TEXT,
    feature_update_on_notice_board BOOLEAN NOT NULL DEFAULT false,
    farm_type TEXT,
    district TEXT,
    mandal TEXT,
    village TEXT,
    pincode TEXT,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Daily order number sequences (one row per IST date)
CREATE TABLE IF NOT EXISTS public.order_daily_sequences (
    order_date DATE PRIMARY KEY,
    last_value INTEGER NOT NULL DEFAULT 0
);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    order_number TEXT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    pin_code TEXT,
    preferred_delivery_date DATE,
    special_instructions TEXT,
    items JSONB NOT NULL, -- Format: Array of { product_id, name, quantity, unit, price }
    total NUMERIC NOT NULL CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'failed')),
    payment_mode TEXT CHECK (payment_mode IN ('UPI', 'Cash on delivery', 'Bank transfer', 'Card')),
    payment_amount NUMERIC CHECK (payment_amount >= 0),
    payment_reference TEXT,
    payment_notes TEXT,
    payment_recorded_at TIMESTAMP WITH TIME ZONE
);

-- Farmer Partnership Applications table
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    farmer_name TEXT,
    location TEXT NOT NULL,
    farm_type TEXT,
    district TEXT,
    mandal TEXT,
    village TEXT,
    pincode TEXT,
    orchard_size NUMERIC,
    farming_since INTEGER,
    varieties_grown TEXT,
    story TEXT NOT NULL,
    photo_url TEXT,
    farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'approved', 'rejected'))
);

-- Farm Visit Bookings table
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    preferred_farm TEXT,
    preferred_date DATE,
    group_size TEXT,
    purpose TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

-- Settings table
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'main' CHECK (id = 'main'),
    hero_heading TEXT NOT NULL DEFAULT 'Direct from Chittoor Farms to Your Doorstep',
    hero_subtext TEXT NOT NULL DEFAULT 'Savor the authentic taste of naturally ripened premium mangoes, harvested with care and delivered fresh.',
    banner_img_url TEXT,
    wa_number TEXT DEFAULT '919876543210',
    notice_board TEXT DEFAULT '',
    team JSONB NOT NULL DEFAULT '[]'::jsonb,
    categories JSONB NOT NULL DEFAULT '["Mangoes", "Coconuts", "Pulses", "Coldpressed Oils"]'::jsonb,
    farm_types JSONB NOT NULL DEFAULT '["Mango Farm", "Rice Farm", "Coconut Farm", "Dairy Farm"]'::jsonb,
    shop_cta_text TEXT NOT NULL DEFAULT 'Shop Mangoes',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) not null
);

-- =========================================================================
-- 2. Row Level Security (RLS) Configuration
-- =========================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_daily_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Helper to check if the authenticated user is the designated admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt() ->> 'email') = 'chinthalapudisukumar@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Products policies
CREATE POLICY "Allow public read access to active products" ON public.products
    FOR SELECT USING (active = true);

CREATE POLICY "Allow admin full access to products" ON public.products
    FOR ALL TO authenticated USING (public.is_admin());

-- Farms policies
CREATE POLICY "Allow public read access to active farms" ON public.farms
    FOR SELECT USING (active = true);

CREATE POLICY "Allow admin full access to farms" ON public.farms
    FOR ALL TO authenticated USING (public.is_admin());

-- order_daily_sequences policies
-- Direct access is denied. The only legitimate path is through create_order()
-- which runs as SECURITY DEFINER and bypasses RLS.
CREATE POLICY "Deny direct read access to order sequences"
    ON public.order_daily_sequences
    FOR SELECT
    USING (false);

CREATE POLICY "Deny direct write access to order sequences"
    ON public.order_daily_sequences
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Orders policies
CREATE POLICY "Allow public to insert orders" ON public.orders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin full access to orders" ON public.orders
    FOR ALL TO authenticated USING (public.is_admin());

-- Applications policies
CREATE POLICY "Allow public to insert applications" ON public.applications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin full access to applications" ON public.applications
    FOR ALL TO authenticated USING (public.is_admin());

-- Visits policies
CREATE POLICY "Allow public to insert visits" ON public.visits
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin full access to visits" ON public.visits
    FOR ALL TO authenticated USING (public.is_admin());

-- Settings policies
CREATE POLICY "Allow public read access to settings" ON public.settings
    FOR SELECT USING (true);

CREATE POLICY "Allow admin full access to settings" ON public.settings
    FOR ALL TO authenticated USING (public.is_admin());

-- =========================================================================
-- 3. Functions
-- =========================================================================

-- create_order: atomically validates stock (with row-level locking), decrements
-- stock, computes the total from authoritative DB prices (ignores client total),
-- and assigns a daily sequential order number in IST (YYYYMMDDCF00001 format).
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name          TEXT,
  p_phone                  TEXT,
  p_address                TEXT,
  p_pin_code               TEXT,
  p_preferred_delivery_date DATE,
  p_special_instructions   TEXT,
  p_items                  JSONB,
  p_total                  NUMERIC  -- kept for API compatibility; ignored -- server recomputes from DB prices
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_date     DATE    := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_sequence       INTEGER;
  v_order_number   TEXT;
  v_item           JSONB;
  v_product        RECORD;
  v_qty            INTEGER;
  v_computed_total NUMERIC := 0;
  v_enriched_items JSONB   := '[]'::JSONB;
BEGIN
  -- Step 1: Validate stock and atomically decrement for every item
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity (%) for product %.',
        v_item->>'quantity', v_item->>'product_id';
    END IF;

    -- Acquire a row-level lock so concurrent transactions wait rather than
    -- reading stale stock and both succeeding on the same units.
    SELECT id, name, price, unit, stock
      INTO v_product
      FROM public.products
     WHERE id     = (v_item->>'product_id')::UUID
       AND active = true
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product "%" is unavailable or does not exist.',
        v_item->>'product_id';
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Only % unit(s) of "%" available (you requested %).',
        v_product.stock, v_product.name, v_qty;
    END IF;

    -- Atomic decrement -- inside the transaction, committed only if all items pass
    UPDATE public.products
       SET stock = stock - v_qty
     WHERE id = v_product.id;

    -- Accumulate total from DB price (client-submitted price is ignored)
    v_computed_total := v_computed_total + (v_product.price * v_qty);

    -- Build enriched item record using authoritative DB values
    v_enriched_items := v_enriched_items || jsonb_build_object(
      'product_id', v_product.id,
      'name',       v_product.name,
      'quantity',   v_qty,
      'unit',       v_product.unit,
      'price',      v_product.price
    );
  END LOOP;

  -- Step 2: Generate daily sequential order number (IST date)
  INSERT INTO public.order_daily_sequences (order_date, last_value)
  VALUES (v_order_date, 1)
  ON CONFLICT (order_date)
  DO UPDATE SET last_value = public.order_daily_sequences.last_value + 1
  RETURNING last_value INTO v_sequence;

  v_order_number := to_char(v_order_date, 'YYYYMMDD')
    || 'CF'
    || lpad(v_sequence::TEXT, 5, '0');

  -- Step 3: Insert order using server-computed total and enriched items
  INSERT INTO public.orders (
    order_number,
    customer_name,
    phone,
    address,
    pin_code,
    preferred_delivery_date,
    special_instructions,
    items,
    total,
    status
  ) VALUES (
    v_order_number,
    trim(p_customer_name),
    p_phone,
    trim(p_address),
    nullif(trim(p_pin_code), ''),
    p_preferred_delivery_date,
    nullif(trim(p_special_instructions), ''),
    v_enriched_items,
    v_computed_total,
    'pending'
  );

  RETURN v_order_number;
END;
$$;

-- Callable by anonymous (public checkout) and authenticated (admin) users.
REVOKE ALL ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, NUMERIC) TO anon, authenticated;

-- =========================================================================
-- 4. Storage Configuration (chittoor-farms bucket)
-- =========================================================================

-- Note: Ensure storage.buckets exists before executing.
-- If running manually in the Supabase Dashboard, create a public bucket named 'chittoor-farms'.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chittoor-farms', 'chittoor-farms', true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket security policies
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'chittoor-farms');

CREATE POLICY "Admin Full Storage Access"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'chittoor-farms' AND public.is_admin())
WITH CHECK (bucket_id = 'chittoor-farms' AND public.is_admin());

-- =========================================================================
-- 5. Initial Seed Data
-- =========================================================================

-- Seed Settings
INSERT INTO public.settings (id, hero_heading, hero_subtext, banner_img_url, wa_number, notice_board, team, categories, farm_types, shop_cta_text)
VALUES (
    'main',
    'Delicious Chittoor Mangoes, Straight from Farms',
    'Experience the unparalleled taste of premium, naturally ripened mangoes directly from local family orchards. Delivered fresh to you within hours of picking, bypassing cold storage entirely.',
    'https://images.unsplash.com/photo-1553135933-0d13db7f0ece?auto=format&fit=crop&q=80&w=1200',
    '919390033516',
    '• Notice: Fresh Banganapalli harvest arriving this Friday! Pre-orders are open now.
• Orchard Visits: Bookings for Sri Venkateswara Farm visits are available for the coming Sunday.',
    '[
        {
            "name": "Sukumar Chinthalapudi",
            "role": "Founder",
            "bio": "Sukumar is dedicated to empowering local farmers in Chittoor district and bringing clean, unadulterated fruit directly to urban customers."
        },
        {
            "name": "Dilip Vuppalapati",
            "role": "Co-Founder & Supply Chain",
            "bio": "Dilip leads supply chain operations, coordinating with partner farms to ensure every harvest reaches customers fresh and on time."
        }
    ]'::jsonb,
    '["Mangoes", "Coconuts", "Pulses", "Coldpressed Oils"]'::jsonb,
    '["Mango Farm", "Rice Farm", "Coconut Farm", "Dairy Farm"]'::jsonb,
    'Shop Mangoes'
)
ON CONFLICT (id) DO UPDATE
SET hero_heading = EXCLUDED.hero_heading,
    hero_subtext = EXCLUDED.hero_subtext,
    wa_number = EXCLUDED.wa_number,
    notice_board = EXCLUDED.notice_board,
    team = EXCLUDED.team,
    categories = COALESCE(settings.categories, EXCLUDED.categories),
    farm_types = COALESCE(settings.farm_types, EXCLUDED.farm_types),
    shop_cta_text = COALESCE(settings.shop_cta_text, EXCLUDED.shop_cta_text);

-- Seed Products
INSERT INTO public.products (name, use, description, price, unit, stock, image_url, sort_order, active)
VALUES
    (
        'Banganapalli (Benishan)',
        'fresh',
        'The king of mangoes in South India. Large size, sweet aroma, skin is thin and yellow. Fiberless, firm flesh perfect for slicing.',
        150,
        '1 kg',
        45,
        'https://images.unsplash.com/photo-1553135933-0d13db7f0ece?auto=format&fit=crop&q=80&w=600',
        1,
        true
    ),
    (
        'Totapuri (Collector)',
        'pickle',
        'Known for its distinct beak-like shape. Mildly sweet, crunchy texture. Ideal for raw salads, pickling, and traditional sour chutneys.',
        80,
        '1 kg',
        60,
        'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&q=80&w=600',
        2,
        true
    ),
    (
        'Neelum',
        'juice',
        'Late-season variety with highly aromatic orange pulp. Rich, syrup-like sweetness makes it outstanding for pulping, juices, and milkshakes.',
        110,
        '1 kg',
        8,
        'https://images.unsplash.com/photo-1591073113125-e46713c829ed?auto=format&fit=crop&q=80&w=600',
        3,
        true
    ),
    (
        'Alphonso (Hapus)',
        'fresh',
        'A luxurious cultivar loved for its deep orange flesh, intense flavor profile, and creamy texture. Completely fiberless fruit.',
        250,
        '1 kg',
        0,
        'https://images.unsplash.com/photo-1553135933-0d13db7f0ece?auto=format&fit=crop&q=80&w=600',
        4,
        true
    )
ON CONFLICT DO NOTHING;

-- Seed Farms
INSERT INTO public.farms (farm_name, farmer_name, phone, location, varieties, acres, since_year, story, photo_url, sort_order, active)
VALUES
    (
        'Sri Venkateswara Mango Gardens',
        'K. Ananda Naidu',
        '919440123456',
        'Puthalapattu, Chittoor District',
        'Banganapalli, Totapuri, Neelum',
        12.5,
        1994,
        'Founded by Ananda''s father, this orchard has stood for over 30 years. They rely heavily on natural composting and drip irrigation. Every mango from this garden is carefully hand-harvested to prevent bruising and sorted under the shade of ancient tamarind trees.',
        'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=600',
        1,
        true
    ),
    (
        'Reddy Family Mango Orchard',
        'M. Ramachandra Reddy',
        '919848987654',
        'Bangarupalyam, Chittoor District',
        'Banganapalli, Alphonso',
        8.0,
        2008,
        'Ramachandra Reddy transitioned his family farm to biological pest management in 2015. By encouraging natural predators and growing companion crops like marigolds, the farm produces high-yield, pesticide-free Alphonso mangoes that have a deep, unforgettable aroma.',
        'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&q=80&w=600',
        2,
        true
    )
ON CONFLICT DO NOTHING;
