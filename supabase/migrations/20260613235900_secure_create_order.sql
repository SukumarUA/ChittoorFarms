-- Migration: Secure create_order function
--
-- Changes from original:
--   1. Locks each product row (FOR UPDATE) to prevent concurrent oversell race conditions
--   2. Validates stock >= requested quantity per item before decrementing
--   3. Atomically decrements stock inside the same transaction
--   4. Recomputes order total from authoritative DB prices — ignores the client-submitted p_total
--   5. Stores enriched items (with DB price) in the orders table

CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name          TEXT,
  p_phone                  TEXT,
  p_address                TEXT,
  p_pin_code               TEXT,
  p_preferred_delivery_date DATE,
  p_special_instructions   TEXT,
  p_items                  JSONB,
  p_total                  NUMERIC  -- kept for API compatibility; ignored — server recomputes from DB prices
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
  -- -----------------------------------------------------------------------
  -- Step 1: Validate stock and atomically decrement for every item
  -- -----------------------------------------------------------------------
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

    -- Atomic decrement — inside the transaction, committed only if all items pass
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

  -- -----------------------------------------------------------------------
  -- Step 2: Generate daily sequential order number (IST date)
  -- -----------------------------------------------------------------------
  INSERT INTO public.order_daily_sequences (order_date, last_value)
  VALUES (v_order_date, 1)
  ON CONFLICT (order_date)
  DO UPDATE SET last_value = public.order_daily_sequences.last_value + 1
  RETURNING last_value INTO v_sequence;

  v_order_number := to_char(v_order_date, 'YYYYMMDD')
    || 'CF'
    || lpad(v_sequence::TEXT, 5, '0');

  -- -----------------------------------------------------------------------
  -- Step 3: Insert order using server-computed total and enriched items
  -- -----------------------------------------------------------------------
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

-- Permissions unchanged: callable by anonymous and authenticated users
REVOKE ALL ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, NUMERIC) TO anon, authenticated;
