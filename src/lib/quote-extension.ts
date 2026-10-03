/** Een verlenging begint pas na de huidige geldigheid als die nog in de toekomst ligt. */
export function quoteExtensionDate(now: Date, currentValidUntil: Date | null, days: number): Date {
  const base = currentValidUntil && currentValidUntil > now ? currentValidUntil : now;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}
