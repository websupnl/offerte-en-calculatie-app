import assert from "node:assert/strict";
import { auditQuotePrices } from "../src/lib/quote-price-audit";

const now = new Date("2026-09-27T12:00:00.000Z");
const lines = auditQuotePrices({
  calculations: [{
    id: "calc-1",
    number: "KI-C001",
    items: [
      {
        type: "MATERIAL", description: "Accu", qty: 2, costPrice: 100,
        unitPrice: 125, markupPercent: 25,
        product: { active: true, costPrice: 120, priceUpdatedAt: new Date("2026-09-20") },
      },
      {
        type: "MATERIAL", description: "Oud systeem", qty: 1, costPrice: 200,
        unitPrice: 250, markupPercent: 25,
        product: { active: false, costPrice: 200, priceUpdatedAt: new Date("2026-01-01") },
      },
      {
        type: "LABOR", description: "Montage", qty: 4, costPrice: 0,
        unitPrice: 65, markupPercent: 0, product: null,
      },
    ],
  }],
  items: [{ description: "Los onderdeel", qty: 1, costPrice: null, unitPrice: 10, product: null }],
}, now);

assert.equal(lines.length, 3);
assert.deepEqual(lines[0].issues, ["changed"]);
assert.equal(lines[0].suggestedSale, 150);
assert.deepEqual(lines[1].issues, ["inactive", "stale"]);
assert.deepEqual(lines[2].issues, ["unlinked"]);
assert.equal(lines[2].suggestedSale, null);
