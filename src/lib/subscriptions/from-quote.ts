/**
 * Van een geaccepteerde offerte naar abonnementsrijen.
 *
 * De calculatie is de bron. Elke RECURRING calculatieregel die de klant
 * daadwerkelijk accepteert (basis, gekozen variant, of aangevinkte extra) wordt
 * één Subscription. Eenmalige regels doen hier niets.
 *
 * `recurringLinesFromCalculations` is puur en getest. `syncSubscriptionsForQuote`
 * is de dunne databaselaag eromheen en is idempotent: dezelfde offerte twee keer
 * accepteren maakt geen tweede abonnement (ontdubbeld op sourceQuoteId +
 * sourceCalculationItemId).
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import { toCents } from "@/lib/money";
import {
  advanceDate,
  dateOnly,
  intervalToCycle,
  type BillingCycle,
} from "@/lib/subscriptions/cycle";

type DbClient = PrismaClient | Prisma.TransactionClient;

const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asCycle = (value: string | null | undefined): BillingCycle | null =>
  value === "MONTHLY" || value === "QUARTERLY" || value === "YEARLY" ? value : null;

export type RawSubItem = {
  id: string;
  description: string;
  qty: unknown;
  unitPrice: unknown;
  totalSalesPrice?: unknown;
  vatRate: unknown;
  optional?: boolean | null;
  hiddenOnQuote?: boolean | null;
  lineType?: string | null;
  billingCycle?: string | null;
  recurringInterval?: string | null;
};

export type RawSubCalculation = {
  id: string;
  title: string;
  role?: string | null;
  items: RawSubItem[];
};

export type RecurringSourceLine = {
  calculationItemId: string;
  serviceName: string;
  /** Per periode, EXCL. btw, in hele centen. */
  priceCents: number;
  vatRatePercent: number;
  billingCycle: BillingCycle;
};

export type QuoteSelectionForSubs = {
  /** Calculation.id's van gekozen varianten (uit QuoteShare.selectedChoiceIds). */
  chosenVariantIds: string[];
  /** CalculationItem.id's van aangevinkte extra's (uit QuoteShare.selectedOptionIds). */
  chosenExtraItemIds: string[];
};

function lineIsRecurring(item: RawSubItem): BillingCycle | null {
  const explicit =
    asCycle(item.billingCycle) ??
    (item.lineType === "RECURRING" ? "MONTHLY" : null) ??
    intervalToCycle(item.recurringInterval);
  return explicit;
}

/**
 * De recurring regels die de klant accepteert. Zelfde variant-regel als
 * buildQuotePricing: minder dan twee VARIANT-calculaties = geen echte keuze, dan
 * tellen ze allemaal mee als basis.
 */
export function recurringLinesFromCalculations(
  calculations: RawSubCalculation[],
  selection: QuoteSelectionForSubs,
): RecurringSourceLine[] {
  const variantCalcs = calculations.filter((c) => c.role === "VARIANT");
  const variantsAreReal = variantCalcs.length >= 2;
  const chosenVariants = new Set(selection.chosenVariantIds);
  const chosenExtras = new Set(selection.chosenExtraItemIds);

  const lines: RecurringSourceLine[] = [];

  for (const calc of calculations) {
    const isUnchosenVariant =
      variantsAreReal && calc.role === "VARIANT" && !chosenVariants.has(calc.id);
    if (isUnchosenVariant) continue;

    for (const item of calc.items) {
      if (item.hiddenOnQuote) continue;
      const cycle = lineIsRecurring(item);
      if (!cycle) continue;
      if (item.optional && !chosenExtras.has(item.id)) continue;

      const qty = num(item.qty);
      const unitPrice = num(item.unitPrice);
      const euro =
        item.totalSalesPrice !== undefined && item.totalSalesPrice !== null
          ? num(item.totalSalesPrice)
          : qty * unitPrice;

      lines.push({
        calculationItemId: item.id,
        serviceName: item.description.trim() || "Abonnement",
        priceCents: toCents(euro),
        vatRatePercent: num(item.vatRate) || 21,
        billingCycle: cycle,
      });
    }
  }

  return lines;
}

export type SubscriptionDraft = RecurringSourceLine & {
  startDate: Date;
  nextBillingDate: Date;
};

/** Recurring regels + akkoorddatum → concrete abonnementsrijen. */
export function subscriptionDraftsFromLines(
  lines: RecurringSourceLine[],
  acceptedAt: Date,
): SubscriptionDraft[] {
  const start = dateOnly(acceptedAt);
  return lines.map((line) => ({
    ...line,
    startDate: start,
    nextBillingDate: advanceDate(start, line.billingCycle, 1),
  }));
}

// ─── Databaselaag ──────────────────────────────────────────────────────────

export type SyncSubscriptionsResult = {
  created: number;
  skipped: number;
  subscriptionIds: string[];
};

/**
 * Maakt de ontbrekende abonnementen voor een geaccepteerde offerte. Idempotent.
 * Roep dit aan na elke acceptatie (portaal of handmatig). Gooit alleen bij een
 * echte databasefout — de aanroeper mag een akkoord niet laten klappen hierop.
 */
export async function syncSubscriptionsForQuote(
  db: DbClient,
  quoteId: string,
  opts: { actor?: string } = {},
): Promise<SyncSubscriptionsResult> {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      company: { select: { id: true, slug: true } },
      customer: { select: { id: true, name: true } },
      share: true,
      calculations: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!quote) throw new Error(`Subscription-sync: offerte ${quoteId} niet gevonden`);

  const share = quote.share;
  const selectedChoiceIds = (share?.selectedChoiceIds ?? {}) as Record<string, string>;
  const selectedOptionIds = Array.isArray(share?.selectedOptionIds)
    ? (share!.selectedOptionIds as string[])
    : [];

  const lines = recurringLinesFromCalculations(quote.calculations, {
    chosenVariantIds: Object.values(selectedChoiceIds),
    chosenExtraItemIds: selectedOptionIds,
  });

  const acceptedAt = share?.acceptedAt ?? new Date();
  const drafts = subscriptionDraftsFromLines(lines, acceptedAt);

  const companyKey = quote.company.slug === "websup" ? "websup" : "koolhaas-installaties";
  const clientName = quote.customer?.name ?? share?.signerName ?? "Onbekende klant";

  const result: SyncSubscriptionsResult = { created: 0, skipped: 0, subscriptionIds: [] };

  for (const draft of drafts) {
    const existing = await db.subscription.findFirst({
      where: { sourceQuoteId: quoteId, sourceCalculationItemId: draft.calculationItemId },
      select: { id: true },
    });
    if (existing) {
      result.skipped += 1;
      result.subscriptionIds.push(existing.id);
      continue;
    }

    const created = await db.subscription.create({
      data: {
        companyId: quote.company.id,
        companyKey,
        customerId: quote.customer?.id ?? null,
        clientName,
        serviceName: draft.serviceName,
        priceCents: draft.priceCents,
        vatRate: draft.vatRatePercent,
        billingCycle: draft.billingCycle,
        startDate: draft.startDate,
        nextBillingDate: draft.nextBillingDate,
        status: "ACTIVE",
        sourceQuoteId: quoteId,
        sourceCalculationItemId: draft.calculationItemId,
        events: {
          create: {
            type: "CREATED",
            detail: `Ontstaan uit offerte ${quote.number}`,
            actor: opts.actor ?? "systeem",
          },
        },
      },
      select: { id: true },
    });
    result.created += 1;
    result.subscriptionIds.push(created.id);
  }

  return result;
}
