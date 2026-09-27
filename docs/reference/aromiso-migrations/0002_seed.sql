-- Sample inquiries so the admin panel has data to review immediately.
-- These are demo records — safe to delete from the admin (or via SQL) once
-- real inquiries start coming in.

INSERT INTO inquiries (id, name, email, company, country, whatsapp, product, quantity, message, source, status, created_at, updated_at)
VALUES
  ('sample-001', 'Emma Thompson', 'emma.t@nordicwellness.se', 'Nordic Wellness AB', 'Sweden', '+46 70 123 4567', 'essential-oils', '2,000 bottles', 'Hi, we are a wellness retailer in Sweden looking for a private-label lavender essential oil (10ml). Could you share MOQ, pricing tiers and whether you provide custom label design? Thanks!', 'contact-page', 'Negotiating', '2026-07-19T09:24:00.000Z', '2026-07-20T03:10:00.000Z'),
  ('sample-002', 'Diego Martínez', 'diego@casahogar.mx', 'Casa Hogar Decor', 'Mexico', '+52 55 8765 4321', 'candles', '5,000 units', 'Hello, interested in OEM scented soy candles in amber jars for our home decor line. Need quote for 5k units, lead time, and available fragrances. Do you ship to Mexico?', 'homepage', 'New', '2026-07-20T15:47:00.000Z', NULL);
