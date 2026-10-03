/** Datumvelden zijn kalenderdagen. Vergelijk ze met de huidige dag in Nederland,
 * niet met het huidige tijdstip: een factuur met vervaldatum vandaag is nog op tijd. */
export function todayDateField(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00.000Z`);
}

export function isPastDateField(date: Date | string | null | undefined, now = new Date()): boolean {
  return Boolean(date && new Date(date).getTime() < todayDateField(now).getTime());
}
