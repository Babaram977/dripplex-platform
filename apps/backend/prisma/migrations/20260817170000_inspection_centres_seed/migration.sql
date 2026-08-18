-- DPX-DRIVER-002 — the four DrippleX inspection centres, and an optional address.
--
-- Founder decision (2026-08-17): drivers book at DrippleX's own centres in Kano,
-- Abuja, Kaduna and Lagos; "no address needed for now, for inquiry contact
-- support on whatsapp".
--
-- Address becomes nullable rather than being filled with a placeholder: a fake
-- street line would be shown to drivers as if it were real.
ALTER TABLE "inspection_centres" ALTER COLUMN "address" DROP NOT NULL;

-- Seeded here rather than by hand so every environment has them and a redeploy
-- cannot duplicate them. Fixed ids + a name guard make this safe to re-run.
INSERT INTO "inspection_centres" ("id", "name", "address", "city", "is_active", "created_at", "updated_at")
SELECT * FROM (VALUES
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'DrippleX Kano Inspection Centre',   NULL::varchar(500), 'Kano',   true, NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'DrippleX Abuja Inspection Centre',  NULL::varchar(500), 'Abuja',  true, NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000003'::uuid, 'DrippleX Kaduna Inspection Centre', NULL::varchar(500), 'Kaduna', true, NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000004'::uuid, 'DrippleX Lagos Inspection Centre',  NULL::varchar(500), 'Lagos',  true, NOW(), NOW())
) AS seed(id, name, address, city, is_active, created_at, updated_at)
WHERE NOT EXISTS (
  SELECT 1 FROM "inspection_centres" existing WHERE existing."id" = seed.id
);
