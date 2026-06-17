-- Migration: Referral codes, promo codes, and discount tracking on orders

-- ─────────────────────────────────────────────
-- 1. referral_codes table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  uses_count  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Only admin (SECURITY DEFINER functions) can touch this table directly
CREATE POLICY "Deny public access to referral_codes"
  ON public.referral_codes FOR ALL USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────
-- 2. promo_codes table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                       TEXT        NOT NULL UNIQUE,
  description                TEXT,
  discount_pct               NUMERIC(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 100),
  requires_returning_customer BOOLEAN     NOT NULL DEFAULT false,
  is_active                  BOOLEAN     NOT NULL DEFAULT true,
  uses_count                 INTEGER     NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny public access to promo_codes"
  ON public.promo_codes FOR ALL USING (false) WITH CHECK (false);

-- Seed default REORDER promo code
INSERT INTO public.promo_codes (code, description, discount_pct, requires_returning_customer, is_active)
VALUES ('REORDER', 'Returning customer reorder discount', 5.00, true, true)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. Add discount columns to orders
-- ─────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referral_code    TEXT,
  ADD COLUMN IF NOT EXISTS promo_code       TEXT,
  ADD COLUMN IF NOT EXISTS discount_pct     NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_total   NUMERIC(10,2);

-- ─────────────────────────────────────────────
-- 4. validate_discount_codes RPC
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_discount_codes(
  p_referral_code TEXT,
  p_promo_code    TEXT,
  p_phone         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referral_pct   NUMERIC := 0;
  v_promo_pct      NUMERIC := 0;
  v_referral_valid BOOLEAN := false;
  v_promo_valid    BOOLEAN := false;
  v_referral_msg   TEXT    := '';
  v_promo_msg      TEXT    := '';
  v_is_returning   BOOLEAN := false;
  v_current_year   INT     := EXTRACT(YEAR FROM now())::INT;
BEGIN
  -- ── Referral code check ──────────────────────────────────────────────
  IF p_referral_code IS NOT NULL AND trim(p_referral_code) <> '' THEN
    SELECT discount_pct INTO v_referral_pct
      FROM public.referral_codes -- note: we use a fixed 10% per business rule, stored on code row? No — business rule is flat 10% for any active referral code
      WHERE UPPER(code) = UPPER(trim(p_referral_code))
        AND is_active = true
      LIMIT 1;

    IF v_referral_pct IS NULL THEN
      -- Try again without pct (code exists but we use 10% flat)
      -- Actually let's store pct on referral_codes too for flexibility
      v_referral_valid := false;
      v_referral_msg   := 'Invalid or inactive referral code.';
      v_referral_pct   := 0;
    ELSE
      v_referral_valid := true;
      v_referral_msg   := 'Referral code applied!';
    END IF;
  END IF;

  -- ── Promo code check ─────────────────────────────────────────────────
  IF p_promo_code IS NOT NULL AND trim(p_promo_code) <> '' THEN
    DECLARE
      v_req_returning BOOLEAN;
    BEGIN
      SELECT discount_pct, requires_returning_customer
        INTO v_promo_pct, v_req_returning
        FROM public.promo_codes
       WHERE UPPER(code) = UPPER(trim(p_promo_code))
         AND is_active = true
       LIMIT 1;

      IF v_promo_pct IS NULL THEN
        v_promo_valid := false;
        v_promo_msg   := 'Invalid or inactive promo code.';
        v_promo_pct   := 0;
      ELSE
        IF v_req_returning THEN
          -- Check if phone has any order in current year
          SELECT EXISTS (
            SELECT 1 FROM public.orders
             WHERE phone = p_phone
               AND EXTRACT(YEAR FROM created_at) = v_current_year
          ) INTO v_is_returning;

          IF v_is_returning THEN
            v_promo_valid := true;
            v_promo_msg   := 'Reorder discount applied!';
          ELSE
            v_promo_valid := false;
            v_promo_msg   := 'REORDER code is only valid for returning customers.';
            v_promo_pct   := 0;
          END IF;
        ELSE
          v_promo_valid := true;
          v_promo_msg   := 'Promo code applied!';
        END IF;
      END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'referral_valid',   v_referral_valid,
    'referral_pct',     v_referral_pct,
    'referral_msg',     v_referral_msg,
    'promo_valid',      v_promo_valid,
    'promo_pct',        v_promo_pct,
    'promo_msg',        v_promo_msg,
    'total_discount_pct', (v_referral_pct + v_promo_pct)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount_codes(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ─────────────────────────────────────────────
-- 5. Update create_order RPC to accept & apply discounts
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name          TEXT,
  p_phone                  TEXT,
  p_address                TEXT,
  p_pin_code               TEXT,
  p_preferred_delivery_date DATE,
  p_special_instructions   TEXT,
  p_items                  JSONB,
  p_total                  NUMERIC,
  p_referral_code          TEXT DEFAULT NULL,
  p_promo_code             TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_date      DATE    := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_sequence        INTEGER;
  v_order_number    TEXT;
  v_item            JSONB;
  v_product         RECORD;
  v_qty             INTEGER;
  v_computed_total  NUMERIC := 0;
  v_enriched_items  JSONB   := '[]'::JSONB;
  v_discount_pct    NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_final_total     NUMERIC := 0;
  v_ref_pct         NUMERIC := 0;
  v_promo_pct       NUMERIC := 0;
  v_current_year    INT     := EXTRACT(YEAR FROM now())::INT;
  v_is_returning    BOOLEAN := false;
  v_req_returning   BOOLEAN := false;
BEGIN
  -- ── Step 1: Validate stock and atomically decrement ──────────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity (%) for product %.', v_item->>'quantity', v_item->>'product_id';
    END IF;

    SELECT id, name, price, unit, stock INTO v_product
      FROM public.products
     WHERE id = (v_item->>'product_id')::UUID AND active = true
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product "%" is unavailable or does not exist.', v_item->>'product_id';
    END IF;
    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Only % unit(s) of "%" available (you requested %).', v_product.stock, v_product.name, v_qty;
    END IF;

    UPDATE public.products SET stock = stock - v_qty WHERE id = v_product.id;
    v_computed_total := v_computed_total + (v_product.price * v_qty);
    v_enriched_items := v_enriched_items || jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name,
      'quantity',   v_qty,        'unit', v_product.unit,
      'price',      v_product.price
    );
  END LOOP;

  -- ── Step 2: Validate and apply discount codes ─────────────────────────
  -- Referral code
  IF p_referral_code IS NOT NULL AND trim(p_referral_code) <> '' THEN
    SELECT discount_pct INTO v_ref_pct
      FROM public.referral_codes
     WHERE UPPER(code) = UPPER(trim(p_referral_code)) AND is_active = true
     LIMIT 1;

    IF v_ref_pct IS NOT NULL AND v_ref_pct > 0 THEN
      UPDATE public.referral_codes
         SET uses_count = uses_count + 1
       WHERE UPPER(code) = UPPER(trim(p_referral_code));
    ELSE
      v_ref_pct := 0;
    END IF;
  END IF;

  -- Promo code
  IF p_promo_code IS NOT NULL AND trim(p_promo_code) <> '' THEN
    SELECT discount_pct, requires_returning_customer INTO v_promo_pct, v_req_returning
      FROM public.promo_codes
     WHERE UPPER(code) = UPPER(trim(p_promo_code)) AND is_active = true
     LIMIT 1;

    IF v_promo_pct IS NOT NULL AND v_promo_pct > 0 THEN
      IF v_req_returning THEN
        SELECT EXISTS (
          SELECT 1 FROM public.orders
           WHERE phone = p_phone
             AND EXTRACT(YEAR FROM created_at) = v_current_year
        ) INTO v_is_returning;
        IF NOT v_is_returning THEN
          v_promo_pct := 0; -- not eligible
        END IF;
      END IF;

      IF v_promo_pct > 0 THEN
        UPDATE public.promo_codes
           SET uses_count = uses_count + 1
         WHERE UPPER(code) = UPPER(trim(p_promo_code));
      END IF;
    ELSE
      v_promo_pct := 0;
    END IF;
  END IF;

  v_discount_pct    := v_ref_pct + v_promo_pct;
  v_discount_amount := ROUND(v_computed_total * v_discount_pct / 100, 2);
  v_final_total     := v_computed_total - v_discount_amount;

  -- ── Step 3: Generate daily sequential order number ───────────────────
  INSERT INTO public.order_daily_sequences (order_date, last_value)
  VALUES (v_order_date, 1)
  ON CONFLICT (order_date)
  DO UPDATE SET last_value = public.order_daily_sequences.last_value + 1
  RETURNING last_value INTO v_sequence;

  v_order_number := 'CF-' || TO_CHAR(v_order_date, 'DDMMYYYY') || '-' || LPAD(v_sequence::TEXT, 3, '0');

  -- ── Step 4: Insert order ─────────────────────────────────────────────
  INSERT INTO public.orders (
    order_number, customer_name, phone, address, pin_code,
    preferred_delivery_date, special_instructions, items,
    total, status,
    referral_code, promo_code, discount_pct, discount_amount, original_total
  ) VALUES (
    v_order_number, trim(p_customer_name), p_phone, trim(p_address),
    nullif(trim(p_pin_code), ''), p_preferred_delivery_date,
    nullif(trim(p_special_instructions), ''), v_enriched_items,
    v_final_total, 'pending',
    nullif(trim(coalesce(p_referral_code, '')), ''),
    nullif(trim(coalesce(p_promo_code, '')), ''),
    v_discount_pct, v_discount_amount, v_computed_total
  );

  RETURN v_order_number;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(TEXT,TEXT,TEXT,TEXT,DATE,TEXT,JSONB,NUMERIC,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(TEXT,TEXT,TEXT,TEXT,DATE,TEXT,JSONB,NUMERIC,TEXT,TEXT) TO anon, authenticated;

-- Also add discount_pct column to referral_codes (for flexible per-code rates)
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00;
