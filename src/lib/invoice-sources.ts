import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber } from "@/lib/format";
import { volgendVolgnummer } from "@/lib/next-number";
import { buildQuotePricing, resolvePricing, usesCalculationPricing, type PriceLine } from "@/lib/quote-pricing";
import type { InvoiceLineInput } from "@/lib/invoice-totals";

/**
 * Waar factuurregels vandaan kunnen komen. Alles wordt een kopie: een factuur
 * verandert niet meer als de offerte of calculatie later wordt aangepast.
 */
export type InvoiceSource =
  | { type: "quote"; id: string }
  | { type: "calculation"; id: string }
  | { type: "workorder"; id: string };

export type SourceResult = {
  lines: InvoiceLineInput[];
  customerId: string | null;
  projectId: string | null;
  quoteId: string | null;
  workOrderId: string | null;
  reference: string | null;
};

const priceLineToInvoice = (l: PriceLine): InvoiceLineInput => ({
  description: l.quoteNote ? `${l.description}\n${l.quoteNote}` : l.description,
  qty: l.qty,
  unit: l.unit ?? "stuk",
  // totalSalesPrice kan afwijken van qty x prijs door afronding; de regel moet
  // op de factuur hetzelfde bedrag geven als op de offerte.
  unitPrice: l.qty ? Math.round((l.total / l.qty) * 10000) / 10000 : l.unitPrice,
  vatRate: l.vatRate,
});

/**
 * Offerte -> regels. Nieuw pad: de calculaties met de keuze die de klant in het
 * portaal maakte (variant + aangevinkte extra's). Abonnementsregels blijven
 * buiten de factuur; die lopen via Abonnementen.
 */
async function fromQuote(id: string, companyId: string, detailed = false): Promise<SourceResult | null> {
  const quote = await prisma.quote.findFirst({
    where: { id, companyId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      share: true,
      calculations: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!quote) return null;

  let lines: InvoiceLineInput[];
  if (usesCalculationPricing(quote)) {
    const pricing = buildQuotePricing(quote.calculations);
    const chosen = Object.values((quote.share?.selectedChoiceIds ?? {}) as Record<string, string>);
    const extraIds = Array.isArray(quote.share?.selectedOptionIds)
      ? (quote.share!.selectedOptionIds as string[])
      : [];
    const variantId = chosen.find((c) => pricing.variants.some((v) => v.id === c)) ?? null;
    const totals = resolvePricing(pricing, { variantId, extraIds });
    const variant = pricing.variants.length
      ? pricing.variants.find((v) => v.id === variantId) ?? pricing.variants[0]
      : null;
    lines = [
      ...(pricing.base?.lines ?? []),
      ...(variant?.lines ?? []),
      ...totals.chosenExtras,
    ]
      .filter((l) => l.recurringInterval === null)
      .map(priceLineToInvoice);
  } else {
    // Oude offertes zetten de prijs vaak op verborgen regels en tonen de klant
    // alleen tekstregels van €0. Het geld zit dus in de verborgen regels: die
    // moeten mee, anders klopt het factuurtotaal niet met de offerte.
    lines = quote.items
      .filter((it) => !it.hiddenOnQuote || Number(it.unitPrice) !== 0)
      .map((it) => ({
        description: it.description,
        qty: Number(it.qty),
        unit: "stuk",
        unitPrice: Number(it.unitPrice),
        vatRate: Number(it.vatRate),
      }));
    const discount = Number(quote.discount);
    if (discount > 0) {
      lines.push({ description: "Korting", qty: 1, unit: "stuk", unitPrice: -discount, vatRate: Number(quote.vatRate) || 21 });
    }
  }

  // Standaard één regel "volgens offerte": de klant heeft de details al in de
  // offerte gezien. Per btw-tarief één regel, anders klopt de btw niet.
  if (!detailed && lines.length > 0) {
    const perTarief = new Map<number, number>();
    for (const l of lines) perTarief.set(l.vatRate, (perTarief.get(l.vatRate) ?? 0) + l.qty * l.unitPrice);
    const omschrijving = `Werkzaamheden volgens offerte ${quote.number}${quote.title ? `\n${quote.title}` : ""}`;
    lines = [...perTarief.entries()]
      .filter(([, bedrag]) => Math.abs(bedrag) >= 0.005)
      .map(([vatRate, bedrag]) => ({
        description: perTarief.size > 1 ? `${omschrijving} (${vatRate}% btw)` : omschrijving,
        qty: 1,
        unit: "post",
        unitPrice: Math.round(bedrag * 100) / 100,
        vatRate,
      }));
  }

  return {
    lines,
    customerId: quote.customerId,
    projectId: quote.projectId,
    quoteId: quote.id,
    workOrderId: null,
    reference: `Offerte ${quote.number}${quote.title ? ` · ${quote.title}` : ""}`,
  };
}

async function fromCalculation(id: string, companyId: string): Promise<SourceResult | null> {
  const calc = await prisma.calculation.findFirst({
    where: { id, companyId },
    include: { items: { orderBy: { sortOrder: "asc" } }, quote: { select: { customerId: true, projectId: true } } },
  });
  if (!calc) return null;
  // Als losse basis behandelen, zodat een variant-calculatie ook gewoon telt.
  const pricing = buildQuotePricing([{ ...calc, role: "BASE" }]);
  return {
    lines: (pricing.base?.lines ?? []).filter((l) => l.recurringInterval === null).map(priceLineToInvoice),
    customerId: calc.customerId ?? calc.quote?.customerId ?? null,
    projectId: calc.projectId ?? calc.quote?.projectId ?? null,
    quoteId: calc.quoteId,
    workOrderId: null,
    reference: `Calculatie ${calc.number} · ${calc.title}`,
  };
}

async function fromWorkOrder(id: string, companyId: string): Promise<SourceResult | null> {
  const wo = await prisma.workOrder.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      project: { select: { id: true, customerId: true } },
    },
  });
  if (!wo) return null;
  return {
    lines: wo.lines.map((l) => ({
      description: l.type === "ARBEID" ? `Arbeid: ${l.description}` : l.description,
      qty: Number(l.qty),
      unit: l.unit ?? "stuk",
      unitPrice: Number(l.unitPrice),
      vatRate: 21,
    })),
    customerId: wo.project.customerId,
    projectId: wo.project.id,
    quoteId: null,
    workOrderId: wo.id,
    reference: `Werkbon ${wo.number} · ${wo.title}`,
  };
}

export function linesFromSource(source: InvoiceSource, companyId: string, opts: { detailed?: boolean } = {}) {
  if (source.type === "quote") return fromQuote(source.id, companyId, opts.detailed);
  if (source.type === "calculation") return fromCalculation(source.id, companyId);
  return fromWorkOrder(source.id, companyId);
}

/** Volgend factuurnummer op het hoogste bestaande, niet op het aantal (zie next-number.ts). */
export async function nextInvoiceNumber(companyId: string, companySlug: string, date = new Date()) {
  const prefix = generateInvoiceNumber(companySlug, 0, date).replace(/\d+$/, "");
  const bestaande = await prisma.salesInvoice.findMany({
    where: { companyId, number: { startsWith: prefix } },
    select: { number: true },
  });
  return generateInvoiceNumber(companySlug, volgendVolgnummer(bestaande.map((i) => i.number), prefix), date);
}
