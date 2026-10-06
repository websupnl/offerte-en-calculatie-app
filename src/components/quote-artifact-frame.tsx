/**
 * Een "artifact" is een zelfstandig stuk HTML, CSS en JS in een offerte: een
 * tijdlijn, een vergelijking, een rekenmodule. ChatGPT zet het via de MCP in een
 * contentblok van het type `html`.
 *
 * Het draait altijd in een afgeschermde iframe, omdat de inhoud niet van ons komt
 * en op de openbare klantpagina `/q/[token]` getoond wordt:
 *  - `sandbox="allow-scripts"` zonder `allow-same-origin`: de code krijgt een eigen
 *    lege origin en kan dus niet bij cookies, sessie of de pagina eromheen.
 *  - Geen formulieren, popups of navigatie van de bovenliggende pagina.
 *  - Een CSP die netwerkverkeer dichtzet (`connect-src 'none'`), zodat niets
 *    klantgegevens kan wegsturen. Alleen Google Fonts en https-afbeeldingen mogen.
 *
 * De iframe heeft een vaste hoogte. De offertepagina is A4 met `overflow: hidden`,
 * dus een blok dat meegroeit zou de pagina uitlopen. De hoogte staat in
 * `items[0].height` van het blok. Het document zelf wordt opgebouwd in
 * src/lib/artifact-document.ts.
 */

import { artifactHeight, buildArtifactDocument } from "@/lib/artifact-document";

export { ARTIFACT_DEFAULT_HEIGHT, ARTIFACT_MAX_HEIGHT, artifactHeight, buildArtifactDocument } from "@/lib/artifact-document";

export function QuoteArtifactFrame({
  html,
  items,
  title,
  accent,
}: {
  html: string;
  items?: unknown;
  title?: string | null;
  accent?: string | null;
}) {
  return (
    <iframe
      title={title || "Interactief onderdeel van de offerte"}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      loading="eager"
      scrolling="no"
      srcDoc={buildArtifactDocument(html, accent)}
      style={{ width: "100%", height: artifactHeight(items), border: 0, display: "block", background: "transparent" }}
    />
  );
}
