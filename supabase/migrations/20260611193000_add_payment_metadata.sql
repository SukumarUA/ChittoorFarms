ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_notes TEXT,
ADD COLUMN IF NOT EXISTS payment_recorded_at TIMESTAMP WITH TIME ZONE;

UPDATE public.orders
SET payment_recorded_at = created_at
WHERE status = 'fulfilled'
  AND payment_recorded_at IS NULL;
