import assert from "node:assert/strict";
import {
  calculateQuoteSelectionTotals,
  getQuoteOptionPrice,
  getQuoteOptionRecurringInterval,
  getQuoteOptionRecurringPrice,
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
  recurring: { perMonthExVat: 0, perMonthIncVat: 0, perYearExVat: 0, perYearIncVat: 0 },
});

assert.equal(getQuoteOptionPrice({ price: null, tag: "€495 excl. btw" }), 495);
assert.equal(getQuoteOptionPrice({ price: null, tag: "€15 excl. btw per maand" }), null);
assert.equal(getQuoteOptionPrice({ price: null, tag: "€75 eenmalig + €5 excl. btw per maand" }), 75);
assert.equal(getQuoteOptionPrice({ price: null, tag: "Op aanvraag" }), null);
assert.equal(getQuoteOptionPrice({ price: 15, tag: "Optioneel", d: "Maandelijks opzegbaar." }), null);
assert.equal(getQuoteOptionRecurringInterval({ tag: "Optioneel", d: "Maandelijks opzegbaar." }), "per maand");
assert.equal(getQuoteOptionRecurringPrice({ price: null, tag: "€75 eenmalig + €5 excl. btw per maand" }), 5);
assert.equal(getQuoteOptionRecurringPrice({ price: 15, tag: "Optioneel", d: "Maandelijks opzegbaar." }), 15);
assert.equal(getQuoteOptionRecurringPrice({ price: 75, tag: "€75 eenmalig + €5 excl. btw per maand" }), 5);

const legacyOptionTotals = calculateQuoteSelectionTotals(
  [{ description: "Website", qty: 1, unitPrice: 1499, vatRate: 21 }],
  [],
  [{
    id: "crm",
    t: "Klantenmodule",
    d: "Aanvullende module.",
    tag: "€495 excl. btw",
    price: null,
    vatRate: 21,
    details: [],
  }],
  { selectedChoiceIds: {}, selectedOptionIds: ["crm"] },
);
assert.equal(legacyOptionTotals.totalExVat, 1994);

const recurringOptionTotals = calculateQuoteSelectionTotals(
  [{ description: "Website", qty: 1, unitPrice: 1499, vatRate: 21 }],
  [],
  [{
    id: "hosting",
    t: "Hosting en technisch beheer",
    d: "Maandelijks opzegbaar.",
    tag: "Optioneel",
    price: 15,
    vatRate: 21,
    details: [],
  }],
  { selectedChoiceIds: {}, selectedOptionIds: ["hosting"] },
);
assert.equal(recurringOptionTotals.totalExVat, 1499);

// Echte terugkerende velden: price is de eenmalige prijs, recurringPrice staat los.
const moduleWithRealFields: QuoteOption = {
  id: "onderhoud",
  t: "Technisch onderhoud",
  d: "WordPress up-to-date houden.",
  tag: "Maandelijks",
  price: 95,
  recurringPrice: 15,
  recurringInterval: "maand",
  vatRate: 21,
  defaultSelected: true,
  details: [],
};
assert.equal(getQuoteOptionPrice(moduleWithRealFields), 95);
assert.equal(getQuoteOptionRecurringPrice(moduleWithRealFields), 15);
assert.equal(getQuoteOptionRecurringInterval(moduleWithRealFields), "per maand");

const realFieldTotals = calculateQuoteSelectionTotals(
  [{ description: "Restyle", qty: 1, unitPrice: 595, vatRate: 21 }],
  [],
  [moduleWithRealFields],
  { selectedChoiceIds: {}, selectedOptionIds: ["onderhoud"] },
);
assert.equal(realFieldTotals.totalExVat, 690); // 595 + 95 eenmalig
assert.equal(realFieldTotals.recurring.perMonthExVat, 15);
assert.equal(realFieldTotals.recurring.perMonthIncVat, 18.15);
assert.equal(realFieldTotals.recurring.perYearExVat, 0);

// recurringInterval zonder recurringPrice = geen terugkerende prijs.
assert.equal(
  getQuoteOptionRecurringPrice({ price: 50, tag: "Optioneel", recurringInterval: "maand", recurringPrice: null }),
  null,
);
assert.equal(
  getQuoteOptionPrice({ price: 50, tag: "Optioneel", recurringInterval: "maand", recurringPrice: null }),
  50,
);

const requiredOption: QuoteOption = {
  id: "hosting",
  t: "Hosting",
  d: "Verplichte hosting.",
  tag: "€15 excl. btw per maand",
  price: null,
  vatRate: 21,
  required: true,
  details: [],
};
assert.equal(
  validateQuoteSelection([], [requiredOption], { selectedChoiceIds: {}, selectedOptionIds: [] })[0],
  "De verplichte optie 'Hosting' ontbreekt.",
);
assert.deepEqual(
  validateQuoteSelection([], [requiredOption], { selectedChoiceIds: {}, selectedOptionIds: ["hosting"] }),
  [],
);

console.log("quote-selection tests passed");
