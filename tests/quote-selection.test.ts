import assert from "node:assert/strict";
import {
  calculateQuoteSelectionTotals,
  validateQuoteSelection,
  type QuoteChoiceGroup,
  type QuoteOption,
} from "../src/lib/quote-selection";

const groups: QuoteChoiceGroup[] = [{
  id: "system",
  title: "Kies uw systeem",
  type: "SINGLE_SELECT",
  recommendedChoiceId: "premium",
  choices: [
    { id: "basic", title: "Basis", items: [{ description: "Basis", qty: 1, unitPrice: 1000, vatRate: 21, indent: 0 }] },
    { id: "premium", title: "Premium", items: [{ description: "Premium", qty: 1, unitPrice: 1500, vatRate: 21, indent: 0 }] },
  ],
}];

const options: QuoteOption[] = [{
  id: "monitoring",
  t: "Extra monitoring",
  d: "Aanvullend dashboard.",
  tag: "Optioneel",
  price: 250,
  vatRate: 21,
  details: [],
}];

const incomplete = validateQuoteSelection(groups, options, { selectedChoiceIds: {}, selectedOptionIds: [] });
assert.equal(incomplete.length, 1);

const selection = { selectedChoiceIds: { system: "premium" }, selectedOptionIds: ["monitoring"] };
assert.deepEqual(validateQuoteSelection(groups, options, selection), []);

const totals = calculateQuoteSelectionTotals(
  [{ description: "Vaste opname", qty: 1, unitPrice: 100, vatRate: 21 }],
  groups,
  options,
  selection,
);
assert.deepEqual(totals, {
  baseExVat: 100,
  choicesExVat: 1500,
  optionsExVat: 250,
  totalExVat: 1850,
  totalVat: 388.5,
  totalIncVat: 2238.5,
});

console.log("quote-selection tests passed");
