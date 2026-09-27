import assert from "node:assert/strict";
import test from "node:test";
import { isPastDateField, todayDateField } from "../src/lib/business-date";

test("vervaldatum blijft de hele Nederlandse kalenderdag geldig", () => {
  const now = new Date("2026-09-27T12:00:00.000Z");
  assert.equal(isPastDateField("2026-09-26T18:00:00.000Z", now), true);
  assert.equal(isPastDateField("2026-09-27T00:00:00.000Z", now), false);
  assert.equal(isPastDateField("2026-09-28T00:00:00.000Z", now), false);
});

test("daggrens volgt Amsterdamse tijd, ook bij zomertijd", () => {
  assert.equal(todayDateField(new Date("2026-09-27T21:59:00.000Z")).toISOString(), "2026-09-27T00:00:00.000Z");
  assert.equal(todayDateField(new Date("2026-09-27T22:01:00.000Z")).toISOString(), "2026-09-28T00:00:00.000Z");
  assert.equal(todayDateField(new Date("2026-01-01T23:01:00.000Z")).toISOString(), "2026-01-02T00:00:00.000Z");
});
