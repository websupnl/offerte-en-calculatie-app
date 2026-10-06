import assert from "node:assert/strict";
import test from "node:test";
import { buildQuotePricing, pricingToPreviewShape, resolvePricing } from "../src/lib/quote-pricing";
import { recurringLinesFromCalculations } from "../src/lib/subscriptions/from-quote";
import { validateCalculationLinks } from "../src/lib/calculation-link";

const item = (id: string, total: number, extra: Record<string, unknown> = {}) => ({
  id, description: `Regel ${id}`, qty: 1, unitPrice: total, totalSalesPrice: total, vatRate: 21, ...extra,
});
const calc = (id: string, role: string, items: ReturnType<typeof item>[], sortOrder = 0) => ({
  id, number: id, title: `Calculatie ${id}`, role, sortOrder, vatRate: 21, items,
});

test("een meerprijs telt pas mee als de klant hem aanvinkt", () => {
  const pricing = buildQuotePricing([
    calc("basis", "BASE", [item("a", 1000)]),
    calc("batterij", "OPTION", [item("b", 4000)], 1),
  ]);
  assert.equal(pricing.base?.id, "basis");
  assert.deepEqual(pricing.addons.map((a) => a.id), ["batterij"]);
  assert.equal(pricing.variants.length, 0);

  assert.equal(resolvePricing(pricing).totalExVat, 1000);
  const gekozen = resolvePricing(pricing, { extraIds: ["batterij"] });
  assert.equal(gekozen.totalExVat, 5000);
  assert.deepEqual(gekozen.chosenAddons.map((a) => a.id), ["batterij"]);
});

test("een meerprijs verschijnt in het portaal als optie met de hele calculatie", () => {
  const shape = pricingToPreviewShape(buildQuotePricing([
    calc("basis", "BASE", [item("a", 1000)]),
    calc("batterij", "OPTION", [item("b", 4000), item("c", 15, { lineType: "RECURRING", billingCycle: "MONTHLY" })], 1),
  ]));
  const optie = shape.options.find((o) => o.id === "batterij");
  assert.ok(optie, "meerprijs ontbreekt in de opties");
  assert.equal(optie.price, 4000);
  assert.equal(optie.recurringPrice, 15);
  assert.equal(optie.recurringInterval, "maand");
  assert.equal(optie.tag, "Meerprijs");
  assert.equal(shape.items.length, 1, "de meerprijs hoort niet in de vaste regels");
});

test("abonnementen uit een meerprijs ontstaan alleen als hij gekozen is", () => {
  const calculations = [
    calc("basis", "BASE", [item("a", 1000)]),
    calc("onderhoud", "OPTION", [item("m", 25, { lineType: "RECURRING", billingCycle: "MONTHLY" })], 1),
  ];
  assert.equal(recurringLinesFromCalculations(calculations, { chosenVariantIds: [], chosenExtraItemIds: [] }).length, 0);
  assert.equal(recurringLinesFromCalculations(calculations, { chosenVariantIds: [], chosenExtraItemIds: ["onderhoud"] }).length, 1);
});

test("basis met een meerprijs mag gekoppeld worden, één losse variant niet", () => {
  const quote = { id: "q", customerId: "k", status: "DRAFT", items: [] };
  const losse = [{ id: "x", quoteId: null, customerId: "k" }];
  assert.doesNotThrow(() => validateCalculationLinks([{ id: "x", role: "OPTION" }], losse, quote, [{ id: "b", role: "BASE" }]));
  assert.throws(() => validateCalculationLinks([{ id: "x", role: "VARIANT" }], losse, quote, [{ id: "b", role: "BASE" }]), /Meerprijs/);
});
