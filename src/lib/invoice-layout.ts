/**
 * Opbouw van een factuur-PDF, los van React zodat het testbaar is.
 *
 * De factuur wordt als HTML-pagina gerenderd en door headless Chromium naar PDF
 * omgezet, net als de offerte. Chromium breekt een tabel zelf wel af, maar niet
 * zoals we willen: geen herhaalde groepskop met "vervolg", geen totalen die bij
 * de laatste regel blijven, geen overzicht op pagina 1. Daarom meet de pagina
 * elke regel en verdeelt `paginateInvoice` ze over vaste A4-pagina's.
 */

export type LayoutLine = {
  description: string;
  detail?: string | null;
  qty: number;
  unit?: string | null;
  unitPrice: number;
  vatRate: number;
  groupLabel?: string | null;
};

export type InvoiceGroup = {
  /** null = regels zonder groepskop */
  label: string | null;
  lines: LayoutLine[];
  subtotal: number;
  /** Som van de uren als alle regels in uren zijn, anders null. */
  hours: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const lineAmount = (l: LayoutLine) => round2(l.qty * l.unitPrice);

const isHourUnit = (unit?: string | null) => /^(uur|uren|u)$/i.test((unit ?? "").trim());

/**
 * Opeenvolgende regels met hetzelfde groepslabel vormen een groep. De volgorde
 * van de regels blijft leidend: komt een label later terug, dan is dat een
 * nieuwe groep, want de factuur toont ze ook in die volgorde.
 */
export function groupInvoiceLines(lines: LayoutLine[]): InvoiceGroup[] {
  const groups: InvoiceGroup[] = [];
  for (const line of lines) {
    const label = line.groupLabel?.trim() || null;
    const last = groups.at(-1);
    if (last && last.label === label) last.lines.push(line);
    else groups.push({ label, lines: [line], subtotal: 0, hours: null });
  }
  for (const g of groups) {
    g.subtotal = round2(g.lines.reduce((sum, l) => sum + lineAmount(l), 0));
    g.hours = g.lines.every((l) => isHourUnit(l.unit))
      ? round2(g.lines.reduce((sum, l) => sum + l.qty, 0))
      : null;
  }
  return groups;
}

export type VatLine = { rate: number; base: number; vat: number };

/** Btw per tarief, voor de specificatie onder de totalen. Hoogste tarief eerst. */
export function vatBreakdown(lines: LayoutLine[]): VatLine[] {
  const map = new Map<number, number>();
  for (const l of lines) map.set(l.vatRate, (map.get(l.vatRate) ?? 0) + l.qty * l.unitPrice);
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base: round2(base), vat: round2(base * (rate / 100)) }));
}

/**
 * Bij een lange factuur met meerdere groepen staat op pagina 1 een overzicht
 * per groep. De klant ziet dan het totaal en de opbouw zonder dertig regels te
 * lezen; wie alles wil nalopen slaat de pagina om.
 */
export const OVERVIEW_MIN_LINES = 15;

export function shouldUseOverview(groups: InvoiceGroup[]): boolean {
  const lineCount = groups.reduce((n, g) => n + g.lines.length, 0);
  return lineCount >= OVERVIEW_MIN_LINES && groups.filter((g) => g.label).length >= 2;
}

export type SpecRow =
  | { kind: "group"; group: number; cont: boolean }
  | { kind: "line"; group: number; line: number };

/** Groepen platslaan tot tabelrijen. Een groep zonder label krijgt geen kop. */
export function flattenRows(groups: InvoiceGroup[]): SpecRow[] {
  const rows: SpecRow[] = [];
  groups.forEach((g, gi) => {
    if (g.label) rows.push({ kind: "group", group: gi, cont: false });
    g.lines.forEach((_, li) => rows.push({ kind: "line", group: gi, line: li }));
  });
  return rows;
}

export type PaginateInput = {
  rows: SpecRow[];
  /** Hoogte van elke rij in `rows`, zelfde volgorde. */
  heights: number[];
  /** Hoogte van een herhaalde groepskop ("Augustus 2026 vervolg"). */
  contHeight: number;
  /** Ruimte voor de tabel op pagina 1. 0 = pagina 1 heeft geen tabel (overzicht). */
  firstCapacity: number;
  /** Ruimte voor de tabel op elke vervolgpagina. */
  nextCapacity: number;
  /** Totalen plus afsluitende zin: moeten onder de laatste regel passen. */
  tailHeight: number;
  /** Welke groepen een kop hebben; alleen die krijgen een "vervolg"-kop. */
  labeled: boolean[];
  /**
   * Ruimte onderaan voor "Vervolg op de volgende pagina". Die regel staat op
   * elke pagina behalve de laatste, dus regels houden er rekening mee en de
   * totalen (die altijd op de laatste pagina staan) niet.
   */
  continueNoteHeight?: number;
};

/**
 * Verdeel de rijen over pagina's. Regels:
 * - een groepskop staat nooit los onderaan een pagina, hij gaat mee met zijn eerste regel;
 * - loopt een groep door naar de volgende pagina, dan komt de kop terug met "vervolg";
 * - de totalen staan nooit alleen op een pagina: past het niet, dan gaat de
 *   laatste regel mee naar de nieuwe pagina.
 */
export function paginateInvoice(input: PaginateInput): SpecRow[][] {
  const { rows, heights, contHeight, firstCapacity, nextCapacity, tailHeight, labeled } = input;
  const note = input.continueNoteHeight ?? 0;
  const pages: SpecRow[][] = [[]];
  let used = 0;
  let cap = firstCapacity;

  const current = () => pages[pages.length - 1];
  const newPage = () => {
    pages.push([]);
    used = 0;
    cap = nextCapacity;
  };
  const heightOf = (row: SpecRow, index: number) => (row.kind === "group" && row.cont ? contHeight : heights[index]);

  rows.forEach((row, i) => {
    let need = heights[i];
    const next = rows[i + 1];
    if (row.kind === "group" && next?.kind === "line") need += heights[i + 1];

    // Een lege pagina breken we niet af, behalve pagina 1 als daar geen of
    // weinig ruimte is (overzicht): dan begint de specificatie op pagina 2.
    const mayBreak = current().length > 0 || cap < nextCapacity;
    if (used + need > cap - note && mayBreak) {
      newPage();
      if (row.kind === "line" && labeled[row.group]) {
        current().push({ kind: "group", group: row.group, cont: true });
        used += contHeight;
      }
    }
    current().push(row);
    used += heightOf(row, i);
  });

  if (used + tailHeight > cap) {
    const page = current();
    const lastLineAt = page.map((r) => r.kind).lastIndexOf("line");
    if (lastLineAt === -1) {
      newPage();
    } else {
      const [line] = page.splice(lastLineAt, 1) as [Extract<SpecRow, { kind: "line" }>];
      // Blijft er een kop over zonder regel eronder, dan gaat die mee.
      const orphan = page.at(-1)?.kind === "group" ? page.pop() : undefined;
      if (page.length === 0 && pages.length > 1) pages.pop();
      newPage();
      if (orphan) current().push(orphan);
      else if (labeled[line.group]) current().push({ kind: "group", group: line.group, cont: true });
      current().push(line);
    }
  }

  return pages;
}
