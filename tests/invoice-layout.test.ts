import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenRows,
  groupInvoiceLines,
  paginateInvoice,
  shouldUseOverview,
  vatBreakdown,
  type LayoutLine,
  type SpecRow,
} from "../src/lib/invoice-layout";
import { readInvoiceSettings, missingInvoiceSettings, formatIban } from "../src/lib/invoice-company";

const line = (groupLabel: string | null, qty = 1, unitPrice = 100, unit = "st", vatRate = 21): LayoutLine => ({
  description: "Regel",
  qty,
  unit,
  unitPrice,
  vatRate,
  groupLabel,
});

test("groepeert opeenvolgende regels en telt uren alleen bij uurregels", () => {
  const groups = groupInvoiceLines([
    line("Augustus", 2, 85, "uur"),
    line("Augustus", 1.5, 85, "uur"),
    line("Abonnementen", 1, 79, "mnd"),
    line("Augustus", 1, 85, "uur"),
  ]);
  assert.equal(groups.length, 3, "een label dat later terugkomt is een nieuwe groep");
  assert.equal(groups[0].hours, 3.5);
  assert.equal(groups[0].subtotal, 297.5);
  assert.equal(groups[1].hours, null);
});

test("regels zonder label vormen een groep zonder kop", () => {
  const groups = groupInvoiceLines([line(null), line("")]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, null);
  assert.deepEqual(flattenRows(groups).map((r) => r.kind), ["line", "line"]);
});

test("btw per tarief, hoogste eerst", () => {
  const v = vatBreakdown([line(null, 1, 100, "st", 9), line(null, 2, 100, "st", 21)]);
  assert.deepEqual(v, [
    { rate: 21, base: 200, vat: 42 },
    { rate: 9, base: 100, vat: 9 },
  ]);
});

test("overzicht alleen bij veel regels in meerdere groepen", () => {
  const many = (label: string, n: number) => Array.from({ length: n }, () => line(label));
  assert.equal(shouldUseOverview(groupInvoiceLines([...many("A", 8), ...many("B", 7)])), true);
  assert.equal(shouldUseOverview(groupInvoiceLines(many("A", 30))), false);
  assert.equal(shouldUseOverview(groupInvoiceLines([...many("A", 5), ...many("B", 5)])), false);
});

// Hulpje: bouw rijen met vaste hoogtes (kop 20, regel 10).
function setup(counts: number[]) {
  const groups = groupInvoiceLines(counts.flatMap((n, gi) => Array.from({ length: n }, () => line(`G${gi}`))));
  const rows = flattenRows(groups);
  return {
    rows,
    heights: rows.map((r) => (r.kind === "group" ? 20 : 10)),
    contHeight: 20,
    labeled: groups.map((g) => !!g.label),
  };
}
const describe = (pages: SpecRow[][]) =>
  pages.map((p) => p.map((r) => (r.kind === "group" ? (r.cont ? "C" : "G") : "l")).join(""));

test("alles past op pagina 1", () => {
  const pages = paginateInvoice({ ...setup([3]), firstCapacity: 200, nextCapacity: 300, tailHeight: 40 });
  assert.deepEqual(describe(pages), ["Glll"]);
});

test("doorlopende groep krijgt een vervolgkop", () => {
  // Pagina 1: kop(20) + 5 regels(50) = 70 van 75.
  const pages = paginateInvoice({ ...setup([8]), firstCapacity: 75, nextCapacity: 300, tailHeight: 40 });
  assert.deepEqual(describe(pages), ["Glllll", "Clll"]);
});

test("een groepskop blijft niet los onderaan staan", () => {
  // Na groep 0 (kop + 2 regels = 40) past kop G1 (20) nog wel, maar kop + eerste regel (30) niet.
  const pages = paginateInvoice({ ...setup([2, 2]), firstCapacity: 65, nextCapacity: 300, tailHeight: 10 });
  assert.deepEqual(describe(pages), ["Gll", "Gll"]);
});

test("totalen gaan samen met de laatste regel naar een nieuwe pagina", () => {
  // Alle 4 regels passen (60 van 60), de totalen (40) niet meer.
  const pages = paginateInvoice({ ...setup([4]), firstCapacity: 60, nextCapacity: 300, tailHeight: 40 });
  assert.deepEqual(describe(pages), ["Glll", "Cl"]);
});

test("losse kop gaat mee als de laatste regel verhuist", () => {
  // G0 + 2 regels (40), G1 + 1 regel (30) = 70 van 70; totalen passen niet.
  const pages = paginateInvoice({ ...setup([2, 1]), firstCapacity: 70, nextCapacity: 300, tailHeight: 40 });
  assert.deepEqual(describe(pages), ["Gll", "Gl"]);
});

test("met overzicht begint de specificatie op pagina 2", () => {
  const pages = paginateInvoice({ ...setup([2, 2]), firstCapacity: 0, nextCapacity: 300, tailHeight: 40 });
  assert.deepEqual(describe(pages), ["", "GllGll"]);
});

test("factuurinstellingen: standaarden en wat er ontbreekt", () => {
  const s = readInvoiceSettings({ invoice: { iban: " nl91abna0417164300 ", paymentTermDays: "30" } });
  assert.equal(s.kvk, "95524061");
  assert.equal(s.paymentTermDays, 30);
  assert.deepEqual(missingInvoiceSettings(s), ["adres", "postcode", "plaats", "btw-id"]);
  assert.equal(formatIban(s.iban), "NL91 ABNA 0417 1643 00");
  assert.equal(readInvoiceSettings(null).paymentTermDays, 14);
});

test("vervolgregel telt voor de regels, niet voor de totalen op de laatste pagina", () => {
  // Kop + 3 regels = 50. Met 10 reserve voor "Vervolg" passen ze in 60; de totalen (10) passen in 60 zonder die reserve.
  const pages = paginateInvoice({ ...setup([3]), firstCapacity: 60, nextCapacity: 300, tailHeight: 10, continueNoteHeight: 10 });
  assert.deepEqual(describe(pages), ["Glll"]);
  // Een vierde regel past niet meer naast de reserve en gaat door naar pagina 2.
  const four = paginateInvoice({ ...setup([4]), firstCapacity: 60, nextCapacity: 300, tailHeight: 10, continueNoteHeight: 10 });
  assert.deepEqual(describe(four), ["Glll", "Cl"]);
});
