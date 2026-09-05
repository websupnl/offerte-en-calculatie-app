import {
  buildQuotePricing,
  pricingToPreviewShape,
  usesCalculationPricing,
  type QuotePricing,
} from "@/lib/quote-pricing";

/**
 * Eén regel om overal hetzelfde te doen: als een offerte op het nieuwe pad zit,
 * komen `items`, `choiceGroups` en `options` uit de gekoppelde calculaties.
 * Zit hij op het oude pad, dan blijft alles precies zoals het was.
 *
 * Gebruik dit in elke plek die een offerte laadt om te tonen: de bouwer, het
 * klantportaal, de print-route en de PDF. Zo kan de klant nooit iets anders
 * zien dan jij.
 */

type QuoteShapeIn = {
  items?: unknown[] | null;
  calculations?: Parameters<typeof buildQuotePricing>[0] | null;
};

export function applyCalculationPricing<T extends QuoteShapeIn>(
  quote: T,
): T & { pricing: QuotePricing | null; usesCalculations: boolean } {
  const calculations = quote.calculations ?? [];
  if (!usesCalculationPricing({ calculations, items: quote.items })) {
    return { ...quote, pricing: null, usesCalculations: false };
  }

  const pricing = buildQuotePricing(calculations);
  const shape = pricingToPreviewShape(pricing);
  return {
    ...quote,
    items: shape.items,
    choiceGroups: shape.choiceGroups,
    options: shape.options,
    pricing,
    usesCalculations: true,
  };
}
