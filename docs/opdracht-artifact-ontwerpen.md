# Opdracht: ontwerp alle offerte-artifacts in één bestand

Dit bestand is een complete opdracht voor een ontwerpsessie. Lever één HTML-bestand op: `artifact-templates.html`. Daan geeft dat bestand terug aan de sessie die de offerte-app bouwt, die het mechanisch overneemt in de MCP-server.

Lees eerst deze bestanden in de repo, zodat je de bestaande basis ziet:

- `mcp-server/src/artifacts.ts`: de 5 bestaande sjablonen, de validator en de ontwerpgids. Dit is het formaat waar je naartoe levert.
- `src/components/quote-artifact-frame.tsx`: de afgeschermde iframe waarin alles draait, met de basis-CSS en de CSP.
- `tmp/artifact-sjablonen.png`: screenshot van de huidige 5 sjablonen. Ze zijn functioneel maar kaal. Jouw taak is ze ontwerpkwalitatief naar een veel hoger niveau te tillen en de set uit te breiden.

## 1. Waar het voor dient

Een artifact is een zelfstandig stuk HTML, CSS en JS dat als blok in een offerte komt. Het wordt getoond in drie plekken: de A4-offerte, de klantpagina en de PDF. ChatGPT vult de sjablonen in via een MCP-tool en kan er ook eigen HTML naast schrijven. Daarom moeten de sjablonen:

1. er op een A4-offerte uitzien als werk van een goed ontwerpbureau, niet als een dashboardkaart;
2. strak parametriseerbaar zijn, zodat ChatGPT ze zonder ontwerpkennis foutloos kan invullen;
3. veilig en vast van afmeting zijn, want er is geen scroll en de pagina is A4.

Twee bedrijven gebruiken dit, met eigen merk:

| | WebsUp | Koolhaas Installaties |
|---|---|---|
| `--accent` | `#f97316` (oranje) | `#247EB2` (blauw) |
| donker | `#06040c` | `#102D59` |
| toon | direct, persoonlijk, modern | betrouwbaar, technisch, rustig |
| diensten | websites, apps, maatwerk | laadpalen, zonnepanelen, thuisbatterij, EMS |

Elk sjabloon moet er goed uitzien met beide accentkleuren. Test ze allebei.

## 2. Harde technische regels

Alles hieronder is bindend. Een sjabloon dat dit overtreedt kan ik niet gebruiken.

