ALTER TABLE public.farms
ADD COLUMN IF NOT EXISTS farm_update TEXT,
ADD COLUMN IF NOT EXISTS feature_update_on_notice_board BOOLEAN NOT NULL DEFAULT false;
