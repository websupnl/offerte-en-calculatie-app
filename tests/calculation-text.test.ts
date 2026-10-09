import assert from "node:assert/strict";
import test from "node:test";
import { calculationTextSchema } from "../src/lib/calculation-text";
import { buildQuotePricing, pricingToPreviewShape, resolvePricing } from "../src/lib/quote-pricing";
import { updateCalculationText } from "../src/lib/update-calculation-text";

test("tekstcorrecties accepteren losse velden maar weigeren prijsvelden en koppelingen", () => {
  assert.deepEqual(calculationTextSchema.parse({ title: " Nieuwe titel " }), { title: "Nieuwe titel" });
  assert.deepEqual(calculationTextSchema.parse({ description: null }), { description: null });
  assert.equal(calculationTextSchema.safeParse({}).success, false);
  assert.equal(calculationTextSchema.safeParse({ title: "  " }).success, false);
  for (const field of ["items", "role", "quoteId", "customerId", "unitPrice", "marginAmount"]) {
    assert.equal(calculationTextSchema.safeParse({ description: "Correctie", [field]: [] }).success, false, field);
  }
});

test("tekst-opslag schrijft alleen metadata en documentcache, met bedrijfscontrole", async () => {
  const existing = { id: "c026", companyId: "ki", quoteId: "q", title: "Oud", description: "Oud", totalCostPrice: 2500, totalSalesPrice: 4200, marginAmount: 1700, role: "OPTION", items: [{ id: "i", qty: 1, unitPrice: 4200 }] };
  const writes: { model: string; data: unknown }[] = [];
  const fake = {
    calculation: {
      findFirst: async ({ where }: { where: { id: string; companyId: string } }) => where.id === existing.id && where.companyId === existing.companyId ? existing : null,
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ model: "calculation", data }); return { ...existing, ...data }; },
    },
    quote: { update: async ({ data }: { data: unknown }) => { writes.push({ model: "quote", data }); } },
    quoteShare: { updateMany: async ({ data }: { data: unknown }) => { writes.push({ model: "quoteShare", data }); } },
  } as unknown as Parameters<typeof updateCalculationText>[0];
  const result = await updateCalculationText(fake, "c026", "ki", { description: "Nieuwe uitleg" });
  assert.deepEqual(writes, [
    { model: "calculation", data: { description: "Nieuwe uitleg" } },
    { model: "quote", data: { pdfUrl: null } },
    { model: "quoteShare", data: { portalPdfUrl: null } },
  ]);
  assert.equal(result?.totalSalesPrice, existing.totalSalesPrice);
  assert.equal(result?.marginAmount, existing.marginAmount);
  assert.equal(result?.quoteId, "q");
  assert.deepEqual(result?.items, existing.items);
  writes.length = 0;
  assert.equal(await updateCalculationText(fake, "c026", "websup", { title: "Verkeerd bedrijf" }), null);
  assert.equal(writes.length, 0);
  await assert.rejects(updateCalculationText(fake, "c026", "ki", { description: "test", items: [] }));
  assert.equal(writes.length, 0);
});

test("meerwerk neemt actuele calculatietekst over zonder bedragen of IDs te veranderen", () => {
  const calc = { id: "c026", number: "KI-2026-C026", title: "Growatt", description: "Oude uitleg", role: "OPTION", vatRate: 21,
    items: [{ id: "regel", description: "Batterij", qty: 1, unitPrice: 4200, vatRate: 21, costPrice: 2500 }] };
  const before = buildQuotePricing([calc]);
  const after = buildQuotePricing([{ ...calc, title: "AC-gekoppelde batterij", description: "Nieuwe uitleg" }]);
  const oldTotals = resolvePricing(before, { extraIds: [calc.id] });
  const newTotals = resolvePricing(after, { extraIds: [calc.id] });
  assert.equal(newTotals.totalExVat, oldTotals.totalExVat);
  assert.equal(newTotals.totalVat, oldTotals.totalVat);
  assert.equal(newTotals.totalIncVat, oldTotals.totalIncVat);
  const option = pricingToPreviewShape(after).options[0];
  assert.equal(option.id, calc.id);
  assert.equal(option.t, "AC-gekoppelde batterij");
  assert.equal(option.d, "Nieuwe uitleg");
  assert.equal(option.price, 4200);
  assert.deepEqual(after.addons[0].lines, before.addons[0].lines);
  assert.deepEqual(after.addons[0].internal, before.addons[0].internal);
});
