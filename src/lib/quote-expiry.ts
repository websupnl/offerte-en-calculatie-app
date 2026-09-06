import { prisma } from "@/lib/prisma";

/**
 * Zet verstuurde/bekeken offertes waarvan `validUntil` verstreken is op EXPIRED.
 *
 * De status werd nergens gezet ondanks het veld `validUntil`. Dit draait lazy
 * bij het laden van de offertelijst en het dashboard, en headless via
 * `/api/cron/expire-quotes`. Eén updateMany, dus goedkoop en zelfherstellend.
 *
 * Geaccepteerde en afgewezen offertes blijven met rust; gearchiveerde ook.
 */
export async function markExpiredQuotes(companyId?: string): Promise<number> {
  const result = await prisma.quote.updateMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: { in: ["SENT", "VIEWED"] },
      archivedAt: null,
      validUntil: { not: null, lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}
