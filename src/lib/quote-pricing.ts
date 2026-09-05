/**
 * De calculatie is de bron van de prijs en de artikelen. Dit bestand vertaalt
 * gekoppelde calculaties naar wat de klant op de offerte ziet.
 *
 * Drie soorten prijs, allemaal uit hetzelfde model:
 *
 *   Calculation.role = "BASE"     de klant krijgt dit sowieso
 *   Calculation.role = "VARIANT"  de klant kiest er een uit
 *   CalculationItem.optional      de klant mag dit aanvinken als extra
 *   CalculationItem.hiddenOnQuote alleen intern, verschijnt nooit
 *
 * Oude offertes hebben QuoteItem-regels en een choiceGroups-blob. Die blijven
 * werken: zie `usesCalculationPricing()` voor de grens tussen oud en nieuw.
 */

export type RecurringInterval = "maand" | "jaar";

export type PriceLine = {
  /** CalculationItem.id. Stabiel, dus bruikbaar als keuze in het klantportaal. */
  id: string;
  description: string;
  /** Toelichting die de klant leest. Leeg = afgeleid uit aantal en eenheid. */
  quoteNote: string | null;
  qty: number;
  unit: string | null;
  unitPrice: number;
  vatRate: number;
  /** qty x unitPrice, excl. btw. */
  total: number;
  /** null = eenmalig. Anders telt de regel niet mee in het eenmalige totaal. */
  recurringInterval: RecurringInterval | null;
};

export type PriceBlock = {
  /** Calculation.id. Stabiel, dus bruikbaar als variantkeuze in het klantportaal. */
  id: string;
  number: string;
  title: string;
  description: string | null;
  role: "BASE" | "VARIANT";
  sortOrder: number;
  vatRate: number;
  /** Vaste regels: deze bepalen de prijs van dit blok. */
  lines: PriceLine[];
  /** Aanvinkbare regels. Tellen pas mee als de klant ze kiest. */
  extras: PriceLine[];
  /** Som van `lines`, excl. btw en zonder abonnementen. */
  totalExVat: number;
  /** Alleen intern: inkoop en marge over de vaste regels. */
  internal: { costPrice: number; marginAmount: number; marginPercent: number };
};

export type QuotePricing = {
  base: PriceBlock | null;
  variants: PriceBlock[];
  /** Alle blokken op volgorde, handig om over te itereren. */
  blocks: PriceBlock[];
};

/** Minimale vorm die deze module nodig heeft; past op de Prisma-resultaten. */
type RawItem = {
  id: string;
  description: string;
  quoteNote?: string | null;
  qty: unknown;
  unit?: string | null;
  unitPrice: unknown;
  costPrice?: unknown;
  totalCostPrice?: unknown;
  totalSalesPrice?: unknown;
  vatRate: unknown;
  optional?: boolean | null;
  hiddenOnQuote?: boolean | null;
  recurringInterval?: string | null;
  type?: string | null;
  sortOrder?: number | null;
};

type RawCalculation = {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  role?: string | null;
  sortOrder?: number | null;
  vatRate: unknown;
  items: RawItem[];
};

const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const asInterval = (value: string | null | undefined): RecurringInterval | null =>
  value === "maand" || value === "jaar" ? value : null;

function toLine(item: RawItem): PriceLine {
  const qty = num(item.qty);
  const unitPrice = num(item.unitPrice);
  // totalSalesPrice is al berekend bij het opslaan; alleen terugvallen als hij ontbreekt.
  const total = item.totalSalesPrice !== undefined && item.totalSalesPrice !== null
    ? num(item.totalSalesPrice)
    : round2(qty * unitPrice);
  return {
    id: item.id,
    description: item.description,
    quoteNote: item.quoteNote?.trim() || null,
    qty,
    unit: item.unit ?? null,
    unitPrice,
    vatRate: num(item.vatRate) || 21,
    total: round2(total),
    recurringInterval: asInterval(item.recurringInterval),
  };
}

