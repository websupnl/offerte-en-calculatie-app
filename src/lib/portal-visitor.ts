/**
 * Is dit bezoek aan het klantportaal een echte klant?
 *
 * De weergaveteller en de "klant kijkt"-melding zijn er om in te schatten hoe
 * warm een klant is. Dan mag er geen eigen verkeer tussen zitten. De check op
 * "ben je ingelogd" was niet genoeg: een verzoek vanaf de eigen machine met
 * curl of een ontwikkelhulpmiddel heeft geen sessie en telde daardoor mee als
 * klant. Van de 78 geregistreerde weergaven bleken er 56 zo ontstaan.
 */

/** Adressen van de eigen machine. Een echte klant komt hier nooit vandaan. */
const EIGEN_ADRESSEN = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1", "localhost"]);

/**
 * Hulpmiddelen in plaats van browsers. Bewust smal gehouden: alleen dingen die
 * nooit een klant kunnen zijn. Zoekmachines en linkscanners staan er niet bij,
 * die halen de pagina wel op maar geven nooit akkoord.
 */
const HULPMIDDELEN = /\b(curl|wget|httpie|python-requests|node-fetch|axios|got|postman|insomnia|playwright|puppeteer|headlesschrome|claude|vercel|lighthouse)\b/i;

export function isEigenVerkeer({
  ip,
  userAgent,
}: {
  ip: string | null | undefined;
  userAgent: string | null | undefined;
}): boolean {
  const adres = ip?.trim().toLowerCase();
  if (adres && EIGEN_ADRESSEN.has(adres)) return true;

  const agent = userAgent?.trim();
  // Een leeg user-agent-veld hoort bij scripts, niet bij browsers.
  if (!agent) return true;
  return HULPMIDDELEN.test(agent);
}
