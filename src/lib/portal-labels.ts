/**
 * Labels die het klantportaal in de browser nodig heeft.
 *
 * Bewust los van `src/lib/portal.ts`: dat bestand praat met Prisma en hoort
 * alleen op de server. Zou een client-component eruit importeren, dan sleept
 * de bundler de hele database-laag de browser in.
 *
 * Klanttaal, niet mijn taal: "Nog niet opgepakt" in plaats van "Open".
 */
export const PORTAL_STATUS_LABELS: Record<string, string> = {
  OPEN: "Nog niet opgepakt",
  DOING: "Mee bezig",
  WAITING: "Wacht op jou",
  DONE: "Afgerond",
  CANCELLED: "Vervallen",
};