function toBlock(calculation: RawCalculation): PriceBlock {
  const zichtbaar = calculation.items
    .filter((item) => !item.hiddenOnQuote)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const vaste = zichtbaar.filter((item) => !item.optional);
  const extras = zichtbaar.filter((item) => item.optional);

  const lines = vaste.map(toLine);
  const eenmalig = lines.filter((line) => line.recurringInterval === null);
  const totalExVat = round2(eenmalig.reduce((sum, line) => sum + line.total, 0));

  // Eigen uren zijn geen inkoop, dus die tellen niet mee in de kostprijs.
  // Zelfde regel als src/app/api/calculations/route.ts, anders klopt de marge niet.
  const costPrice = round2(
    vaste
      .filter((item) => item.type !== "LABOR")
      .reduce((sum, item) => sum + (
        item.totalCostPrice !== undefined && item.totalCostPrice !== null
          ? num(item.totalCostPrice)
          : num(item.qty) * num(item.costPrice)
      ), 0),
  );
  const marginAmount = round2(totalExVat - costPrice);

  return {
    id: calculation.id,
    number: calculation.number,
    title: calculation.title,
    description: calculation.description ?? null,
    role: calculation.role === "VARIANT" ? "VARIANT" : "BASE",
    sortOrder: calculation.sortOrder ?? 0,
    vatRate: num(calculation.vatRate) || 21,
    lines,
    extras: extras.map(toLine),
    totalExVat,
    internal: {
      costPrice,
      marginAmount,
      marginPercent: totalExVat > 0 ? round2((marginAmount / totalExVat) * 100) : 0,
    },
  };
}

export function buildQuotePricing(calculations: RawCalculation[]): QuotePricing {
  const blocks = calculations
    .map(toBlock)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.number.localeCompare(b.number));

  // Eén variant is geen keuze: de klant kan nergens uit kiezen. Zo'n calculatie
  // telt daarom gewoon mee in de prijs. Hem als variant behandelen zou hem uit
  // de offerte laten vallen, en dan verdwijnt er geld zonder dat iemand het ziet.
  const echteVarianten = blocks.filter((block) => block.role === "VARIANT");
  const variants = echteVarianten.length >= 2 ? echteVarianten : [];
  const basisBlokken = blocks.filter((block) => !variants.includes(block));

  return {
    base: mergeBlocks(basisBlokken),
    variants,
    blocks,
  };
}

/**
 * Meerdere basiscalculaties tellen samen op tot één prijs. Dat gebeurt zodra je
 * het werk over losse calculaties verdeelt, bijvoorbeeld materiaal en montage.
 */
function mergeBlocks(blocks: PriceBlock[]): PriceBlock | null {
  if (blocks.length === 0) return null;
  if (blocks.length === 1) return blocks[0];

  const eerste = blocks[0];
  const lines = blocks.flatMap((block) => block.lines);
  const totalExVat = round2(
    lines.filter((line) => line.recurringInterval === null).reduce((sum, line) => sum + line.total, 0),
  );
  const costPrice = round2(blocks.reduce((sum, block) => sum + block.internal.costPrice, 0));
  const marginAmount = round2(totalExVat - costPrice);

  return {
    ...eerste,
    title: blocks.map((block) => block.title).join(" + "),
    number: blocks.map((block) => block.number).join(", "),
    role: "BASE",
    lines,
    extras: blocks.flatMap((block) => block.extras),
    totalExVat,
    internal: {
      costPrice,
      marginAmount,
      marginPercent: totalExVat > 0 ? round2((marginAmount / totalExVat) * 100) : 0,
    },
  };
}

/**
 * Bepaalt of een offerte op het nieuwe pad zit.
 *
 * De regel is bewust zelfverklarend: in het nieuwe model schrijven we geen
 * QuoteItem meer weg. Heeft een offerte nog losse regels staan, dan is hij van
 * voor de omslag en blijft hij renderen zoals hij verstuurd is. Dat is de
 * afspraak: bestaande offertes veranderen niet.
 */
export function usesCalculationPricing(quote: {
  calculations?: { id: string }[] | null;
  items?: unknown[] | null;
}): boolean {
  return (quote.calculations?.length ?? 0) > 0 && (quote.items?.length ?? 0) === 0;
}

export type PricingSelection = {
  /** Calculation.id van de gekozen variant. Leeg = de aanbevolen of eerste. */
  variantId?: string | null;
  /** CalculationItem.id's van de aangevinkte extra's. */
  extraIds?: string[];
};

export type PricingTotals = {
  totalExVat: number;
  totalVat: number;
  totalIncVat: number;
  perMonthExVat: number;
  perYearExVat: number;
  /** Het blok dat de prijs bepaalt: de basis, of de gekozen variant. */
  activeBlock: PriceBlock | null;
  chosenExtras: PriceLine[];
};

