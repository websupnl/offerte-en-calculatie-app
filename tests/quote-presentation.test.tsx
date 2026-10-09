import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyItemCopy, applyOptionCopy, optionCopySchema, itemCopySchema, presentationSchema } from "../src/lib/quote-presentation";
import { OrderedQuotePages } from "../src/components/ordered-quote-pages";
import { validateQuotePresentation } from "../src/lib/quote-validation";
import { applyCalculationPricing } from "../src/lib/quote-with-pricing";

test("offertecorrectie verandert tekst en details, behoudt prijzen en bron", () => {
  const option = { id: "c026", t: "Growatt", d: "Brontekst", details: ["Bronregel"], price: 4200, vatRate: 21, recurringPrice: 25 };
  const commercial = { presentation: { options: { c026: { title: "Meerwerk", description: "Klanttekst", details: ["Nieuwe toelichting"] } } } };
  const result = applyOptionCopy([option], commercial)[0];
  assert.equal(result.t, "Meerwerk"); assert.equal(result.d, "Klanttekst");
  assert.deepEqual(result.details, ["Nieuwe toelichting"]);
  assert.equal(result.price, option.price); assert.equal(result.recurringPrice, option.recurringPrice); assert.equal(result.id, option.id);
  assert.equal(option.d, "Brontekst");
  assert.deepEqual(applyOptionCopy([option], { presentation: { options: {} } }), [option]);
  assert.equal(optionCopySchema.safeParse({ price: 0 }).success, false);
  assert.equal(itemCopySchema.safeParse({ qty: 0 }).success, false);
});

test("verbergen van artikeldetails behoudt de eenmalige prijs en btw", () => {
  const item = { id: "i", description: "Interne materiaalnaam", qty: 3, unitPrice: 125, vatRate: 21 };
  const result = applyItemCopy([item], { presentation: { items: { i: { hiddenOnQuote: true } } } })[0];
  assert.equal(Number(result.qty) * Number(result.unitPrice), 375);
  assert.equal(result.vatRate, 21);
  assert.equal(result.description, "Inbegrepen materialen en werkzaamheden");
  assert.equal(item.description, "Interne materiaalnaam");
});

test("basisbeschrijvingen volgen hun bron en publieke prijsblokken bevatten geen marges", () => {
  const calculation = { id: "base", number: "C001", title: "Nieuwe basistitel", description: "Actuele bronbeschrijving", role: "BASE", vatRate: 21,
    items: [{ id: "regel", description: "Materiaal", qty: 1, unitPrice: 100, costPrice: 50, vatRate: 21 }] };
  const result = applyCalculationPricing({ items: [], calculations: [calculation] });
  assert.deepEqual(result.calculationSummaries, [{ id: "base", title: "Nieuwe basistitel", description: "Actuele bronbeschrijving" }]);
  assert.equal(result.pricing?.base?.totalExVat, 100);
  assert.ok(!("internal" in result.pricing!.base!));
  assert.ok(!("calculations" in result));
});

test("pagina's worden in de echte render geordend, ook pagina's uit arrays", () => {
  const html = renderToStaticMarkup(<OrderedQuotePages order={["cover", "options", "content-0", "sign"]}>
    <section data-page="cover">Omslag</section>
    {[<section key="c" data-page="content-0">Inhoud</section>]}
    <section data-page="options">Meerwerk</section><section data-page="sign">Akkoord</section>
  </OrderedQuotePages>);
  assert.ok(html.indexOf("Omslag") < html.indexOf("Meerwerk"));
  assert.ok(html.indexOf("Meerwerk") < html.indexOf("Inhoud"));
  assert.ok(html.indexOf("Inhoud") < html.indexOf("Akkoord"));
  assert.equal(presentationSchema.safeParse({ sectionOrder: Array(8).fill("intro") }).success, false);
});

test("validatie signaleert dubbele bedragen en afwijkende calculatiekoppelingen", () => {
  const result = validateQuotePresentation({ id: "q", companyId: "ki", customerId: "k", customer: { name: "Reinier" }, title: "Installatie",
    items: [{ id: "i", description: "Batterij", qty: 1, unitPrice: 4200 }], options: [{ id: "c026", t: "Batterij", d: "Meerwerk", price: 4200 }],
    calculations: [{ id: "c026", role: "OPTION", quoteId: "anders", companyId: "ki", customerId: "k" }],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "possible-double-price"));
  assert.ok(result.issues.some((issue) => issue.code === "invalid-link"));
});
