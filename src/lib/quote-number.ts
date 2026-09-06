import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/format";

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
  const laatste = await prisma.quote.findFirst({
    where: { companyId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const hoogste = Number(laatste?.number.slice(prefix.length) ?? 0);
  return generateQuoteNumber(companySlug, (Number.isFinite(hoogste) ? hoogste : 0) + 1);
}