export function resolvePricing(
  pricing: QuotePricing,
  selection: PricingSelection = {},
): PricingTotals {
  const gekozenVariant = pricing.variants.find((block) => block.id === selection.variantId)
    ?? pricing.variants[0]
    ?? null;
  const activeBlock = pricing.base ?? gekozenVariant;

  // Basis en variant kunnen naast elkaar bestaan: basisprijs plus de gekozen variant.
  const meetellend = [pricing.base, pricing.variants.length ? gekozenVariant : null]
    .filter((block): block is PriceBlock => Boolean(block));

  const gekozenIds = new Set(selection.extraIds ?? []);
  const chosenExtras = meetellend.flatMap((block) =>
    block.extras.filter((extra) => gekozenIds.has(extra.id)),
  );

  const eenmaligeRegels = [
    ...meetellend.flatMap((block) => block.lines),
    ...chosenExtras,
  ].filter((line) => line.recurringInterval === null);

  const totalExVat = round2(eenmaligeRegels.reduce((sum, line) => sum + line.total, 0));
  const totalVat = round2(
    eenmaligeRegels.reduce((sum, line) => sum + line.total * (line.vatRate / 100), 0),
  );

  const terugkerend = [
    ...meetellend.flatMap((block) => block.lines),
    ...chosenExtras,
  ].filter((line) => line.recurringInterval !== null);

  return {
    totalExVat,
    totalVat,
    totalIncVat: round2(totalExVat + totalVat),
    perMonthExVat: round2(
      terugkerend.filter((l) => l.recurringInterval === "maand").reduce((s, l) => s + l.total, 0),
    ),
    perYearExVat: round2(
      terugkerend.filter((l) => l.recurringInterval === "jaar").reduce((s, l) => s + l.total, 0),
    ),
    activeBlock,
    chosenExtras,
  };
}

// ─── Vertaling naar de bestaande offertevorm ────────────────────────────────
//
// De preview, het klantportaal en de PDF renderen al jaren `items`,
// `choiceGroups` en `options`. Die zijn uitgewerkt en bewezen, dus die laten we
// staan. Alleen de bron verandert: niet meer drie plekken waar je los kunt
// typen, maar één calculatie die deze drie vormen produceert.

export type PreviewShape = {
  items: {
    id: string;
    description: string;
    qty: number;
    unitPrice: number;
    vatRate: number;
    total: number;
    indent: number;
    hiddenOnQuote: boolean;
  }[];
  choiceGroups: {
    id: string;
    title: string;
    type: "SINGLE_SELECT";
    description?: string;
    recommendedChoiceId?: string;
    choices: {
      id: string;
      title: string;
      summary?: string;
      tag?: string;
      calculationId: string;
      items: {
        description: string;
        qty: number;
        unitPrice: number;
        vatRate: number;
        indent: number;
      }[];
    }[];
  }[];
  options: {
    id: string;
    t: string;
    d: string;
    tag: string;
    price: number | null;
    recurringPrice: number | null;
    recurringInterval: RecurringInterval | null;
    vatRate: number;
    required: boolean;
    defaultSelected: boolean;
    details: string[];
  }[];
};

/** Toelichting bij een extra: wat jij hebt getypt, anders aantal en eenheid. */
const extraNote = (line: PriceLine) =>
  line.quoteNote ?? `${line.qty} ${line.unit ?? "stuk"}`;

export function pricingToPreviewShape(pricing: QuotePricing): PreviewShape {
  const items = (pricing.base?.lines ?? []).map((line) => ({
    id: line.id,
    description: line.description,
    qty: line.qty,
    unitPrice: line.unitPrice,
    vatRate: line.vatRate,
    total: line.total,
    indent: 0,
    hiddenOnQuote: false,
  }));

  // Eén variant is geen keuze; buildQuotePricing heeft die al tot basis gemaakt.
  const choiceGroups: PreviewShape["choiceGroups"] = pricing.variants.length >= 2
    ? [{
        id: "varianten",
        title: "Kies uw uitvoering",
        type: "SINGLE_SELECT" as const,
        recommendedChoiceId: pricing.variants[0].id,
        choices: pricing.variants.map((block) => ({
          id: block.id,
          title: block.title,
          summary: block.description ?? undefined,
          calculationId: block.id,
          items: block.lines.map((line) => ({
            description: line.description,
            qty: line.qty,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            indent: 0,
          })),
        })),
      }]
    : [];

  // Extra's horen bij de basis. Een optionele regel in een variant zou alleen
  // moeten tellen als die variant gekozen is, en dat kan het klantportaal niet.
  // De editor waarschuwt daarvoor voordat je verstuurt.
  const options = (pricing.base?.extras ?? []).map((line) => ({
    id: line.id,
    t: line.description,
    d: extraNote(line),
    tag: "Optioneel",
    price: line.recurringInterval === null ? line.total : null,
    recurringPrice: line.recurringInterval === null ? null : line.total,
    recurringInterval: line.recurringInterval,
    vatRate: line.vatRate,
    required: false,
    defaultSelected: false,
    details: [],
  }));

  return { items, choiceGroups, options };
}

