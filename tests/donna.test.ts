import assert from "node:assert/strict";
import test from "node:test";
import { DonnaError, parseLimit, quoteDto } from "../src/lib/donna";

test("Donna limits accept the documented range", () => {
  assert.equal(parseLimit(null, 10, 25), 10);
  assert.equal(parseLimit("25", 10, 25), 25);
  assert.throws(() => parseLimit("26", 10, 25), (error: unknown) => error instanceof DonnaError && error.code === "INVALID_QUERY");
});

test("Donna quote output uses opaque refs and normalized status", () => {
  assert.deepEqual(quoteDto({ id: "cuid", customerId: "customer-cuid", title: "Laadpaal", status: "DRAFT", totalIncVat: 121, updatedAt: new Date("2026-01-01T00:00:00.000Z") }), { ref: "cuid", customerRef: "customer-cuid", title: "Laadpaal", status: "draft", total: 121, currency: "EUR", updatedAt: "2026-01-01T00:00:00.000Z" });
});
