-- Migration: Explicit RLS policies for order_daily_sequences
--
-- The table has RLS enabled but previously had no explicit policies,
-- which meant all direct access was denied. The create_order function
-- is SECURITY DEFINER so it bypasses RLS and works correctly, but
-- adding explicit policies makes the intent clear and prevents confusion.

-- Deny all direct reads/writes from anon and authenticated roles.
-- The only legitimate access path is through the create_order() function
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
