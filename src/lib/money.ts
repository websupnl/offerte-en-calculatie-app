/**
 * Geld in hele centen.
 *
 * De offerte- en calculatiekant van de app rekent in euro's als Decimal. Het
 * abonnementen- en Donna-deel rekent in hele centen als integer, zodat er nooit
 * een afrondingsfout of een "€1,34 wordt 0134"-bug ontstaat. Dit bestand is de
 * enige plek waar tussen die twee werelden geconverteerd wordt. Formatteren naar
 * een euro-string gebeurt in de UI, niet hier — op één helper na voor teksten in
 * e-mails en logregels.
 */

/** Euro (getal, string of Decimal) → hele centen. Rondt af, kapt niet af. */
export function toCents(amount: unknown): number {
  if (amount === null || amount === undefined) return 0;
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return 0;
  // + EPSILON zodat 1.005 → 101 en niet 100 (float: 1.005 * 100 = 100.4999…).
  return Math.round((value + Number.EPSILON) * 100);
}

/** Hele centen → euro als getal met twee decimalen (voor Decimal-velden). */
export function centsToEuro(cents: number): number {
  return Math.round(cents) / 100;
}

/** Optellen zonder drijvende-kommaruis: alles blijft integer. */
export function sumCents(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + Math.round(value ?? 0), 0);
}

/** btw over een bedrag in centen, afgerond op hele centen. */
export function vatCents(exVatCents: number, vatRatePercent: number): number {
  return Math.round((exVatCents * vatRatePercent) / 100);
}

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

/** "€ 1.234,56" — alleen voor e-mailteksten en logregels, niet voor de UI. */
export function formatCents(cents: number, currency = "EUR"): string {
  if (currency === "EUR") return euroFormatter.format(centsToEuro(cents));
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(
    centsToEuro(cents),
  );
}
