-- ============================================================
-- VITARO — Montage-Partner & Projekte in dieselbe DB wie Kunden
-- ============================================================
-- Grund: Kunden, Projekte und Montage-Partner sollen sich per
-- echter Fremdschlüssel-Beziehung verknüpfen lassen (ein Projekt
-- gehört zu einem Kunden und optional zu einem Montage-Partner).
-- Das geht nur, wenn alle drei Tabellen in derselben Datenbank
-- liegen. Anders als "kunden" bekommen diese beiden Tabellen KEINE
-- anon-Rechte — sie werden nie von der öffentlichen Planer-Seite
-- beschrieben, nur intern über die Kunden-Verwaltungsseite.

create table public.montage_partner (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  typ text not null check (typ in ('bundesweit','regional')),
  website text,
  leistung text,
  plz_bereich text,
  gewerk text,
  kontakt text,
  quelle text,
  montage_notiz text,
  created_at timestamptz default now()
);

create table public.projekte (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid references public.kunden(id) on delete set null,
  montage_partner_id uuid references public.montage_partner(id) on delete set null,
  status text default 'Angebot' check (status in ('Angebot','Beauftragt','In Umsetzung','Abgeschlossen')),
  paket text,
  summe numeric,
  zustaendig text,
  notizen text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.montage_partner enable row level security;
alter table public.projekte enable row level security;

-- Nur angemeldete Mitarbeiter (Supabase-Auth "authenticated") dürfen
-- diese beiden Tabellen überhaupt sehen oder ändern - keine anon-Regel,
-- da diese Daten nie von der öffentlichen Webseite kommen.
create policy "authenticated_voller_zugriff_partner" on public.montage_partner
  for all to authenticated using (true) with check (true);

create policy "authenticated_voller_zugriff_projekte" on public.projekte
  for all to authenticated using (true) with check (true);

-- Bestehende 44 recherchierte Montage-Partner aus dem alten Artifact-
-- Backoffice übernommen (5 bundesweite + 39 regionale, PLZ-genau
-- recherchiert). Die "notiz-beschaffung"-Dokumentation aus dem alten
-- System steht hier als Kommentar, keine Tabellenzeile: regionale
-- Handwerker-Lücken bei Bedarf gezielt über myHammer.de, Fixando.de
-- oder Auftragsbank.de nachrecherchieren, nie mit erfundenen Namen
-- vorausfüllen.

insert into public.montage_partner (name, typ, website, leistung, plz_bereich, gewerk, kontakt, quelle, montage_notiz) values
('ServiceSport', 'bundesweit', 'https://servicesport.de/fitnessgeraete-aufbau-montage-installation/', 'Aufbau, Montage, Installation & Demontage von Fitness-/Sportgeräten, privat und gewerblich, bundesweit.', NULL, NULL, NULL, NULL, 'VORBEHALT (Vertiefungsrecherche 8. Sept. 2026): Das Impressum zeigt teils Platzhaltertext statt vollständiger Firmenangaben; die Seite wirkt wie ein Marketing-/Lead-Generierungs-Netzwerk mit Vorlagen-Website, nicht wie ein einzelnes, klar identifizierbares Unternehmen. Vor Beauftragung telefonisch verifizieren, wer tatsächlich montiert.'),
('SportGear-Montage', 'bundesweit', 'https://sportgear-montage.de/sportgear-montageservice/', 'Montageservice speziell für Home-Gym-Geräte, fachgerechter Aufbau.', NULL, NULL, NULL, NULL, 'VORBEHALT (Vertiefungsrecherche 8. Sept. 2026): Adresse auf der Startseite (Gotenstr. 10) weicht vom Impressum (Ernst-Gremler-Str. 9, 58239 Schwerte) ab, Rechtsform fehlt im Impressum. USt-ID DE365671325 vorhanden. Vor Beauftragung Diskrepanz telefonisch klären.'),
('T.L.M Fitness Service', 'bundesweit', 'https://www.tlm-service.com/preise/', 'Fitnessgeräte-Montage mit veröffentlichter Preisliste.', NULL, NULL, NULL, NULL, NULL),
('Fitstore24', 'bundesweit', 'https://www.fitstore24.com/en/delivery-assembly-service/on-site', 'Liefer- und Montageservice, Vor-Ort-Montage.', NULL, NULL, NULL, NULL, NULL),
('Kübler Sport', 'bundesweit', 'https://www.kuebler-sport.de/montageservice/', 'Bundesweiter Liefer- und Montageservice, erfahrenes Montageteam.', NULL, NULL, NULL, NULL, NULL),
('Zimmermann GmbH', 'regional', 'https://www.zimmermannumzug.de/montagen/moebelmontagen.html', 'Möbelmontage (Regale, Betten, Schränke). Fitnessgeräte nicht explizit genannt.', '01xxx Dresden', 'Allround-Montage (Möbel)', 'Tel. 0351-4113071, kontakt@zimmermannumzug.de', 'WebSearch+WebFetch, Impressum/Kontakt geprüft (8. Sept. 2026)', NULL),
('Sportmechanik Hamburg', 'regional', 'https://www.sportmechanik-hamburg.de/', 'Wartung, Reparatur und Montage von Heimtrainern/Studiogeräten, 150-km-Radius um Hamburg.', '20xxx-22xxx Hamburg', 'Fitnessgeräte-Montage (spezialisiert)', 'Tel. 040 368 836 03, info@sportmechanik-hamburg.de', 'WebSearch+WebFetch, geprüft (8. Sept. 2026)', NULL),
('anTransport', 'regional', 'https://www.antransport.de/m%C3%B6belmontage', 'Möbeltransport, Montage/Demontage.', '28xxx Bremen', 'Allround-Montage (Möbel)', 'Tel. 0421 89779449, info@antransport.de', 'WebSearch+WebFetch, geprüft (8. Sept. 2026)', NULL),
('AKELBEIN', 'regional', 'https://www.akelbein-umzug.de/leistungen/moebelmontage/', 'Möbelmontage, Küchenmontage/-umzug, Tischlerarbeiten.', '23xxx Lübeck', 'Allround-Montage (Möbel/Küche)', 'Tel. 0451 660 26, info@akelbein.de', 'WebSearch+WebFetch, Adresse geprüft (8. Sept. 2026)', NULL),
('Rutz Umzüge', 'regional', 'https://www.rutz-umzuege.de/montage-und-demontage', 'Möbeldemontage/-montage, Küchenmontage mit Wasser-/Herdanschluss.', '38xxx Braunschweig/Meine', 'Allround-Montage (Möbel/Küche)', 'Tel. 05304/9072045, info@rutz-umzuege.de', 'WebSearch+WebFetch, geprüft (8. Sept. 2026)', NULL),
('Breitfeld Umzüge', 'regional', 'https://www.breitfeld-umzug-magdeburg.de/', 'Umzug, Möbelmontage/-demontage, Küchenmontage.', '39xxx Magdeburg', 'Allround-Montage (Möbel/Küche)', 'Tel. +49 391 7316698, rbreitfeld@yahoo.de', 'WebSearch+WebFetch, geprüft (8. Sept. 2026)', NULL),
('Der Aufbau Service (Andreas Ballnus)', 'regional', 'http://der-aufbau.andreasballnus.de/', 'Regal-/Schrankmontage, Bodenbelag, Wandarbeiten.', '37xxx Göttingen/Kassel/Eschwege', 'Allround-Montage (Möbel/Boden/Wand)', 'Tel. 01573/3149434 — KEINE öffentliche Adresse angegeben', 'WebSearch+WebFetch (8. Sept. 2026). VORBEHALT: einziger Nachweis ist Telefonnummer, keine Adresse/Impressum — vor Beauftragung persönlich verifizieren.', NULL),
('KRAX Möbelspedition', 'regional', 'https://krax-umzuege.de/umzugsservice/montageservice/', 'Möbel-/Küchenmontage, Demontage; Partnerfachbetriebe für Boden/Elektro/Sanitär. Bedient Dortmund, Hagen, Bochum.', '44xxx Dortmund', 'Allround-Montage (Möbel/Küche)', 'Tel. 0231 96 13 200, info@krax-umzuege.de', 'WebSearch+WebFetch, Impressum geprüft (8. Sept. 2026)', NULL),
('Küchenmontage-Bochum.de (Nizar El-Lahib)', 'regional', 'https://xn--kchenmontage-bochum-59b.de/', 'Küchen-/Möbelmontage, Anschlüsse, Bodenbeläge — deckt Duisburg/Bochum/Essen/Dortmund/Gelsenkirchen ab.', '44xxx Bochum/Essen/Duisburg/Dortmund', 'Allround-Montage inkl. Bodenbeläge', 'Tel. +49 172 573 6875, info@kum-bochum.de', 'WebSearch+WebFetch, Impressum mit Name/Adresse bestätigt (8. Sept. 2026)', NULL),
('Montageservice Düsseldorf', 'regional', 'https://montage-dus.de/', 'Allgemeine Möbel-/Küchenmontage.', '40xxx Düsseldorf', 'Allround-Montage (Möbel/Küche)', 'Tel. +49 211 82267918, info@montage-dus.de', 'WebSearch+WebFetch (8. Sept. 2026). VORBEHALT: Seiteninhalt nicht vollständig abrufbar.', NULL),
('Müller Service UG (haftungsbeschränkt)', 'regional', 'https://www.moebelmontage-mueller.de/', 'Neu-/Gebrauchtmöbelmontage, Umzug, Wandbefestigung/Bohrarbeiten. Köln + NRW-weit.', '50xxx Köln', 'Allround-Montage (Möbel)', 'Tel. 0221 715 612 38, benjamin.mueller80@icloud.com', 'WebSearch+WebFetch. Vollständiges Impressum: HRB 114449 Amtsgericht Köln, GF Benjamin Müller (8. Sept. 2026)', NULL),
('Easy Montagen', 'regional', 'https://easymontagen.de/', 'Küchen-/Möbelmontage, Elektroanschluss. Fitnessgeräte nicht explizit genannt.', '01xxx Elstra/Dresden', 'Allround-Montage (Möbel/Küche)', 'Tel. 0177 3782611', 'WebSearch+WebFetch, Impressum geprüft (8. Sept. 2026)', NULL),
('Momos Montageservice (Mohamad Chehade)', 'regional', 'https://momos-montageservice.de/', 'Küchen-/Möbelmontage, Transport, Demontage. Schwerpunkt Raum Aachen.', '52xxx Aachen', 'Allround-Montage (Möbel/Küche)', 'Tel. +49 241 89435607, info@momos-montageservice.de', 'WebSearch+WebFetch, Impressum mit Name/Adresse geprüft (8. Sept. 2026)', NULL),
('Fehres Transporte', 'regional', 'https://fehres-transporte.de/moebel-kuechenmontage-koblenz/', 'Möbel-/Küchenmontage (Privat & Gewerbe), Umzug, Transport.', '56xxx Koblenz', 'Allround-Montage (Möbel/Küche)', 'Tel. 0261 988 258 41, info@fehres-transporte.de', 'WebSearch+WebFetch, Impressum-Link geprüft (8. Sept. 2026)', NULL),
('Meisterlich Montageservice (Stefan Meiwes)', 'regional', 'https://www.meisterlichmontage.de/moebelmontage/', 'Möbel-/Küchenmontage, Demontage, Reparaturen. Bedient auch Bonn/Bad Godesberg/Köln/Frankfurt.', '53xxx Bonn/Köln (HQ Delbrück)', 'Allround-Montage (Möbel/Küche)', 'Tel. 0151 40319428, meiwes@meisterlichmontage.de', 'WebSearch+WebFetch, vollständiges Impressum bestätigt (8. Sept. 2026)', NULL),
('Gebrüder Baus GmbH', 'regional', 'https://www.umzuege-baus.de/montage.php', 'Möbeltransport, Lagerung, Montagen/Demontagen. GmbH mit mehreren Standorten.', '66xxx Saarbrücken/Homburg', 'Allround-Montage (Möbel)', 'Tel. 06841 4743 (Homburg), 0681 709 248 (Saarbrücken)', 'WebSearch+WebFetch, Rechtsform GmbH + Impressum bestätigt (8. Sept. 2026)', NULL),
('Express Meister / YARKO', 'regional', 'https://www.expressmeister.de/mobelmontage-mainz', 'Möbel-/Küchen-/Schrankmontage, Wandmontage, Büromöbel. Bedient explizit Mainz und Wiesbaden.', '55xxx Mainz/Wiesbaden/Frankfurt (HQ Mannheim)', 'Allround-Montage (Möbel/Küche)', 'post@expressmeister.de', 'WebSearch+WebFetch (8. Sept. 2026). VORBEHALT: Detailangaben nicht vollständig abrufbar.', NULL),
('KP Handwerk (Konstantin Pawlow)', 'regional', 'https://kp-handwerk.de/', 'Montage, Innen-/Außenausbau, Küchen-/Möbelmontage, Fliesen/Estrich.', '34xxx Kassel (HQ Fuldabrück)', 'Allround-Montage inkl. Fliesen/Estrich', 'Tel. 0151 24002847, info@kp-handwerk.de', 'WebSearch+WebFetch. Vollständiges Impressum, USt-ID 82165473403 (8. Sept. 2026)', NULL),
('Stein-Gruppe (Gebäudereinigung Stein)', 'regional', 'https://stein-gruppe.com/aufbauservice/', 'Aufbauservice inkl. Montage von Fitnessgeräten (explizit genannt). Bedient Karlsruhe, Ettlingen, Rastatt, Pforzheim, Baden-Baden u.a.', '76xxx Ettlingen/Karlsruhe', 'Fitnessgeräte-Montage (spezialisiert)', 'Tel. 07243-2009220, info@stein-gruppe.com', 'WebSearch+WebFetch, Leistungsseite nennt Fitnessgeräte namentlich (8. Sept. 2026)', NULL),
('Montageservice Vincenti (Francesco Vincenti)', 'regional', 'https://www.montageservice-vincenti.de/', 'Auf-/Abbau von Möbeln, Küchenmontage, Türeinbau.', '71xxx Tamm/Heilbronn/Ludwigsburg/Stuttgart', 'Allround-Montage (Möbel/Küche)', 'Tel. 015253047066, francesco.vincenti@web.de', 'WebSearch+WebFetch, Impressum bestätigt (8. Sept. 2026)', NULL),
('Hegele & Schmitt Möbelspedition GmbH', 'regional', 'https://www.hegele-schmitt.de/', 'Möbelmontage/-aufbau, etablierte GmbH mit Partnernetzwerk.', '76xxx Karlsruhe', 'Allround-Montage (Möbel)', 'Tel. 0721 57009-7352, sales@hegele-schmitt.de', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('Rümpelschwab', 'regional', 'https://ruempelschwab.de/leistungen/moebelmontage-stuttgart/', 'Möbelmontage aller Art (Regale bis Küchen).', '70xxx Stuttgart', 'Allround-Montage (Möbel)', 'Tel. +49 711-122 794 52, info@ruempelschwab.de', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('Einrichtungsprofis GmbH', 'regional', 'https://www.einrichtungsprofis.com/montage/', 'Möbel-/Küchenmontage inkl. Geräteanschluss, Büro-/Gewerbeeinrichtung.', '04xxx Leipzig', 'Allround-Montage (Möbel/Küche)', 'Tel. +49 341 24714182, info@einrichtungsprofis.com', 'WebSearch+WebFetch, Adresse/Kontakt geprüft (8. Sept. 2026)', NULL),
('Kabiri Umzüge und Transporte Freiburg', 'regional', 'https://www.freiburg-umzug.de/', 'Möbelmontage-Service (Kleiderschränke, Betten, Küchenzeilen).', '79xxx Freiburg', 'Allround-Montage (Möbel/Küche)', 'Tel. 0761-278461, info@freiburg-umzug.de', 'WebSearch+WebFetch, Impressum+Leistungsseite geprüft (8. Sept. 2026)', NULL),
('Montageservice München', 'regional', 'https://montageservice-muenchen.de/', 'Allround-Möbelmontage in München.', '81xxx München', 'Allround-Montage (Möbel)', 'Tel. +49 89 54 223 444, info@montageservice-muenchen.de', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('Eichenseer Umzüge München', 'regional', 'https://eichenseer-umzuege.de/', 'Umzüge mit Möbelmontage, großräumig München, Augsburg, Regensburg, Nürnberg, Ingolstadt, Landshut.', '80xxx München/Augsburg/Regensburg/Nürnberg', 'Allround-Montage (Möbel)', 'Tel. 089 24 88 93 66, info@eichenseer-umzuege.de', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('3D Umzüge', 'regional', 'https://3d-umzuege.de/leistungen/montageservice/', 'Möbelmontage, bedient Augsburg/München/deutschlandweit.', '86xxx Augsburg', 'Allround-Montage (Möbel)', 'Tel. 0821 419 03 03 19, mail@3d-umzuege.de', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('DK Montage-Service (Vincenzo Doronzo)', 'regional', 'https://www.dkmontage.de/', 'Küchen-/Möbelmontage München und Umgebung.', '81xxx München', 'Allround-Montage (Möbel/Küche)', 'Tel. 0152 286 282 86, dk@dkmontage.de', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('Montageservice Südbayern GmbH', 'regional', 'https://montageservice-suedbayern.de/', 'Industrie-/Maschinenmontage, Maschinenumzüge — für sehr schwere/technische Gerätemontage, falls nötig.', '86xxx Nördlingen (Süd-Bayern-weit)', 'Schwermaschinen-/Industriemontage', 'Tel. 09081 8053710, info@montageservice-suedbayern.de', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('Hotsulenko Umzug & Handwerk', 'regional', 'https://bayreuthfix.de/', 'Möbelmontage, Regalmontage, kleine Reparaturen. Ein-Mann-Betrieb.', '95xxx Bayreuth', 'Allround-Montage (Möbel)', 'Tel. 0171 8134305, fixumbayreuth@gmail.com', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('G.A. Kleintransporte und Möbelmontage (Ahmad Ghandour)', 'regional', 'https://mobelmontage-nurnberg.de/', 'IKEA-/Küchenmontage, Lieferservice Raum Nürnberg.', '90xxx Nürnberg', 'Allround-Montage (Möbel/Küche)', 'Tel. +49 911 48007161, info@mobelmontage-nurnberg.de', 'WebSearch+WebFetch, Impressum gelesen (8. Sept. 2026)', NULL),
('EIG Bau & Handwerkerservice', 'regional', 'https://eig-handwerker.de/moebelmontage/', 'Möbelmontage Regensburg und Landkreis.', '93xxx Regensburg', 'Allround-Montage (Möbel)', 'Tel. 0176 46031160, info@eig-handwerker.de', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('Hasenwinkel Umzüge (Kevin Hasenwinkel)', 'regional', 'https://www.hasenwinkel-umzuege.de/', 'Umzüge, Möbelmontage, Küchenmontage.', '97xxx Würzburg', 'Allround-Montage (Möbel/Küche)', 'Tel. 0151 174 59 112', 'WebSearch+WebFetch (8. Sept. 2026)', NULL),
('Möbelmontagen Jörg Thems', 'regional', 'https://www.moebel-montagen.de/', 'Möbelplanung/-montage, seit 1997.', '09xxx Chemnitz', 'Allround-Montage (Möbel)', 'Tel. 0371-429256, info@moebel-montagen.de', 'WebSearch+WebFetch, Impressum geprüft (8. Sept. 2026)', NULL),
('Weyers Service', 'regional', 'https://weyers-service.de/', 'Auf-/Abbau von Möbeln, Regalmontage, Anschluss steckerfertiger Geräte.', '09xxx Chemnitz', 'Allround-Montage (Möbel)', 'Tel. 0371 27815-16, info@weyers-service.de', 'WebSearch+WebFetch, Impressum geprüft (8. Sept. 2026)', NULL),
('GM Bau & Montageservice Berlin', 'regional', 'https://montageservice-berlin.com/moebelaufbau-service-berlin/', 'Möbel-/Küchenmontage, IKEA-Aufbau, Geräteanschluss.', '10xxx-14xxx Berlin', 'Allround-Montage (Möbel/Küche)', 'Tel. 030/54908413, kontakt@montageservice-berlin.com', 'WebSearch+WebFetch, Impressum geprüft (8. Sept. 2026)', NULL),
('Montageservice Krumnow', 'regional', 'https://montageservice-krumnow.de/', 'Küchen-/Möbelmontage, Garten-/Blockhäuser, Laminat.', '14xxx Potsdam/Berlin/Brandenburg', 'Allround-Montage (Möbel/Küche)', 'Tel. 01776830019, info@montageservice-krumnow.de', 'WebSearch+WebFetch, geprüft (8. Sept. 2026)', NULL),
('Bartels & Busch Hanseatische Möbelspedition Rostock GmbH', 'regional', 'https://www.umzuege-rostock.com/moebel-und-kuechenmontage', 'Umzug, Möbel-/Küchenmontage, Lagerung.', '18xxx Rostock', 'Allround-Montage (Möbel/Küche)', 'Tel. 0381/609980, info@rostock-umzuege.de', 'WebSearch+WebFetch, Adresse geprüft (8. Sept. 2026)', NULL),
('Sellenthin Logistik', 'regional', 'https://sellenthin-logistik.de/leistungen/logistik-fuer-spezialgeraete-und-maschinen/fitnessgeraete', 'Demontage, Transport und Montage von Fitness-/Sportgeräten (Laufbänder, Crosstrainer, Power Plates).', '21xxx Geesthacht/Hamburg', 'Fitnessgeräte-Montage (spezialisiert)', 'Tel. 04152/13688-0, office@sellenthin-logistik.de', 'WebSearch+WebFetch, Adresse/Impressum geprüft (8. Sept. 2026)', NULL);
