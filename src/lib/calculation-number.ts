import { prisma } from "@/lib/prisma";
import { generateCalculationNumber } from "@/lib/format";

/**
 * Volgend calculatienummer binnen een bedrijf.
 *
 * Tellen op het aantal records gaf dubbele nummers zodra er een calculatie
 * verwijderd was. We tellen daarom door op het hoogste nummer dat er dit jaar
 * al staat. Varianten maken we straks veel vaker aan, dus dat zou snel misgaan.
 */
export async function nextCalculationNumber(companyId: string, companySlug: string): Promise<string> {
  const prefix = generateCalculationNumber(companySlug, 0).replace(/\d+$/, "");
  const laatste = await prisma.calculation.findFirst({
    where: { companyId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const hoogste = Number(laatste?.number.slice(prefix.length) ?? 0);
  return generateCalculationNumber(companySlug, (Number.isFinite(hoogste) ? hoogste : 0) + 1);
}
