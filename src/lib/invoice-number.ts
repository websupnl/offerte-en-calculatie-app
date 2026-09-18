import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber } from "@/lib/format";
import { volgendVolgnummer } from "@/lib/next-number";

/**
 * Volgend factuurnummer binnen een bedrijf, doorlopend per jaar.
 *
 * Een factuurreeks moet fiscaal doorlopend zijn, zonder gaten en zonder
 * dubbele nummers. Tellen op het aantal records liep over jaren heen door en
 * gaf dubbele nummers zodra er een concept verwijderd was. We nemen daarom het
 * hoogste nummer dat er dit jaar al staat, net als bij calculaties.
 */
export async function nextInvoiceNumber(companyId: string, companySlug: string): Promise<string> {
  const prefix = generateInvoiceNumber(companySlug, 0).replace(/\d+$/, "");
  const bestaande = await prisma.salesInvoice.findMany({
    where: { companyId, number: { startsWith: prefix } },
    select: { number: true },
  });
  return generateInvoiceNumber(companySlug, volgendVolgnummer(bestaande.map((i) => i.number), prefix));
}
