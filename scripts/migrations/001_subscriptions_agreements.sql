-- ─────────────────────────────────────────────────────────────────────────────
-- 001 — Abonnementen, akkoord-log en eenmalig/terugkerend op calculatieregels
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Handgeschreven omdat `prisma db push` verboden is (schema en database zijn
-- eerder uit elkaar gelopen). Alles is idempotent: opnieuw draaien is veilig.
--
-- ROLLBACK (in omgekeerde volgorde, alleen als niets de data nog gebruikt):
--   DROP TABLE IF EXISTS "SubscriptionEvent";
--   DROP TABLE IF EXISTS "Subscription";
--   DROP TABLE IF EXISTS "AgreementLog";
--   ALTER TABLE "CalculationItem" DROP COLUMN IF EXISTS "billingCycle";
--   ALTER TABLE "CalculationItem" DROP COLUMN IF EXISTS "lineType";
--   DROP TYPE IF EXISTS "AgreementMethod";
--   DROP TYPE IF EXISTS "SubscriptionStatus";
--   DROP TYPE IF EXISTS "BillingCycle";
--   DROP TYPE IF EXISTS "QuoteLineType";
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "QuoteLineType" AS ENUM ('ONE_OFF', 'RECURRING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AgreementMethod" AS ENUM ('DIGITAL', 'VERBAL_CONFIRMED', 'EMAIL_ACCEPTANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── CalculationItem: eenmalig vs terugkerend ─────────────────────────────────

ALTER TABLE "CalculationItem"
  ADD COLUMN IF NOT EXISTS "lineType" "QuoteLineType" NOT NULL DEFAULT 'ONE_OFF';

ALTER TABLE "CalculationItem"
  ADD COLUMN IF NOT EXISTS "billingCycle" "BillingCycle";

-- Bestaande abonnementsregels (recurringInterval = maand/kwartaal/jaar) meenemen.
UPDATE "CalculationItem"
SET "lineType" = 'RECURRING',
    "billingCycle" = CASE "recurringInterval"
      WHEN 'maand'    THEN 'MONTHLY'::"BillingCycle"
      WHEN 'kwartaal' THEN 'QUARTERLY'::"BillingCycle"
      WHEN 'jaar'     THEN 'YEARLY'::"BillingCycle"
      ELSE NULL
    END
WHERE "recurringInterval" IN ('maand', 'kwartaal', 'jaar')
  AND "lineType" = 'ONE_OFF';

-- ── AgreementLog (onveranderbaar akkoord-record) ─────────────────────────────

CREATE TABLE IF NOT EXISTS "AgreementLog" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "quoteId"    TEXT NOT NULL REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "companyId"  TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip"         TEXT,
  "method"     "AgreementMethod" NOT NULL,
  "avVersion"  TEXT,
  "snapshot"   JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS "AgreementLog_quoteId_idx" ON "AgreementLog"("quoteId");
CREATE INDEX IF NOT EXISTS "AgreementLog_companyId_occurredAt_idx" ON "AgreementLog"("companyId", "occurredAt");

-- ── Subscription (facturatie-grootboek) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"                      TEXT NOT NULL PRIMARY KEY,
  "companyId"               TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "companyKey"              TEXT NOT NULL,
  "customerId"              TEXT REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "clientName"              TEXT NOT NULL,
  "serviceName"             TEXT NOT NULL,
  "priceCents"              INTEGER NOT NULL,
  "vatRate"                 DECIMAL(5,2) NOT NULL DEFAULT 21,
  "currency"                TEXT NOT NULL DEFAULT 'EUR',
  "billingCycle"            "BillingCycle" NOT NULL,
  "startDate"               DATE NOT NULL,
  "nextBillingDate"         DATE NOT NULL,
  "lastInvoicedAt"          TIMESTAMP(3),
  "status"                  "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceQuoteId"           TEXT REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "sourceCalculationItemId" TEXT,
  "notes"                   TEXT,
  "migrationPending"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Subscription_companyId_status_idx" ON "Subscription"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Subscription_companyKey_nextBillingDate_idx" ON "Subscription"("companyKey", "nextBillingDate");
CREATE INDEX IF NOT EXISTS "Subscription_sourceQuoteId_idx" ON "Subscription"("sourceQuoteId");
CREATE INDEX IF NOT EXISTS "Subscription_customerId_idx" ON "Subscription"("customerId");

-- ── SubscriptionEvent (historie) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type"           TEXT NOT NULL,
  "detail"         TEXT,
  "amountCents"    INTEGER,
  "periodStart"    DATE,
  "periodEnd"      DATE,
  "actor"          TEXT,
  "occurredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SubscriptionEvent_subscriptionId_occurredAt_idx" ON "SubscriptionEvent"("subscriptionId", "occurredAt");
