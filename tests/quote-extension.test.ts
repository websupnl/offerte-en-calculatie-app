import assert from "node:assert/strict";
import test from "node:test";
import { quoteExtensionDate } from "../src/lib/quote-extension";

test("verlopen offerte krijgt dagen vanaf vandaag", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const oldDate = new Date("2026-09-20T12:00:00Z");
  assert.equal(quoteExtensionDate(now, oldDate, 14).toISOString(), "2026-10-11T12:00:00.000Z");
});

test("nog geldige offerte krijgt dagen na de bestaande vervaldatum", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const oldDate = new Date("2026-10-10T12:00:00Z");
  assert.equal(quoteExtensionDate(now, oldDate, 14).toISOString(), "2026-10-24T12:00:00.000Z");
});
