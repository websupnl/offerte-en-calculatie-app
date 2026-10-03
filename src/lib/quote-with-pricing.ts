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
};

/** Prijsopbouw zonder inkoop en marge: veilig om naar de browser te sturen. */
export type PublicQuotePricing = Omit<QuotePricing, "base" | "variants" | "blocks"> & {
  base: PublicBlock | null;
  variants: PublicBlock[];
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
} {
  const calculations = quote.calculations ?? [];
  const intern = opties.internal === true;

  // De ruwe calculatieregels gaan alleen mee naar schermen achter een login.
  const { calculations: _weg, ...rest } = quote;
  void _weg;
  const basis = intern ? { ...rest, calculations: quote.calculations } : rest;

  if (!usesCalculationPricing({ calculations, items: quote.items })) {
    return { ...basis, pricing: null, usesCalculations: false } as ReturnType<
      typeof applyCalculationPricing<T>
    >;
  }

  const pricing = buildQuotePricing(calculations);
  const shape = pricingToPreviewShape(pricing);
  return {
    ...basis,
    items: shape.items,
    choiceGroups: shape.choiceGroups,
    options: shape.options,
    pricing: intern ? pricing : zonderInterneCijfers(pricing),
    usesCalculations: true,
  } as ReturnType<typeof applyCalculationPricing<T>>;
}
