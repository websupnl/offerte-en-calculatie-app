import assert from "node:assert/strict";
import test from "node:test";
import { toCents, centsToEuro, vatCents, sumCents } from "../src/lib/money";
import {
  advanceDate,
  alreadyInvoicedThisPeriod,
  cycleToInterval,
  intervalToCycle,
  periodStartFor,
  toISODate,
} from "../src/lib/subscriptions/cycle";
import {
  recurringLinesFromCalculations,
  subscriptionDraftsFromLines,
} from "../src/lib/subscriptions/from-quote";
import {
  markSubscriptionInvoiced,
  subscriptionDto,
} from "../src/lib/subscriptions/service";

// ── Geld in centen ──────────────────────────────────────────────────────────

test("toCents rondt af in plaats van af te kappen", () => {
  assert.equal(toCents(1.005), 101);
  assert.equal(toCents("19.99"), 1999);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(null), 0);
  assert.equal(toCents("geen getal"), 0);
});

test("centsToEuro is de omgekeerde weg", () => {
  assert.equal(centsToEuro(1999), 19.99);
  assert.equal(centsToEuro(100), 1);
});

test("sumCents blijft integer, geen drijvende-kommaruis", () => {
  assert.equal(sumCents([1010, 2020, 3033]), 6063);
  assert.equal(sumCents([10, null, undefined, 5]), 15);
});

test("vatCents rekent btw over centen", () => {
  assert.equal(vatCents(10000, 21), 2100);
  assert.equal(vatCents(3333, 21), 700);
});

// ── Cyclus-rekenwerk ────────────────────────────────────────────────────────

test("advanceDate telt de juiste maanden op per cyclus", () => {
  const start = new Date(Date.UTC(2026, 0, 15));
  assert.equal(toISODate(advanceDate(start, "MONTHLY", 1)), "2026-02-15");
  assert.equal(toISODate(advanceDate(start, "QUARTERLY", 1)), "2026-04-15");
  assert.equal(toISODate(advanceDate(start, "YEARLY", 1)), "2027-01-15");
  assert.equal(toISODate(advanceDate(start, "MONTHLY", 13)), "2027-02-15");
});

test("advanceDate zet 31 jan + 1 maand op de laatste dag van februari", () => {
  const jan31 = new Date(Date.UTC(2026, 0, 31));
  assert.equal(toISODate(advanceDate(jan31, "MONTHLY", 1)), "2026-02-28");
  const jan31leap = new Date(Date.UTC(2028, 0, 31));
  assert.equal(toISODate(advanceDate(jan31leap, "MONTHLY", 1)), "2028-02-29");
});

test("advanceDate werkt ook achteruit (voor periodStartFor)", () => {
  const d = new Date(Date.UTC(2026, 3, 1));
  assert.equal(toISODate(advanceDate(d, "QUARTERLY", -1)), "2026-01-01");
  assert.equal(toISODate(periodStartFor(d, "MONTHLY")), "2026-03-01");
});

test("interval ⇆ cyclus mapping", () => {
  assert.equal(intervalToCycle("maand"), "MONTHLY");
  assert.equal(intervalToCycle("kwartaal"), "QUARTERLY");
  assert.equal(intervalToCycle("jaar"), "YEARLY");
  assert.equal(intervalToCycle("iets"), null);
  assert.equal(cycleToInterval("QUARTERLY"), "kwartaal");
});

test("alreadyInvoicedThisPeriod kijkt of de vorige facturatie in de lopende periode viel", () => {
  const nextBilling = new Date(Date.UTC(2026, 5, 1)); // periode juni loopt van 1 mei tot 1 juni
  assert.equal(alreadyInvoicedThisPeriod(nextBilling, "MONTHLY", null), false);
  assert.equal(
    alreadyInvoicedThisPeriod(nextBilling, "MONTHLY", new Date(Date.UTC(2026, 4, 15))),
    true,
  );
  assert.equal(
    alreadyInvoicedThisPeriod(nextBilling, "MONTHLY", new Date(Date.UTC(2026, 3, 15))),
    false,
  );
});

// ── Offerte → abonnementsregels ─────────────────────────────────────────────

