/**
 * Gedeelde abonnementslogica. Zowel de interne API (met sessie) als de
 * Donna-gateway (met bearer-token) draaien hierop, zodat validatie en gedrag op
 * één plek staan.
 *
 * Bedragen gaan hier in hele centen (Int), ex btw. Zie src/lib/money.ts.
 */

import type { Prisma, PrismaClient, Subscription } from "@/generated/prisma";
import {
  advanceDate,
  alreadyInvoicedThisPeriod,
  CYCLE_MONTHS,
  dateOnly,
  periodStartFor,
  toISODate,
  type BillingCycle,
} from "@/lib/subscriptions/cycle";

type DbClient = PrismaClient | Prisma.TransactionClient;

export class SubscriptionError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "PAUSED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

/** Donna-sleutel ⇆ app-slug. */
export const DONNA_COMPANY_KEYS = ["koolhaas-installaties", "websup"] as const;
export type DonnaCompanyKey = (typeof DONNA_COMPANY_KEYS)[number];

export function companyKeyToSlug(key: DonnaCompanyKey): "koolhaas" | "websup" {
  return key === "websup" ? "websup" : "koolhaas";
}
export function slugToCompanyKey(slug: string): DonnaCompanyKey {
  return slug === "websup" ? "websup" : "koolhaas-installaties";
}

// ─── DTO ───────────────────────────────────────────────────────────────────

export type SubscriptionEventDto = {
  type: string;
  detail: string | null;
  amountCents: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  actor: string | null;
  occurredAt: string;
};

