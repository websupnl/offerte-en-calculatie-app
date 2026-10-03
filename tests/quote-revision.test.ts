import assert from "node:assert/strict";
import { remapChoiceCalculationIds } from "../src/lib/quote-revision";

const original = [{ id: "system", choices: [
  { id: "old", calculationId: "calc-old", items: [] },
  { id: "external", calculationId: "calc-external", items: [] },
] }];
const result = remapChoiceCalculationIds(original, new Map([["calc-old", "calc-new"]])) as typeof original;
assert.equal(result[0].choices[0].calculationId, "calc-new");
assert.equal(result[0].choices[1].calculationId, "calc-external");
assert.equal(original[0].choices[0].calculationId, "calc-old");