const baseCalc = {
  id: "calc-base",
  title: "Website & hosting",
  role: "BASE",
  items: [
    { id: "i1", description: "Website bouwen", qty: 1, unitPrice: 4000, totalSalesPrice: 4000, vatRate: 21 },
    {
      id: "i2",
      description: "Hosting & beheer",
      qty: 1,
      unitPrice: 25,
      totalSalesPrice: 25,
      vatRate: 21,
      lineType: "RECURRING",
      billingCycle: "MONTHLY",
    },
    {
      id: "i3",
      description: "Domein websup.nl",
      qty: 1,
      unitPrice: 12,
      totalSalesPrice: 12,
      vatRate: 21,
      recurringInterval: "jaar",
    },
    {
      id: "i4",
      description: "Extra mailbox",
      qty: 1,
      unitPrice: 3,
      totalSalesPrice: 3,
      vatRate: 21,
      optional: true,
      lineType: "RECURRING",
      billingCycle: "MONTHLY",
    },
    {
      id: "i5",
      description: "Interne post",
      qty: 1,
      unitPrice: 99,
      totalSalesPrice: 99,
      vatRate: 21,
      hiddenOnQuote: true,
      lineType: "RECURRING",
      billingCycle: "MONTHLY",
    },
  ],
};

test("alleen terugkerende, zichtbare, niet-optionele regels worden abonnementen", () => {
  const lines = recurringLinesFromCalculations([baseCalc], {
    chosenVariantIds: [],
    chosenExtraItemIds: [],
  });
  assert.deepEqual(
    lines.map((l) => l.calculationItemId).sort(),
    ["i2", "i3"],
  );
  const hosting = lines.find((l) => l.calculationItemId === "i2")!;
  assert.equal(hosting.priceCents, 2500);
  assert.equal(hosting.billingCycle, "MONTHLY");
  const domein = lines.find((l) => l.calculationItemId === "i3")!;
  assert.equal(domein.billingCycle, "YEARLY");
  assert.equal(domein.priceCents, 1200);
});

test("een aangevinkte optionele extra telt wél mee", () => {
  const lines = recurringLinesFromCalculations([baseCalc], {
    chosenVariantIds: [],
    chosenExtraItemIds: ["i4"],
  });
  assert.ok(lines.some((l) => l.calculationItemId === "i4"));
});

test("verborgen regels worden nooit een abonnement", () => {
  const lines = recurringLinesFromCalculations([baseCalc], {
    chosenVariantIds: [],
    chosenExtraItemIds: ["i5"],
  });
  assert.equal(lines.some((l) => l.calculationItemId === "i5"), false);
});

test("niet-gekozen varianten leveren geen abonnement op, gekozen wel", () => {
  const variantA = {
    id: "var-a",
    title: "Basis",
    role: "VARIANT",
    items: [{ id: "a1", description: "Support licht", qty: 1, unitPrice: 10, totalSalesPrice: 10, vatRate: 21, lineType: "RECURRING", billingCycle: "MONTHLY" }],
  };
  const variantB = {
    id: "var-b",
    title: "Uitgebreid",
    role: "VARIANT",
    items: [{ id: "b1", description: "Support ruim", qty: 1, unitPrice: 30, totalSalesPrice: 30, vatRate: 21, lineType: "RECURRING", billingCycle: "MONTHLY" }],
  };
  const lines = recurringLinesFromCalculations([baseCalc, variantA, variantB], {
    chosenVariantIds: ["var-b"],
    chosenExtraItemIds: [],
  });
  const ids = lines.map((l) => l.calculationItemId).sort();
  assert.deepEqual(ids, ["b1", "i2", "i3"]);
});

test("één losse VARIANT telt als basis (zelfde regel als buildQuotePricing)", () => {
  const onlyVariant = {
    id: "var-only",
    title: "Enige uitvoering",
    role: "VARIANT",
    items: [{ id: "v1", description: "Onderhoud", qty: 1, unitPrice: 20, totalSalesPrice: 20, vatRate: 21, lineType: "RECURRING", billingCycle: "MONTHLY" }],
  };
  const lines = recurringLinesFromCalculations([onlyVariant], {
    chosenVariantIds: [],
    chosenExtraItemIds: [],
  });
  assert.deepEqual(lines.map((l) => l.calculationItemId), ["v1"]);
});

// ── DTO ─────────────────────────────────────────────────────────────────────

