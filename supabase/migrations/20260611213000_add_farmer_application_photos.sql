ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow public farmer application photo uploads'
  ) THEN
    CREATE POLICY "Allow public farmer application photo uploads"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (
      bucket_id = 'chittoor-farms'
      AND (storage.foldername(name))[1] = 'applications'
    );
  END IF;
END $$;
