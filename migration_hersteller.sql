-- ============================================================
-- VITARO — Hersteller-Katalog ebenfalls in die gemeinsame DB
-- ============================================================
-- Grund: Alles soll in einem einzigen Tool liegen (kein separates
-- Artifact mehr) - Kunden, Montage-Partner, Projekte UND Hersteller
-- jetzt zusammen in dieser Supabase-Datenbank.

create table public.hersteller (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kategorien text,
  website text,
  ansprechpartner text,
  kontakt text,
  konditionen text,
  liefert_montage boolean default false,
  montage_notiz text,
  created_at timestamptz default now()
);

alter table public.hersteller enable row level security;

create policy "authenticated_voller_zugriff_hersteller" on public.hersteller
  for all to authenticated using (true) with check (true);

insert into public.hersteller (name, kategorien, website, ansprechpartner, kontakt, konditionen, liefert_montage, montage_notiz) values
('Taurus', 'Power Rack / Kraftstation, Brustpresse, Beinpresse', 'https://www.fitshop.de', NULL, NULL, 'Kein Vertrag, Einzelbestellung über Fitshop', true, 'Über Fitshop/Sport-Tiedje: 75 eigene Servicetechniker bundesweit, Montage optional gegen Aufpreis.'),
('ATX Fitness', 'Power Rack / Kraftstation, Olympia-Langhantel, Hantelscheiben, Verstellbare Hantelbank, Kurzhanteln, Kettlebells, Multipresse / Smith Machine', 'https://www.megafitness.shop', NULL, NULL, 'Kein Vertrag, Einzelbestellung über Megafitness.shop', false, 'Unklar — bei Megafitness.shop nicht bestätigt, vor nächster Bestellung gezielt nachfragen.'),
('Gorilla Sports', 'Hantelscheiben, Verstellbare Hantelbank, Kurzhanteln, Kettlebells, Kabelturm / Cable Crossover, Multipresse / Smith Machine', 'https://www.gorillasports.de', NULL, NULL, 'Kein Vertrag, Einzelbestellung', true, 'Eigener optionaler Montageservice: Aufpreis pro Gerät, ca. +1 Woche Lieferzeit.'),
('Hammer Strength by Life Fitness', 'Brustpresse, Beinpresse', 'https://www.fitshop.de', NULL, NULL, 'Kein Vertrag, Einzelbestellung über Fitshop', true, 'Über Fitshop/Sport-Tiedje: 75 eigene Servicetechniker bundesweit.'),
('NOHRD', 'Kabelturm / Cable Crossover, Laufband', 'https://www.fitshop.de', NULL, NULL, 'Kein Vertrag, Einzelbestellung über Fitshop', true, 'Über Fitshop/Sport-Tiedje: 75 eigene Servicetechniker bundesweit — wichtig für Wandmontage SlimBeam.'),
('cardiostrong', 'Indoor-Bike / Ergometer, Laufband', 'https://www.fitshop.de', NULL, NULL, 'Fitshop-Eigenmarke', true, 'Über Fitshop/Sport-Tiedje: 75 eigene Servicetechniker bundesweit.'),
('Kettler', 'Rudergerät', 'https://www.fitshop.de', NULL, NULL, 'Kein Vertrag, Einzelbestellung über Fitshop', true, 'Über Fitshop/Sport-Tiedje: 75 eigene Servicetechniker bundesweit.'),
('Concept2', 'Indoor-Bike / Ergometer, Rudergerät', 'https://www.concept2.de', NULL, NULL, 'Direktvertrieb Concept2', false, 'Unklar — Direktvertrieb, kein Montageservice recherchiert. Geräte gelten als einfach selbst aufzubauen.'),
('MSPORTS', 'Gummi-Bodenbelag', 'https://www.amazon.de', NULL, NULL, 'Amazon-Direktkauf', false, 'Kein Montageservice — Bodenmatten, kein Aufbau nötig.'),
('PhysKcal', 'Olympia-Langhantel', 'https://www.amazon.de', NULL, NULL, 'Amazon-Direktkauf', false, 'Kein Montageservice — Einzelprodukt, kein Aufbau nötig.'),
('Gymfloor', 'Gummi-Bodenbelag', 'https://www.megafitness.shop', NULL, NULL, 'Kein Vertrag, Einzelbestellung über Megafitness.shop', false, 'Unklar — bei Megafitness.shop nicht bestätigt.');
