/**
 * Eén bron van waarheid voor "wat telt mee in de cijfers".
 *
 * Regel: een concept is werkvoorraad, geen cijfer. Concepten mogen geteld worden
 * als aantal ("3 concepten"), maar nooit meetellen in een bedrag, marge of conversie —
 * een half afgemaakt concept van €30.000 hoort niet in je pijplijn te staan.
 */

/** Offertestatussen die meetellen in omzet, pijplijn, marge en conversie. */
export const COUNTED_QUOTE_STATUSES = ["SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"] as const;

/** Offertes die nog open staan en dus echt in de pijplijn zitten (concept telt niet). */
export const OPEN_QUOTE_STATUSES = ["SENT", "VIEWED"] as const;

/** Prisma where-fragment: sluit conceptoffertes uit. */
export const excludeDraftQuotes = { status: { not: "DRAFT" } } as const;

/**
 * Prisma where-fragment: sluit gearchiveerde offertes uit. Hoort in elke
 * werklijst en elk cijfer. Een gearchiveerde offerte blijft wel opvraagbaar via
 * de detailpagina en het klantportaal.
 */
export const excludeArchivedQuotes = { archivedAt: null } as const;

/** Idem voor calculaties. */
export const excludeArchivedCalculations = { archivedAt: null } as const;

/** Telt deze offertestatus mee in de cijfers? */
export function countsInStats(status: string): boolean {
  return (COUNTED_QUOTE_STATUSES as readonly string[]).includes(status);
}

/** Staat deze offerte nog open in de pijplijn? */
export function isOpenQuote(status: string): boolean {
  return (OPEN_QUOTE_STATUSES as readonly string[]).includes(status);
}
