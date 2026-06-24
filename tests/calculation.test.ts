import assert from "node:assert/strict";
import test from "node:test";
import { calculateLine, calculateTotals } from "../src/lib/calculation";

test("calculateLine berekent omzet, inkoop, btw en winst", () => {
  assert.deepEqual(
    calculateLine({ qty: 2, unitPrice: 125, costPrice: 80, vatRate: 21 }),
    { revenueExVat: 250, costExVat: 160, vat: 52.5, profit: 90 },
  );
});

test("calculateTotals gebruikt alle regels en rondt geldbedragen af", () => {
  assert.deepEqual(
    calculateTotals([
      { qty: 1, unitPrice: 100, costPrice: 40, vatRate: 21 },
      { qty: 3, unitPrice: 12.345, costPrice: 5, vatRate: 9 },
    ]),
    {
      revenueExVat: 137.04,
      costExVat: 55,
      vat: 24.33,
      revenueIncVat: 161.37,
      profit: 82.04,
      marginPercent: 59.87,
    },
  );
});
