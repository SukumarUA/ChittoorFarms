-- Add heritage section text columns to settings table
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS heritage_badge TEXT NOT NULL DEFAULT '• CHITTOOR, INDIA''S MANGO PARADISE •',
  ADD COLUMN IF NOT EXISTS heritage_title TEXT NOT NULL DEFAULT 'Discover Chittoor''s Mango Cultivation Heritage',
  ADD COLUMN IF NOT EXISTS heritage_body  TEXT NOT NULL DEFAULT '';

-- Seed the existing row with the default body text
UPDATE settings SET
  heritage_body = 'Chittoor district in Andhra Pradesh is a powerhouse of premium mango cultivation. Armed with decades of local expertise, our farmers have perfected the art of nurturing orchards on nutrient-rich red laterite soils, passing down specialized grafting and cultivation techniques across generations.

Today, Chittoor stands as the state''s largest mango-producing belt, with 100,000+ acres dedicated to orchards. In a peak season, these orchards yield close to 500,000+ metric tonnes of high-quality fruit, cementing the region''s position as a major leader in India''s mango market.

While the signature Totapuri mango powers 50+ pulp processing units supplying juice globally, the region is celebrated for its diversity. Premium table varieties like Banganapalli, Neelum, Imam Pasand, Sindhura, and Mallika all thrive side-by-side in these fertile orchards.

What sets Chittoor farms apart is their smart multi-variety orchard tradition. Growing 4+ distinct mango varieties together naturally extends the harvest season, enhances cross-pollination, and preserves rare heritage strains that are hard to find anywhere else.

To maintain this high standard of quality, local farmers invest an average of ₹30,000 per acre each season in careful cultivation, soil nourishment, and natural harvesting techniques, ensuring every mango is picked at perfect maturity.

However, without a direct market, these skilled farmers are often vulnerable to exploitative middlemen and pulp conglomerates. By purchasing from Chittoor Farms, you bridge this gap directly — ensuring fair profits reach the growers while enjoying premium, naturally ripened produce delivered straight to your home.'
WHERE id = 'main';
