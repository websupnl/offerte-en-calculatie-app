import { prisma } from "@/lib/prisma";
import { buildQuotePricing, resolvePricing, usesCalculationPricing } from "@/lib/quote-pricing";

/**
 * Het totaal op de offerte gelijktrekken met de gekoppelde calculaties.
 *
 * Quote.totalExVat wordt op veel plekken gelezen: het overzicht, de statistieken,
 * de facturen. Zolang de prijs uit losse offerteregels kwam, werd hij bij het
 * opslaan van de offerte bijgewerkt. Nu de calculatie de prijs bepaalt, moet hij
 * meelopen met de calculatie. Roep dit dus aan na elke wijziging aan een
 * calculatie die aan een offerte hangt.
 *
 * Doet niets bij een offerte die nog losse regels heeft: die zit op het oude pad
 * en houdt zijn eigen totaal.
 */
export async function syncQuoteTotalsFromCalculations(quoteId: string | null | undefined) {
  if (!quoteId) return;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      items: { select: { id: true }, take: 1 },
      calculations: {
        orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!quote || !usesCalculationPricing(quote)) return;

  // Zonder keuze van de klant rekenen we met de aanbevolen variant en zonder
  // extra's. Dat is hetzelfde uitgangspunt als de preview toont.
  const totals = resolvePricing(buildQuotePricing(quote.calculations));

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      totalExVat: totals.totalExVat,
      totalVat: totals.totalVat,
      totalIncVat: totals.totalIncVat,
      // De opgeslagen PDF klopt niet meer zodra de prijs verandert.
      pdfUrl: null,
    },
  });
}
