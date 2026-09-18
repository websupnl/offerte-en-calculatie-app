-- 002: velden voor het nieuwe factuursjabloon
--
-- Draaien:  node scripts/run-migration.mjs scripts/migrations/002_invoice_template.sql
-- Daarna:   npx prisma generate, en de dev-server herstarten.
--
-- Puur additief: alleen nieuwe, nullable kolommen. Bestaande facturen blijven
-- zoals ze zijn en renderen zonder groepen of persoonlijke zin.
--
-- Rollback (alleen als er nog niets in deze kolommen staat dat je wilt houden):
--   ALTER TABLE "SalesInvoice" DROP COLUMN IF EXISTS "subject", DROP COLUMN IF EXISTS "intro",
--     DROP COLUMN IF EXISTS "periodStart", DROP COLUMN IF EXISTS "periodEnd",
--     DROP COLUMN IF EXISTS "sentAt", DROP COLUMN IF EXISTS "paidAt";
--   ALTER TABLE "InvoiceLine" DROP COLUMN IF EXISTS "groupLabel", DROP COLUMN IF EXISTS "detail";

-- Onderwerp onder het factuurnummer, bijv. "Renovatie elektrische installatie"
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "subject" TEXT;
-- Persoonlijke zin boven het betaalblok
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "intro" TEXT;
-- Leverdatum of periode: wettelijk verplicht als die afwijkt van de factuurdatum.
-- Alleen periodEnd = leverdatum/opgeleverd, allebei = periode.
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "periodStart" DATE;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "periodEnd" DATE;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- Groepskop in de specificatie ("Augustus 2026", "Materialen", "Abonnementen")
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "groupLabel" TEXT;
-- Tweede, grijze regel onder de omschrijving
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "detail" TEXT;
