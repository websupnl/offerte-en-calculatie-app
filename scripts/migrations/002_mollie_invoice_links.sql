-- Eén Mollie-betaallink per verkoopfactuur. Bestaande facturen blijven intact.
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "molliePaymentLinkId" TEXT;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "molliePaymentUrl" TEXT;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "molliePaymentMode" TEXT;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "molliePaidAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesInvoice_molliePaymentLinkId_key" ON "SalesInvoice"("molliePaymentLinkId");