**Omgeving**
- Draait in `<iframe sandbox="allow-scripts">` zonder `allow-same-origin`. Dus: geen cookies, geen localStorage, geen toegang tot parent.
- CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: https:; connect-src 'none'; form-action 'none'; base-uri 'none'`.
- Dus: geen `fetch`, geen externe scripts, geen iframes, geen `<form>`, geen `<object>`, `<embed>` of `<base>`. Alleen Google Fonts als externe CSS. Afbeeldingen alleen via `https:` of `data:`.
- Maximaal 60.000 tekens per sjabloon na renderen. Mik op 1.500 tot 6.000.

**Canvas**
- Ontwerp voor een vaste canvasbreedte van **673px** (A4 minus marges). Ik wikkel elk artifact zelf in een schaalwrapper voor smalle schermen, dus gebruik geen media queries en geen `vw`/`vh`.
- De hoogte is **vast** en wordt per sjabloon opgegeven (max 880px). Er is geen scroll, alles wat buiten de hoogte valt is weg. Elk sjabloon moet daarom ook met de maximale hoeveelheid invoer binnen zijn hoogte blijven (zie `maxItems` per sjabloon).
- Een A4-pagina heeft ongeveer 880px bruikbare hoogte. Kleine sjablonen (tot 300px) delen een pagina, grote krijgen er een.
- De iframe geeft al: `box-sizing: border-box`, `body` met `padding: 12px 2px 2px`, transparante achtergrond, Bricolage Grotesque (h1 tot h4) en Nunito (tekst), 16px basis. Je mag extra Google Fonts laden, maar maximaal twee families in totaal.
- CSS-variabelen die altijd bestaan: `--ink`, `--ink-soft`, `--line`, `--surface`, `--accent`, `--accent-2`, `--accent-3`, `--dark`. Gebruik die in plaats van harde kleuren, behalve voor neutrale grijzen. Leid tinten van de accentkleur af met `color-mix(in srgb, var(--accent) 12%, white)`.

**Print en PDF**
- De PDF wordt met headless Chromium gemaakt. Zet `-webkit-print-color-adjust: exact; print-color-adjust: exact` op alles met een achtergrondkleur.
- De beginstand van een interactief sjabloon moet statisch goed leesbaar zijn. Animaties mogen, maar de eindstand moet binnen 1 seconde staan en niets mag van hover afhangen.
- Geen `position: fixed`, geen `100vh`.

**Inhoud en tekst**
- Geen emoji, geen em dashes (gebruik komma, punt of dubbele punt).
- Minimaal 16px voor lopende tekst, minimaal 14px voor kleine labels. Voldoende contrast, dus geen lichtgrijs op wit.
- Standaardteksten in het Nederlands, in de je-vorm, kort en concreet. Geen marketingtaal ("naadloos", "next-level", "ontzorgen").
- Verzin nooit cijfers, reviews, certificeringen of garanties. Voorbeeldcijfers in `example` zijn herkenbaar voorbeeld en komen niet in het sjabloon zelf.
- Alle tekst uit parameters gaat door `esc()`. Geen `innerHTML` met parameters in de JS van het sjabloon.

**Esthetiek**
- Rustig en premium, geen SaaS-startuplook. Geen gradient-blobs, geen glow, geen glassmorphism, geen neon.
- Merkgevoel komt uit typografie, ritme, witruimte en spaarzaam accent. De WebsUp-gradient (`linear-gradient(135deg, #f97316, #ec4899, #a78bfa)`) mag hooguit als dunne lijn of kleine markering, niet als vlak.
- Radius 12 tot 16px op kaarten. Ruimte: 4, 8, 12, 16, 24, 32, 48px.
- Iconen zijn inline SVG, eenvoudig en consistent van lijndikte. Geen icon fonts, geen externe iconen.

## 3. Wat je oplevert

Eén bestand: `artifact-templates.html`. Het bevat twee dingen, in dit formaat, zodat ik het mechanisch kan overnemen.

### 3.1 De bibliotheek (data)

In één `<script>` blok een array `TEMPLATES`. Elk sjabloon:

```js
{
  id: "kpi-strip",                 // kebab-case, uniek
  name: "Kerncijfers",             // Nederlandse naam
  description: "…",                // 1 of 2 zinnen: wanneer gebruik je dit, wanneer niet
  category: "overzicht",           // overzicht | proces | prijs | vertrouwen | uitleg | visueel
  height: 140,                     // px, bij typische invulling
  interactive: false,              // true als er JS in zit
  brands: ["websup", "koolhaas"],  // voor wie bedoeld, of beide
  params: {                        // per parameter een zin uitleg voor ChatGPT, inclusief limieten
    items: "Lijst van {value, label, note?}. 2 tot 4 stuks. …"
  },
  maxItems: { items: 4 },          // harde limiet waarbinnen de hoogte klopt
  example: { items: [ … ] },       // volledige voorbeeldinvulling, realistisch
  render(p) { return `…`; }        // pure functie: parameters in, HTML-string uit
}
```

Regels voor `render(p)`:
- Pure functie. Geen toegang tot DOM, window of globals behalve de hulpfuncties `esc`, `num`, `list` die je bovenaan het bestand definieert (kopieer die uit `mcp-server/src/artifacts.ts`).
- Geeft een HTML-fragment terug met `<style>`, markup en eventueel `<script>`. Geen `<html>` of `<body>`.
- Klopt bij leeg of ontbrekend optioneel veld: dan verdwijnt dat onderdeel zonder gat.
- Onbekende of te lange invoer breekt het ontwerp niet: knip lijsten af op `maxItems`, en geef lange teksten een nette afkap met `line-clamp` waar dat kan.

### 3.2 De showcase (zelfde bestand)

Een nette one-pager die alle sjablonen laat zien, zodat Daan ze in één keer kan beoordelen:

- Voor elk sjabloon: naam, categorie, beschrijving en het resultaat in een echte `<iframe sandbox="allow-scripts" srcdoc="…">` met precies dezelfde CSP en basis-CSS als in productie (neem `BASE_STYLE` en `CSP` over uit `src/components/quote-artifact-frame.tsx`). De iframe is 673px breed en `height` hoog, met een stippellijn om de grens zichtbaar te maken.
- Een schakelaar bovenaan voor bedrijf (WebsUp of Koolhaas) die `--accent` en `--dark` wisselt in alle iframes.
- Een knop "Maximale invulling" die elk sjabloon opnieuw rendert met de maximale hoeveelheid invoer (`maxItems`) om te laten zien dat het binnen de hoogte blijft.
- Een knop "A4-simulatie" die een A4-vel van 794 x 1123 px toont met 2 of 3 sjablonen onder elkaar, zodat het ritme op papier te beoordelen is.
- Geen externe afhankelijkheden behalve Google Fonts. Alles inline.

## 4. Welke sjablonen

Lever **alle** onderstaande. De eerste vijf bestaan al in `mcp-server/src/artifacts.ts`: herontwerp ze volledig, behoud de `id` en de parameternamen (er zijn mogelijk al offertes mee gemaakt), en breid ze alleen uit met optionele parameters.

| # | id | Wat | Interactief |
|---|---|---|---|
| 1 | `kpi-strip` | 2 tot 4 grote kerncijfers met label en toelichting | nee |
| 2 | `timeline` | Stappen of fases met moment, titel en tekst | nee |
| 3 | `compare` | 2 of 3 uitvoeringen naast elkaar met prijs, kenmerken en een aanbevolen kolom | nee |
| 4 | `payback-calculator` | Schuif voor jaarvoordeel, toont terugverdientijd en saldo na 10 jaar | ja |
| 5 | `faq` | Uitklapbare vragen en antwoorden, werkt ook zonder JS | ja |
| 6 | `summary-hero` | "In het kort": wat ik ga doen, voor wie, totaalprijs, startmoment. Eén grote kaart, mag donker (`--dark`) | nee |
| 7 | `scope-split` | Twee kolommen: wat is inbegrepen en wat niet. Duidelijk, geen kleine lettertjes | nee |
| 8 | `process-steps` | Horizontale werkwijze in 3 tot 5 genummerde stappen met korte uitleg en pictogram | nee |
| 9 | `gantt-planning` | Balkenplanning over weken of maanden met fases, optioneel een mijlpaal | nee |
| 10 | `comparison-table` | Kenmerken (rijen) tegen 2 tot 4 uitvoeringen (kolommen), met vinkje, streepje of korte tekst per cel | nee |
| 11 | `price-breakdown` | Opbouw van de prijs als horizontale gestapelde balk met legenda en bedragen (materiaal, arbeid, overig). Alleen getallen uit de calculatie | nee |
| 12 | `energy-flow` | Schema voor Koolhaas: zon, batterij, woning, net, laadpaal als knooppunten met pijlen en vermogens. Parameter bepaalt welke knooppunten er zijn | nee |
| 13 | `savings-chart` | Staafgrafiek van cumulatief saldo over 10 tot 15 jaar met nulpunt (terugverdienmoment) gemarkeerd. Pure SVG | nee |
| 14 | `sitemap-tree` | Voor WebsUp: pagina-structuur van een website als nette boom met niveaus en pagina's | nee |
| 15 | `browser-mockup` | Voor WebsUp: een browserframe met een afbeelding (https of data URL) en adresbalk, voor ontwerpvoorbeelden | nee |
| 16 | `guarantee-row` | 3 of 4 afspraken of garanties als pictogram met titel en zin, bijvoorbeeld looptijd, reactietijd, oplevering. Alleen wat de gebruiker opgeeft | nee |
| 17 | `next-steps` | "Zo gaan we verder": 3 stappen na akkoord, met een nadrukkelijk maar rustig blok voor de eerste stap. Geen verkoopknop, dit is een offerte op papier | nee |
| 18 | `contact-card` | Persoonlijke kaart: naam, rol, telefoon, e-mail, WhatsApp, optioneel portret (https of data URL) en een korte zin | nee |
| 19 | `pull-quote` | Een citaat of kernzin groot gezet, met bron. Alleen echte tekst die de gebruiker aanlevert | nee |
| 20 | `checklist-interactive` | Voorbereiding door de klant: een afvinkbare lijst met voortgangsbalk ("3 van 5 geregeld"). Staat in de PDF in beginstand | ja |

Per sjabloon denk je na over: wat is de ene ding dat dit moet communiceren, wat is de hiërarchie, wat gebeurt er bij 2 items versus het maximum, wat bij een erg lange titel.

## 5. Kwaliteitscriteria (hierop beoordeel ik het resultaat)

- [ ] Elk sjabloon staat binnen zijn `height` bij typische én maximale invulling, bij 673px breed.
- [ ] Beide merken (WebsUp, Koolhaas) zien er goed uit zonder aanpassing van de sjablonen.
- [ ] Geen em dashes, geen emoji, geen tekst onder 14px, geen lichtgrijs op wit.
- [ ] Geen externe scripts, geen netwerkverkeer, geen `<form>`, geen iframes. (Controleer met een zoekopdracht op de regexen in `validateArtifactHtml`.)
- [ ] `render()` is pure en veilig: parameters gaan overal door `esc()`, ook in attributen.
- [ ] Lege optionele velden laten geen gaten of kapotte layout achter.
- [ ] Interactieve sjablonen hebben een goede beginstand voor print en werken met toetsenbord (label bij input, `<button>` voor acties, zichtbare focus).
- [ ] Het geheel voelt als één serie: dezelfde typografische schaal, dezelfde radius, dezelfde ruimte, dezelfde manier van accent gebruiken.
- [ ] Het voelt als een ontwerpbureau, niet als AI-slop of een SaaS-template voor een lokaal bedrijf.

## 6. Wat ik daarna doe (voor je context)

1. Ik zet `TEMPLATES` over in `mcp-server/src/artifacts.ts`.
2. Ik voeg de schaalwrapper toe aan de iframe, voor smalle schermen.
3. Ik test elk sjabloon door `validateArtifactHtml` en in een echte offerte op de klantpagina en in de PDF.
4. Ik maak ze beschikbaar via de MCP: `list_quote_artifacts`, `render_quote_artifact`, `add_quote_artifact`.

Lever daarom alleen het ene bestand en een korte lijst met beslissingen of aannames die je hebt gemaakt, bovenaan het bestand in een HTML-commentaar.