test("subscriptionDto geeft centen als integer terug, nooit als float of string", () => {
  const dto = subscriptionDto({
    id: "s1",
    companyId: "c1",
    companyKey: "websup",
    customerId: "klant-1",
    clientName: "Klant BV",
    serviceName: "Hosting & Beheer",
    priceCents: "2500" as unknown as number, // Postgres bigint komt soms als string
    vatRate: "21" as unknown as number,
    currency: "EUR",
    billingCycle: "MONTHLY",
    startDate: new Date(Date.UTC(2026, 0, 1)),
    nextBillingDate: new Date(Date.UTC(2026, 1, 1)),
    lastInvoicedAt: null,
    status: "ACTIVE",
    sourceQuoteId: null,
    sourceCalculationItemId: null,
    notes: null,
    migrationPending: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as unknown as Parameters<typeof subscriptionDto>[0]);
  assert.equal(dto.priceCents, 2500);
  assert.equal(typeof dto.priceCents, "number");
  assert.equal(dto.vatRate, 21);
  assert.equal(dto.startDate, "2026-01-01");
  assert.equal(dto.nextBillingDate, "2026-02-01");
});

// ── Gefactureerd markeren ───────────────────────────────────────────────────

function fakeDb(row: Record<string, unknown>) {
  const state = { ...row };
  return {
    state,
    subscription: {
      findFirst: async () => state,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (data.lastInvoicedAt) state.lastInvoicedAt = data.lastInvoicedAt;
        if (data.nextBillingDate) state.nextBillingDate = data.nextBillingDate;
        return { ...state, events: [] };
      },
    },
  };
}

const invoicedRow = {
  id: "s1",
  companyId: "c1",
  billingCycle: "MONTHLY",
  priceCents: 2500,
  status: "ACTIVE",
  nextBillingDate: new Date(Date.UTC(2026, 5, 1)),
  lastInvoicedAt: null as Date | null,
};

test("markSubscriptionInvoiced schuift één cyclus vooruit en zet lastInvoicedAt", async () => {
  const db = fakeDb({ ...invoicedRow });
  const result = await markSubscriptionInvoiced(
    db as never,
    "s1",
    { invoicedAt: new Date("2026-05-20T10:00:00Z") },
    ["c1"],
  );
  assert.equal(result.status, "invoiced");
  assert.equal(result.periodsAdvanced, 1);
  assert.equal(toISODate(db.state.nextBillingDate as Date), "2026-07-01");
});

test("markSubscriptionInvoiced is idempotent: een tweede call binnen de cyclus doet niets", async () => {
  const db = fakeDb({
    ...invoicedRow,
    nextBillingDate: new Date(Date.UTC(2026, 6, 1)),
    lastInvoicedAt: new Date("2026-05-20T10:00:00Z"),
  });
  const result = await markSubscriptionInvoiced(
    db as never,
    "s1",
    { invoicedAt: new Date("2026-05-21T10:00:00Z") },
    ["c1"],
  );
  assert.equal(result.status, "already_invoiced");
  assert.equal(result.periodsAdvanced, 0);
  assert.equal(toISODate(db.state.nextBillingDate as Date), "2026-07-01");
});

test("markSubscriptionInvoiced met periodsAdvanced schuift meerdere cycli", async () => {
  const db = fakeDb({ ...invoicedRow });
  const result = await markSubscriptionInvoiced(
    db as never,
    "s1",
    { invoicedAt: new Date("2026-05-20T10:00:00Z"), periodsAdvanced: 3 },
    ["c1"],
  );
  assert.equal(result.periodsAdvanced, 3);
  assert.equal(toISODate(db.state.nextBillingDate as Date), "2026-09-01");
});

test("subscriptionDraftsFromLines zet de eerste factuurdatum één cyclus vooruit", () => {
  const acceptedAt = new Date("2026-09-10T14:00:00.000Z");
  const drafts = subscriptionDraftsFromLines(
    [
      { calculationItemId: "i2", serviceName: "Hosting", priceCents: 2500, vatRatePercent: 21, billingCycle: "MONTHLY" },
      { calculationItemId: "i3", serviceName: "Domein", priceCents: 1200, vatRatePercent: 21, billingCycle: "YEARLY" },
    ],
    acceptedAt,
  );
  assert.equal(toISODate(drafts[0].startDate), "2026-09-10");
  assert.equal(toISODate(drafts[0].nextBillingDate), "2026-10-10");
  assert.equal(toISODate(drafts[1].nextBillingDate), "2027-09-10");
});
