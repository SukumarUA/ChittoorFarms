ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key
ON public.orders (order_number)
WHERE order_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.order_daily_sequences (
  order_date DATE PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value > 0)
);

ALTER TABLE public.order_daily_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_pin_code TEXT,
  p_preferred_delivery_date DATE,
  p_special_instructions TEXT,
  p_items JSONB,
  p_total NUMERIC
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_date DATE := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_sequence INTEGER;
  v_order_number TEXT;
BEGIN
  INSERT INTO public.order_daily_sequences (order_date, last_value)
  VALUES (v_order_date, 1)
  ON CONFLICT (order_date)
  DO UPDATE SET last_value = public.order_daily_sequences.last_value + 1
  RETURNING last_value INTO v_sequence;

  v_order_number := to_char(v_order_date, 'YYYYMMDD')
    || 'CF'
    || lpad(v_sequence::TEXT, 5, '0');

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
    p_items,
    p_total,
    'pending'
  );

  RETURN v_order_number;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, NUMERIC) TO anon, authenticated;