export type SubscriptionDto = {
  id: string;
  companyKey: string;
  clientRef: string | null;
  clientName: string;
  serviceName: string;
  priceCents: number;
  vatRate: number;
  currency: string;
  billingCycle: BillingCycle;
  startDate: string;
  nextBillingDate: string;
  lastInvoicedAt: string | null;
  status: string;
  sourceQuoteId: string | null;
  migrationPending: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type SubscriptionRow = Subscription & {
  events?: {
    type: string;
    detail: string | null;
    amountCents: number | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    actor: string | null;
    occurredAt: Date;
  }[];
};

/** Postgres bigint/Decimal komen als string of object binnen; Number() aan de rand. */
export function subscriptionDto(row: SubscriptionRow): SubscriptionDto & { history?: SubscriptionEventDto[] } {
  const dto: SubscriptionDto & { history?: SubscriptionEventDto[] } = {
    id: row.id,
    companyKey: row.companyKey,
    clientRef: row.customerId,
    clientName: row.clientName,
    serviceName: row.serviceName,
    priceCents: Number(row.priceCents),
    vatRate: Number(row.vatRate),
    currency: row.currency,
    billingCycle: row.billingCycle as BillingCycle,
    startDate: toISODate(row.startDate),
    nextBillingDate: toISODate(row.nextBillingDate),
    lastInvoicedAt: row.lastInvoicedAt ? row.lastInvoicedAt.toISOString() : null,
    status: row.status,
    sourceQuoteId: row.sourceQuoteId,
    migrationPending: row.migrationPending,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.events) {
    dto.history = row.events.map((event) => ({
      type: event.type,
      detail: event.detail,
      amountCents: event.amountCents === null ? null : Number(event.amountCents),
      periodStart: event.periodStart ? toISODate(event.periodStart) : null,
      periodEnd: event.periodEnd ? toISODate(event.periodEnd) : null,
      actor: event.actor,
      occurredAt: event.occurredAt.toISOString(),
    }));
  }
  return dto;
}

// ─── Lijst ─────────────────────────────────────────────────────────────────

export type ListSubscriptionsFilter = {
  companyIds: string[];
  companyKey?: string;
  clientRef?: string;
  status?: string;
  /** next_billing_date op of vóór deze datum. */
  dueBefore?: Date;
  limit?: number;
};

export async function listSubscriptions(db: DbClient, filter: ListSubscriptionsFilter) {
  const rows = await db.subscription.findMany({
    where: {
      companyId: { in: filter.companyIds },
      ...(filter.companyKey ? { companyKey: filter.companyKey } : {}),
      ...(filter.clientRef ? { customerId: filter.clientRef } : {}),
      ...(filter.status ? { status: filter.status as SubscriptionStatus } : {}),
      ...(filter.dueBefore ? { nextBillingDate: { lte: filter.dueBefore } } : {}),
    },
    orderBy: [{ nextBillingDate: "asc" }, { clientName: "asc" }],
    take: Math.min(Math.max(filter.limit ?? 100, 1), 500),
  });
  return rows;
}

// ─── "Te factureren" ───────────────────────────────────────────────────────

/**
 * Actieve abonnementen waarvan de volgende factuurdatum binnen `withinDays` valt
 * en die voor die periode nog niet gefactureerd zijn. Dit is het scherm dat de
 * losse Hostinger-mail overbodig maakt.
 */
export async function listBillingDue(
  db: DbClient,
  filter: { companyIds: string[]; withinDays?: number; companyKey?: string },
) {
  const withinDays = Math.min(Math.max(filter.withinDays ?? 30, 0), 365);
  const horizon = advanceDateDays(new Date(), withinDays);
  const rows = await db.subscription.findMany({
    where: {
      companyId: { in: filter.companyIds },
      status: "ACTIVE",
      nextBillingDate: { lte: dateOnly(horizon) },
      ...(filter.companyKey ? { companyKey: filter.companyKey } : {}),
    },
    orderBy: [{ nextBillingDate: "asc" }],
  });
  return rows.filter(
    (row) =>
      !alreadyInvoicedThisPeriod(
        row.nextBillingDate,
        row.billingCycle as BillingCycle,
        row.lastInvoicedAt,
      ),
  );
}

function advanceDateDays(date: Date, days: number): Date {
  const d = dateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ─── Aanmaken (handmatig / legacy) ─────────────────────────────────────────

export type CreateSubscriptionInput = {
  companyId: string;
  companyKey: string;
  customerId?: string | null;
  clientName: string;
  serviceName: string;
  priceCents: number;
  vatRate?: number;
  currency?: string;
  billingCycle: BillingCycle;
  startDate: Date;
  nextBillingDate?: Date;
  notes?: string | null;
  migrationPending?: boolean;
  actor?: string;
};

export async function createSubscription(db: DbClient, input: CreateSubscriptionInput) {
  const start = dateOnly(input.startDate);
  const next = input.nextBillingDate
    ? dateOnly(input.nextBillingDate)
    : advanceDate(start, input.billingCycle, 1);

  return db.subscription.create({
    data: {
      companyId: input.companyId,
      companyKey: input.companyKey,
      customerId: input.customerId ?? null,
      clientName: input.clientName,
      serviceName: input.serviceName,
      priceCents: Math.round(input.priceCents),
      vatRate: input.vatRate ?? 21,
      currency: input.currency ?? "EUR",
      billingCycle: input.billingCycle,
      startDate: start,
      nextBillingDate: next,
      status: "ACTIVE",
      notes: input.notes ?? null,
      migrationPending: input.migrationPending ?? false,
      events: {
        create: {
          type: "CREATED",
          detail: "Handmatig aangemaakt",
          actor: input.actor ?? "systeem",
        },
      },
    },
    include: { events: { orderBy: { occurredAt: "desc" } } },
  });
}

// ─── Bijwerken ─────────────────────────────────────────────────────────────

export type PatchSubscriptionInput = {
  priceCents?: number;
  nextBillingDate?: Date;
  status?: SubscriptionStatus;
  serviceName?: string;
  notes?: string | null;
  migrationPending?: boolean;
  actor?: string;
};

export async function patchSubscription(
  db: DbClient,
  id: string,
  input: PatchSubscriptionInput,
  companyIds: string[],
) {
  const current = await db.subscription.findFirst({ where: { id, companyId: { in: companyIds } } });
  if (!current) throw new SubscriptionError("NOT_FOUND", 404, "Subscription was not found");

  const data: Prisma.SubscriptionUpdateInput = {};
  const events: Prisma.SubscriptionEventCreateWithoutSubscriptionInput[] = [];

  if (input.priceCents !== undefined && Math.round(input.priceCents) !== current.priceCents) {
    data.priceCents = Math.round(input.priceCents);
    events.push({
      type: "PRICE_CHANGED",
      detail: `${current.priceCents} → ${Math.round(input.priceCents)} cent (ex btw)`,
      actor: input.actor ?? "systeem",
    });
  }
  if (input.nextBillingDate !== undefined) data.nextBillingDate = dateOnly(input.nextBillingDate);
  if (input.serviceName !== undefined) data.serviceName = input.serviceName;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.migrationPending !== undefined) data.migrationPending = input.migrationPending;
  if (input.status !== undefined && input.status !== current.status) {
    data.status = input.status;
    events.push({
      type:
        input.status === "PAUSED" ? "PAUSED" : input.status === "CANCELLED" ? "CANCELLED" : "RESUMED",
      detail: `Status ${current.status} → ${input.status}`,
      actor: input.actor ?? "systeem",
    });
  }

  return db.subscription.update({
    where: { id },
    data: { ...data, ...(events.length ? { events: { create: events } } : {}) },
    include: { events: { orderBy: { occurredAt: "desc" } } },
  });
}

// ─── Gefactureerd markeren ─────────────────────────────────────────────────

export type MarkInvoicedInput = {
  invoicedAt?: Date;
  periodsAdvanced?: number;
  actor?: string;
};

export type MarkInvoicedResult = {
  status: "invoiced" | "already_invoiced";
  subscription: SubscriptionRow;
  periodsAdvanced: number;
};

/** Fractie van een cyclus waarbinnen een tweede aanroep als dubbel geldt. */
const DUPLICATE_WINDOW_FRACTION = 0.6;

function isDuplicateInvoiceCall(
  row: Subscription,
  invoicedAt: Date,
): boolean {
  if (!row.lastInvoicedAt) return false;
  const cycleDays = CYCLE_MONTHS[row.billingCycle as BillingCycle] * 30;
  const gapMs = invoicedAt.getTime() - row.lastInvoicedAt.getTime();
  return gapMs < cycleDays * DUPLICATE_WINDOW_FRACTION * 24 * 60 * 60 * 1000;
}

export async function markSubscriptionInvoiced(
  db: DbClient,
  id: string,
  input: MarkInvoicedInput,
  companyIds: string[],
): Promise<MarkInvoicedResult> {
  const row = await db.subscription.findFirst({ where: { id, companyId: { in: companyIds } } });
  if (!row) throw new SubscriptionError("NOT_FOUND", 404, "Subscription was not found");
  if (row.status === "CANCELLED") {
    throw new SubscriptionError("SUBSCRIPTION_CANCELLED", 409, "A cancelled subscription cannot be invoiced");
  }

  const cycle = row.billingCycle as BillingCycle;
  const invoicedAt = input.invoicedAt ?? new Date();
  const periods = Math.min(Math.max(Math.round(input.periodsAdvanced ?? 1), 1), 60);

  if (isDuplicateInvoiceCall(row, invoicedAt)) {
    return { status: "already_invoiced", subscription: row, periodsAdvanced: 0 };
  }

  const periodStart = periodStartFor(row.nextBillingDate, cycle);
  const newNextBillingDate = advanceDate(row.nextBillingDate, cycle, periods);

  const updated = await db.subscription.update({
    where: { id },
    data: {
      lastInvoicedAt: invoicedAt,
      nextBillingDate: newNextBillingDate,
      events: {
        create: {
          type: "INVOICED",
          detail:
            periods === 1
              ? "Periode gefactureerd"
              : `${periods} periodes vooruit gefactureerd`,
          amountCents: row.priceCents * periods,
          periodStart,
          periodEnd: newNextBillingDate,
          actor: input.actor ?? "systeem",
        },
      },
    },
    include: { events: { orderBy: { occurredAt: "desc" } } },
  });

  return { status: "invoiced", subscription: updated, periodsAdvanced: periods };
}

// ─── Agreement gaps (Donna-signaal) ────────────────────────────────────────

/**
 * Geaccepteerde offertes zonder rij in AgreementLog. Donna gebruikt dit voor
 * "3 projecten zonder formeel akkoord".
 */
export async function listAgreementGaps(db: DbClient, companyIds: string[]) {
  const quotes = await db.quote.findMany({
    where: {
      companyId: { in: companyIds },
      status: "ACCEPTED",
      archivedAt: null,
      agreementLogs: { none: {} },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      number: true,
      title: true,
      companyId: true,
      totalIncVat: true,
      updatedAt: true,
      customer: { select: { id: true, name: true } },
      company: { select: { slug: true } },
    },
  });
  return quotes.map((quote) => ({
    quoteRef: quote.id,
    quoteNumber: quote.number,
    title: quote.title ?? "",
    companyKey: slugToCompanyKey(quote.company.slug),
    clientRef: quote.customer?.id ?? null,
    clientName: quote.customer?.name ?? "",
    totalIncVatCents: Math.round(Number(quote.totalIncVat) * 100),
    acceptedAt: quote.updatedAt.toISOString(),
  }));
}
