/**
 * Het volgende volgnummer bepalen uit een lijst bestaande nummers.
 *
 * De valkuil zit in sorteren op tekst. Er staan nog offertes uit een ouder
 * formaat in de database (`WU-2026-08-8026` naast `WU-2026-0005`). Sorteer je
 * op tekst, dan is `WU-2026-08-8026` de hoogste, blijft er na het prefix
 * `"08-8026"` over, en dat is geen getal. De vorige versie viel dan terug op 1
 * en botste met een nummer dat al bestond.
 *
 * Daarom: alleen nummers meetellen die exact het huidige formaat hebben, en
 * daarvan het hoogste getal nemen in plaats van de hoogste tekst.
 */
export function volgendVolgnummer(bestaandeNummers: string[], prefix: string): number {
  let hoogste = 0;
  for (const nummer of bestaandeNummers) {
    if (!nummer.startsWith(prefix)) continue;
    const staart = nummer.slice(prefix.length);
    // Alleen cijfers: een staart als "08-8026" hoort bij een ouder formaat en
    // zegt niets over waar de huidige reeks staat.
    if (!/^\d+$/.test(staart)) continue;
    const waarde = Number(staart);
    if (waarde > hoogste) hoogste = waarde;
  }
  return hoogste + 1;
}
