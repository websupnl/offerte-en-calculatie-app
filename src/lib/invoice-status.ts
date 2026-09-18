/**
 * Statusregels van een verkoopfactuur.
 *
 * Een factuur die de deur uit is, is een fiscaal document: de regels en
 * bedragen liggen dan vast. Corrigeren gaat met een creditfactuur, niet door
 * de factuur aan te passen of weg te gooien. Alleen een concept is vrij.
 */

export const INVOICE_STATUSES = ["CONCEPT", "VERZONDEN", "BETAALD", "VERVALLEN"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const isInvoiceEditable = (status: string) => status === "CONCEPT";

/** Welke versie van het sjabloon: concept, openstaand, herinnering of betaald. */
export function invoiceVariant(
  invoice: { status: string; dueDate: Date | null },
  now: Date = new Date(),
): "concept" | "open" | "herinnering" | "betaald" {
  if (invoice.status === "BETAALD") return "betaald";
  if (invoice.status === "CONCEPT") return "concept";
  if (invoice.status === "VERVALLEN") return "herinnering";
  // Verzonden en de betaaldatum is voorbij: dan is het een herinnering.
  if (invoice.dueDate && endOfDay(invoice.dueDate) < now) return "herinnering";
  return "open";
}

function endOfDay(d: Date) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

/**
 * Tijdstempels bij een statuswissel. `sentAt` blijft staan als hij er al is,
 * zodat terugzetten en opnieuw versturen de eerste verzenddatum niet wist.
 */
export function statusTimestamps(
  from: string,
  to: string,
  current: { sentAt: Date | null; paidAt: Date | null },
  now: Date = new Date(),
): { sentAt?: Date | null; paidAt?: Date | null } {
  if (from === to) return {};
  const out: { sentAt?: Date | null; paidAt?: Date | null } = {};
  if (to !== "CONCEPT" && !current.sentAt) out.sentAt = now;
  if (to === "BETAALD") out.paidAt = current.paidAt ?? now;
  else if (from === "BETAALD") out.paidAt = null;
  return out;
}
