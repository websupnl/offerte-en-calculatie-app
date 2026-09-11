/**
 * Rekenen met factuurcycli. Puur — geen database, zodat het te testen is.
 *
 * Een cyclus is een aantal hele maanden: monthly = 1, quarterly = 3, yearly = 12.
 * `advanceDate` telt maanden op en zet 31 januari + 1 maand op 28/29 februari
 * (laatste dag van de maand) in plaats van door te rollen naar maart.
 */

export type BillingCycle = "MONTHLY" | "QUARTERLY" | "YEARLY";

export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  MONTHLY: "per maand",
  QUARTERLY: "per kwartaal",
  YEARLY: "per jaar",
};

/** "maand" | "kwartaal" | "jaar" (bestaande recurringInterval-strings) → cyclus. */
export function intervalToCycle(interval: string | null | undefined): BillingCycle | null {
  switch (interval) {
    case "maand":
      return "MONTHLY";
    case "kwartaal":
      return "QUARTERLY";
    case "jaar":
      return "YEARLY";
    default:
      return null;
  }
}

/** Cyclus → de bestaande recurringInterval-string voor de oude renderpaden. */
export function cycleToInterval(cycle: BillingCycle): "maand" | "kwartaal" | "jaar" {
  return cycle === "MONTHLY" ? "maand" : cycle === "QUARTERLY" ? "kwartaal" : "jaar";
}

/**
 * `date` plus `periods` cycli. Werkt op een kale datum (dag-precisie) in UTC,
 * zodat zomertijd de factuurdatum niet een dag laat verspringen.
 */
export function advanceDate(date: Date, cycle: BillingCycle, periods = 1): Date {
  const months = CYCLE_MONTHS[cycle] * periods;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Laatste dag van de doelmaand, zodat 31 → 30/28 niet doorrolt naar de maand erna.
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

/**
 * Begin van de periode die op `nextBillingDate` eindigt: `nextBillingDate` minus
 * één cyclus. Gebruikt om te bepalen of er voor de lopende periode al
 * gefactureerd is (idempotentie van /invoiced).
 */
export function periodStartFor(nextBillingDate: Date, cycle: BillingCycle): Date {
  return advanceDate(nextBillingDate, cycle, -1);
}

/**
 * Is er al gefactureerd voor de periode die op `nextBillingDate` eindigt?
 * Waar = een tweede /invoiced-aanroep binnen dezelfde cyclus mag niets doen.
 */
export function alreadyInvoicedThisPeriod(
  nextBillingDate: Date,
  cycle: BillingCycle,
  lastInvoicedAt: Date | null | undefined,
): boolean {
  if (!lastInvoicedAt) return false;
  return lastInvoicedAt.getTime() >= periodStartFor(nextBillingDate, cycle).getTime();
}

/** Kale UTC-datum zonder tijd — voor DATE-kolommen. */
export function dateOnly(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "2026-09-10" uit een Date, voor JSON naar Donna. */
export function toISODate(date: Date): string {
  return dateOnly(date).toISOString().slice(0, 10);
}
