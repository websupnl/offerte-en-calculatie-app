import {
  buildQuotePricing,
  pricingToPreviewShape,
  usesCalculationPricing,
  type QuotePricing,
} from "@/lib/quote-pricing";
import { applyOptionCopy, applyItemCopy } from "@/lib/quote-presentation";

/**
 * Eén regel om overal hetzelfde te doen: als een offerte op het nieuwe pad zit,
 * komen `items`, `choiceGroups` en `options` uit de gekoppelde calculaties.
 * Zit hij op het oude pad, dan blijft alles precies zoals het was.
 *
 * Gebruik dit in elke plek die een offerte laadt om te tonen: de bouwer, het
 * klantportaal, de print-route en de PDF. Zo kan de klant nooit iets anders
 * zien dan jij.
 *
 * ── Waarom hier iets wordt weggegooid ──────────────────────────────────────
 * De ruwe calculatieregels bevatten leverancier, artikelnummer, inkoopprijs en
 * marge. Die horen nooit bij de klant terecht te komen, ook niet verstopt in de
 * paginabron: een klantpagina serialiseert alles wat je meegeeft naar HTML.
 * Daarom gooien we `calculations` en de margegegevens er standaard uit. Alleen
 * schermen die achter een login zitten vragen om `internal: true`.
 */

type QuoteShapeIn = {
  items?: unknown[] | null;
  calculations?: Parameters<typeof buildQuotePricing>[0] | null;
  commercial?: unknown;
  options?: unknown;
};

/** Prijsopbouw zonder inkoop en marge: veilig om naar de browser te sturen. */
export type PublicQuotePricing = Omit<QuotePricing, "base" | "variants" | "addons" | "blocks"> & {
  base: PublicBlock | null;
  variants: PublicBlock[];
  addons: PublicBlock[];
  blocks: PublicBlock[];
};
type PublicBlock = Omit<QuotePricing["blocks"][number], "internal">;

const zonderInterneCijfers = (pricing: QuotePricing): PublicQuotePricing => {
  const strip = (block: QuotePricing["blocks"][number]): PublicBlock => {
    const { internal: _internal, ...rest } = block;
    void _internal;
    return rest;
  };
  return {
    base: pricing.base ? strip(pricing.base) : null,
    variants: pricing.variants.map(strip),
    addons: pricing.addons.map(strip),
    blocks: pricing.blocks.map(strip),
  };
};

export function applyCalculationPricing<T extends QuoteShapeIn>(
  quote: T,
  opties: { internal?: boolean } = {},
): Omit<T, "calculations"> & {
  calculations?: T["calculations"];
  pricing: QuotePricing | PublicQuotePricing | null;
  usesCalculations: boolean;
  calculationSummaries: { id: string; title: string; description: string | null }[];
} {
  const calculations = quote.calculations ?? [];
  const intern = opties.internal === true;

  // De ruwe calculatieregels gaan alleen mee naar schermen achter een login.
  const { calculations: _weg, ...rest } = quote;
  void _weg;
  const basis = intern ? { ...rest, calculations: quote.calculations } : rest;

  if (!usesCalculationPricing({ calculations, items: quote.items })) {
    return { ...basis,
      options: Array.isArray(quote.options) ? applyOptionCopy(quote.options, quote.commercial) : quote.options,
      items: Array.isArray(quote.items) ? applyItemCopy(quote.items as Parameters<typeof applyItemCopy>[0], quote.commercial) : quote.items,
      calculationSummaries: [], pricing: null, usesCalculations: false } as ReturnType<
      typeof applyCalculationPricing<T>
    >;
  }

  const pricing = buildQuotePricing(calculations);
  const shape = pricingToPreviewShape(pricing);
  return {
    ...basis,
    items: applyItemCopy(shape.items, quote.commercial),
    choiceGroups: shape.choiceGroups,
    options: applyOptionCopy(shape.options, quote.commercial),
    pricing: intern ? pricing : zonderInterneCijfers(pricing),
    usesCalculations: true,
    calculationSummaries: pricing.blocks
      .filter((block) => !pricing.variants.some((variant) => variant.id === block.id) && !pricing.addons.some((addon) => addon.id === block.id))
      .map(({ id, title, description }) => ({ id, title, description })),
  } as ReturnType<typeof applyCalculationPricing<T>>;
}
