import { prisma } from "@/lib/prisma";
import { generateCalculationNumber } from "@/lib/format";
import { volgendVolgnummer } from "@/lib/next-number";

/**
 * Volgend calculatienummer binnen een bedrijf.
 *
 * Tellen op het aantal records gaf dubbele nummers zodra er een calculatie
 * verwijderd was. We tellen daarom door op het hoogste nummer dat er dit jaar
 * al staat. Varianten maken we vaker aan, dus dat zou snel misgaan.
 */
export async function nextCalculationNumber(companyId: string, companySlug: string): Promise<string> {
  const prefix = generateCalculationNumber(companySlug, 0).replace(/\d+$/, "");
  // Zelfde reden als bij nextQuoteNumber: sorteren op tekst pakt niet altijd
  // het hoogste getal. Zie next-number.ts.
  const bestaande = await prisma.calculation.findMany({
    where: { companyId, number: { startsWith: prefix } },
    select: { number: true },
  });

  return generateCalculationNumber(
    companySlug,
    volgendVolgnummer(bestaande.map((c) => c.number), prefix),
  );
}
