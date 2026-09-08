import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/format";
import { volgendVolgnummer } from "@/lib/next-number";

/**
 * Volgend offertenummer binnen een bedrijf.
 *
 * Tellen op het aantal records (`prisma.quote.count() + 1`) gaf dubbele nummers
 * zodra er een offerte verwijderd of gearchiveerd was, of als er twee tegelijk
 * werden aangemaakt. We tellen daarom door op het hoogste nummer dat er dit jaar
 * al staat. Zelfde aanpak als `nextCalculationNumber` in calculation-number.ts.
 *
 * Gearchiveerde offertes tellen bewust mee: hun nummer blijft gereserveerd.
 */
export async function nextQuoteNumber(companyId: string, companySlug: string): Promise<string> {
  const prefix = generateQuoteNumber(companySlug, 0).replace(/\d+$/, "");
  // Alle nummers ophalen in plaats van alleen het lexicaal hoogste: naast het
  // huidige formaat staan er nog offertes uit een ouder formaat, en die kunnen
  // bovenaan sorteren zonder de hoogste te zijn. Zie next-number.ts.
  const bestaande = await prisma.quote.findMany({
    where: { companyId, number: { startsWith: prefix } },
    select: { number: true },
  });

  return generateQuoteNumber(companySlug, volgendVolgnummer(bestaande.map((q) => q.number), prefix));
}
