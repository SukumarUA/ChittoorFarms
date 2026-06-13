UPDATE public.settings
SET
  team = '[
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
  updated_at = timezone('utc'::text, now())
WHERE id = 'main';
