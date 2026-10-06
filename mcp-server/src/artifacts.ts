/**
 * Artifact-bibliotheek voor offertes.
 *
 * Een artifact is een zelfstandig stuk HTML, CSS en JS dat als blok van het type
 * `html` in een offerte komt. De app toont het in een afgeschermde iframe
 * (src/lib/artifact-document.ts). Die iframe levert per bedrijf de merktokens,
 * de fonts en een klein ontwerpsysteem (.card, .card-dark, .eyebrow, .display,
 * .num, .chip, .icon, .grad-text). Sjablonen gebruiken alleen die tokens en
 * klassen, dus hetzelfde sjabloon kleurt mee met WebsUp of Koolhaas.
 *
 * ChatGPT kan:
 *   1. een sjabloon kiezen en invullen (render_quote_artifact), of
 *   2. zelf HTML schrijven volgens ARTIFACT_DESIGN_GUIDE en dat opslaan.
 *
 * Elk sjabloon geeft een schone HTML-string terug. Teksten gaan altijd door esc(),
 * dus invoer van buiten kan nooit extra markup of script toevoegen.
 */

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Item = Record<string, unknown>;
const list = (value: unknown): Item[] =>
  Array.isArray(value) ? (value as Item[]).filter((entry) => entry && typeof entry === "object") : [];
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
const num = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const has = (value: unknown) =>
  typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;

export type ArtifactCategory = "overzicht" | "proces" | "prijs" | "vertrouwen" | "uitleg" | "visueel";

export type ArtifactTemplate = {
  id: string;
  name: string;
  description: string;
  category: ArtifactCategory;
  /** Hoogte in pixels bij een typische invulling. */
  height: number;
  /** Hoogte voor precies deze invulling. Gaat voor `height` waar het bestaat. */
  heightFor?: (params: Record<string, unknown>) => number;
  interactive: boolean;
  brands: ("websup" | "koolhaas")[];
  /** Uitleg per parameter, zodat ChatGPT weet wat er ingevuld moet worden. */
  params: Record<string, string>;
  /** Harde limiet per lijst. Daarboven wordt afgeknipt. */
  maxItems: Record<string, number>;
  example: Record<string, unknown>;
  render: (params: Record<string, unknown>) => string;
};

/* ------------------------------------------------------------------------ */
/* Iconen: eenvoudige lijniconen op een 24px raster, lijndikte 1.75.         */
/* Alleen namen uit deze lijst worden getekend; al het andere valt weg.      */
/* ------------------------------------------------------------------------ */

const ICON_PATHS: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3M6.5 10.5v3M10 10.5v3M13.5 10.5v3"/>',
  charger: '<path d="M5 21V5.5A2.5 2.5 0 0 1 7.5 3h5A2.5 2.5 0 0 1 15 5.5V21M3 21h14M15 9h1.5a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8.5L19 6"/><path d="m10.5 7-2 4h3l-2 4"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/><path d="M10 21v-6h4v6"/>',
  grid: '<path d="M12 2.5 7 21.5M12 2.5l5 19M5.5 7.5h13M6.6 13h10.8M8.6 13l6.4 8.5M15.4 13 9 21.5"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8z"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.7 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.8 7.5-9.5V6L12 3z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  wrench: '<path d="M14.5 4.2a5 5 0 0 0-4.3 6.7L3.5 17.6v2.9h2.9l6.7-6.7a5 5 0 0 0 6.7-4.3l-3 1.2-2.6-2.6 1.3-3.9z"/>',
  chat: '<path d="M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z"/>',
  phone: '<path d="M5 3.5h3.5l2 5-2.5 1.5a11 11 0 0 0 6 6l1.5-2.5 5 2V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  euro: '<path d="M18 6.3A7.5 7.5 0 1 0 18 17.7"/><path d="M4 10h9.5M4 14h9.5"/>',
  chart: '<path d="M3.5 20.5h17M7 20.5V14M12 20.5V8M17 20.5V4"/>',
  leaf: '<path d="M5 19.5C5 10 11 4.5 20 4.5c0 9.5-5.5 15-15 15z"/><path d="m5 19.5 8-8"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4.5l-4 15"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9.5 9v11"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14a6.5 6.5 0 0 1 4 6"/>',
  document: '<path d="M6.5 3h8l4 4v14h-12z"/><path d="M14.5 3v4h4M9.5 12.5h6M9.5 16.5h6"/>',
  gauge: '<path d="M3.5 16.5a8.5 8.5 0 1 1 17 0"/><path d="m12 16.5 4-5"/>',
  refresh: '<path d="M20 11A8 8 0 0 0 5.6 7.5M4 4v4h4M4 13a8 8 0 0 0 14.4 3.5M20 20v-4h-4"/>',
  smartphone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
};
export const ARTIFACT_ICON_NAMES = Object.keys(ICON_PATHS);

const icon = (name: unknown, size = 20) => {
  const paths = typeof name === "string" ? ICON_PATHS[name] : undefined;
  return paths
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
    : "";
};

/** Zet een deel van een titel in het merkverloop. Beide delen gaan door esc(). */
const highlight = (title: unknown, phrase: unknown) => {
  const text = String(title ?? "");
  const part = typeof phrase === "string" ? phrase.trim() : "";
  const at = part ? text.indexOf(part) : -1;
  if (at < 0) return esc(text);
  return `${esc(text.slice(0, at))}<span class="grad-text">${esc(part)}</span>${esc(text.slice(at + part.length))}`;
};

/** "10,8 kWp" wordt een groot cijfer met kleine eenheid, "€ 12.450" een klein euroteken met groot cijfer. */
const splitValue = (value: unknown) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(€\s?)?([+\-−]?\d[\d.,]*)\s*(.*)$/);
  if (!match) return `<span class="v-main">${esc(raw)}</span>`;
  const [, prefix, figure, unit] = match;
  return `${prefix ? `<span class="v-unit v-pre">€</span>` : ""}<span class="v-main">${esc(figure)}</span>${unit ? `<span class="v-unit">${esc(unit)}</span>` : ""}`;
};

// Gedeeld door alle sjablonen: kop met eyebrow en titel.
const HEAD_CSS = `.hd{display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-bottom:22px}.hd-title{max-width:600px}`;
const header = (eyebrow: unknown, title: unknown, titleHighlight?: unknown, size = 26) =>
  has(eyebrow) || has(title)
    ? `<header class="hd">${has(eyebrow) ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}${has(title) ? `<h3 class="display hd-title clamp-2" style="font-size:${size}px">${highlight(title, titleHighlight)}</h3>` : ""}</header>`
    : "";
const headerHeight = (p: Item, size = 26) =>
  (has(p.eyebrow) ? 32 : 0) + (has(p.title) ? Math.ceil(size * 1.1) + (has(p.eyebrow) ? 10 : 0) : 0) + (has(p.eyebrow) || has(p.title) ? 22 : 0);

/** Bodypadding van de iframe (12 boven, 2 onder) plus een kleine marge. */
const fit = (value: number) => Math.min(880, Math.ceil(value + 20));

/* ------------------------------------------------------------------------ */

export const ARTIFACT_TEMPLATES: ArtifactTemplate[] = [
  /* ---------------------------------------------------------------------- */
  {
    id: "summary-hero",
    name: "In het kort",
    description:
      "Grote donkere openingskaart: wat je gaat doen, voor wie, de investering en het startmoment. Eén keer per offerte, bovenaan de eerste inhoudspagina. Niet gebruiken als de prijs nog niet vaststaat.",
    category: "overzicht",
    height: 376,
    interactive: false,
    brands: ["websup", "koolhaas"],
    params: {
      eyebrow: "Klein label bovenaan. Standaard 'In het kort'.",
      client: "Optioneel. Naam van de klant of het bedrijf, verschijnt als 'Voor ...' rechtsboven. Max 32 tekens.",
      title: "Kern van het voorstel in één zin, max 70 tekens. Bijvoorbeeld 'Een website die aanvragen oplevert'.",
      highlight: "Optioneel. Een stuk letterlijk uit title dat in het merkverloop komt, bijvoorbeeld 'aanvragen oplevert'.",
      text: "Eén of twee zinnen toelichting, max 200 tekens.",
      price: "Investering als tekst uit de calculatie, bijvoorbeeld '€ 12.450'. Leeg = geen prijsblok.",
      priceNote: "Optioneel. Bijvoorbeeld 'excl. btw, eenmalig'.",
      facts: "Lijst van {label, value}. 1 tot 3 stuks, bijvoorbeeld {label: 'Start', value: 'Week 46'}. value max 18 tekens.",
    },
    maxItems: { facts: 3 },
    example: {
      client: "Bakkerij Hofstra",
      title: "Een website die bestellingen oplevert in plaats van vragen",
      highlight: "bestellingen oplevert",
      text: "Ik bouw een snelle site met een bestelmodule voor taarten en catering. Bestellingen komen binnen met datum, ophaaltijd en betaling geregeld.",
      price: "€ 6.850",
      priceNote: "excl. btw, eenmalig",
      facts: [
        { label: "Start", value: "Week 46" },
        { label: "Live", value: "Half januari" },
      ],
    },
    heightFor: () => 376,
    render: (p) => {
      const facts = list(p.facts).slice(0, 3);
      const showFoot = has(p.price) || facts.length > 0;
      const columns = `${has(p.price) ? "1.4fr " : ""}${facts.map(() => "1fr").join(" ")}`;
      return `<style>
.hero{height:356px;padding:30px 34px 28px;display:flex;flex-direction:column}
.hero>*{flex-shrink:0}
.hero .top{display:flex;justify-content:space-between;align-items:center;gap:16px}
.hero .for{font-size:15px;color:var(--on-dark-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
.hero .for b{color:var(--on-dark);font-weight:600}
.hero h2{margin-top:22px;font-size:34px;max-width:590px}
.hero .lead{margin-top:12px;font-size:16px;line-height:1.6;color:var(--on-dark-muted);max-width:560px}
.foot{margin-top:auto;display:grid;grid-template-columns:${columns || "1fr"};border-top:1px solid var(--on-dark-line);padding-top:18px}
.foot>div{padding:0 20px;border-left:1px solid var(--on-dark-line);min-width:0}
.foot>div:first-child{padding-left:0;border-left:0}
.lbl{display:block;font-size:14px;color:var(--on-dark-muted);margin-bottom:6px}
.price .num{display:flex;align-items:baseline;gap:6px;font-size:34px}
.price .v-unit{font-size:20px;opacity:.75}
.price small{display:block;margin-top:6px;font-size:14px;color:var(--on-dark-muted)}
.fact b{display:block;font-family:var(--font-head);font-weight:var(--title-weight);font-size:20px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style>
<section class="card-dark topline hero">
  <div class="top"><span class="eyebrow">${esc(has(p.eyebrow) ? p.eyebrow : "In het kort")}</span>${has(p.client) ? `<span class="for">Voor <b>${esc(p.client)}</b></span>` : ""}</div>
  <h2 class="display clamp-2">${highlight(p.title, p.highlight)}</h2>
  ${has(p.text) ? `<p class="lead clamp-2">${esc(p.text)}</p>` : ""}
  ${showFoot ? `<div class="foot">${has(p.price) ? `<div class="price"><span class="lbl">Investering</span><span class="num">${splitValue(p.price)}</span>${has(p.priceNote) ? `<small>${esc(p.priceNote)}</small>` : ""}</div>` : ""}${facts.map((f) => `<div class="fact"><span class="lbl">${esc(f.label)}</span><b>${esc(f.value)}</b></div>`).join("")}</div>` : ""}
</section>`;
    },
  },

  /* ---------------------------------------------------------------------- */
  {
    id: "kpi-strip",
    name: "Kerncijfers",
    description:
      "Twee tot vier grote cijfers in één strook, met eenheid, label en toelichting. Voor het snelle overzicht: vermogen, opslag, laadtijd, aantal pagina's. Alleen cijfers uit de calculatie of de opname.",
    category: "overzicht",
    height: 210,
    interactive: false,
    brands: ["websup", "koolhaas"],
    params: {
      items: `Lijst van {value, label, note?, icon?}. 2 tot 4 stuks. value is het cijfer met eenheid ('10,8 kWp', '€ 1.250', '24'). label max 24 tekens, note max 40 tekens. icon optioneel, een van: ${Object.keys(ICON_PATHS).join(", ")}.`,
      variant: "Optioneel. 'light' (standaard) of 'dark' voor een donkere strook.",
    },
    maxItems: { items: 4 },
    example: {
      items: [
        { value: "10,8 kWp", label: "Zonnepanelen", note: "24 panelen op het zuiden", icon: "sun" },
        { value: "15 kWh", label: "Thuisbatterij", note: "Drie modules", icon: "battery" },
        { value: "11 kW", label: "Laadpaal", note: "Laadt op eigen stroom", icon: "charger" },
      ],
    },
    heightFor: (p) => {
      const items = list(p.items).slice(0, 4);
      return fit(118 + (items.some((i) => icon(i.icon)) ? 52 : 0) + (items.some((i) => has(i.note)) ? 22 : 0));
    },
    render: (p) => {
      const items = list(p.items).slice(0, 4);
      const dark = p.variant === "dark";
      const anyIcon = items.some((i) => icon(i.icon));
      const four = items.length > 3;
      return `<style>
.kpis{display:grid;grid-template-columns:repeat(${Math.max(items.length, 1)},minmax(0,1fr));border-radius:var(--r-lg);overflow:hidden}
.kpis.light{background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow)}
.kpi{position:relative;min-width:0;padding:22px ${four ? 18 : 24}px 20px}
.kpi+.kpi::before{content:"";position:absolute;left:0;top:22px;bottom:22px;width:1px;background:var(--line)}
.card-dark .kpi+.kpi::before{background:var(--on-dark-line)}
.kpi .icon{width:36px;height:36px;margin-bottom:16px}
.kpi .num{display:flex;align-items:baseline;gap:5px;font-size:${four ? 32 : 38}px;white-space:nowrap}
.kpi .v-unit{font-size:${four ? 16 : 18}px;font-weight:600;letter-spacing:-.01em;color:var(--muted)}
.card-dark .kpi .v-unit{color:var(--on-dark-muted)}
.kpi .lb{display:block;margin-top:10px;font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi small{display:block;margin-top:2px;font-size:14px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-dark .kpi small{color:var(--on-dark-muted)}
</style>
<div class="kpis ${dark ? "card-dark topline" : "light"}">${items
        .map((i) => {
          const glyph = icon(i.icon, 18);
          const iconCell = anyIcon ? `<span class="icon"${glyph ? "" : ' style="visibility:hidden"'}>${glyph}</span>` : "";
          return `<div class="kpi">${iconCell}<div class="num">${splitValue(i.value)}</div><span class="lb">${esc(i.label)}</span>${has(i.note) ? `<small>${esc(i.note)}</small>` : ""}</div>`;
        })
        .join("")}</div>`;
    },
  },

  /* ---------------------------------------------------------------------- */
  {
    id: "compare",
    name: "Vergelijking",
    description:
      "Twee of drie uitvoeringen naast elkaar met prijs, korte typering en kenmerken. De aanbevolen kolom wordt de donkere hoofdkaart. Alleen tonen: de klant kiest nog steeds in de keuzeblokken van de offerte. Prijzen letterlijk uit de calculaties.",
    category: "prijs",
    height: 450,
    interactive: false,
    brands: ["websup", "koolhaas"],
    params: {
      items: "Lijst van {name, price, priceNote?, tagline?, recommended?, points[]}. 2 of 3 stuks. name max 22 tekens. price als tekst uit de calculatie ('€ 12.450'). tagline max 70 tekens. points: max 6 korte kenmerken van max 40 tekens. recommended op true bij hooguit één kolom.",
      recommendLabel: "Optioneel. Tekst op het label van de aanbevolen kolom. Standaard 'Mijn advies'.",
    },
    maxItems: { items: 3, points: 6 },
    example: {
      items: [
        { name: "Basis", price: "€ 8.950", priceNote: "incl. btw", tagline: "Alleen zonnepanelen, later uit te breiden met een batterij.", points: ["8 panelen, 3,6 kWp", "Omvormer met app", "Montage en aanmelding"] },
        { name: "Comfort", price: "€ 12.450", priceNote: "incl. btw", tagline: "Panelen en batterij op één slimme omvormer.", recommended: true, points: ["12 panelen, 5,4 kWp", "Thuisbatterij 5 kWh", "Hybride omvormer", "Slim laden via de app"] },
      ],
    },
    heightFor: (p) => {
      const items = list(p.items).slice(0, 3);
      const three = items.length > 2;
      const perLine = three ? 16 : 30;
      const pointsHeight = Math.max(
        0,
        ...items.map((i) => {
          const pts = strings(i.points).slice(0, 6);
          return pts.reduce((sum, pt) => sum + Math.min(2, Math.ceil(pt.length / perLine)) * 22.4, 0) + Math.max(0, pts.length - 1) * 10;
        }),
      );
      const slot = three && items.some((i) => i.recommended === true) ? 36 : 0;
      return fit(244 + slot - (items.some((i) => has(i.tagline)) ? 0 : 52) + pointsHeight);
    },
    render: (p) => {
      const items = list(p.items).slice(0, 3);
      const recLabel = has(p.recommendLabel) ? p.recommendLabel : "Mijn advies";
      const anyRec = items.some((i) => i.recommended === true);
      const three = items.length > 2;
      const anyTagline = items.some((i) => has(i.tagline));
      return `<style>
.cmp{display:grid;grid-template-columns:repeat(${Math.max(items.length, 1)},minmax(0,1fr));gap:14px;align-items:stretch}
.col{position:relative;padding:26px ${three ? 20 : 26}px 24px;display:flex;flex-direction:column}
.col.card{box-shadow:none}
.badge{position:absolute;top:22px;right:${three ? 16 : 22}px;display:inline-flex;align-items:center;gap:6px;padding:4px 12px 4px 10px;border-radius:999px;background:var(--fill);color:#fff;font-size:14px;font-weight:600}
.rec h4{padding-right:${three ? 0 : 130}px}
${three ? ".rec .badge,.slot{position:static;align-self:flex-start;height:29px;margin:-6px 0 13px}" : ""}
.badge svg{width:14px;height:14px;stroke-width:2.4}
.col h4{font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tag{margin-top:6px;font-size:16px;line-height:1.45;color:var(--muted);height:46px}
.card-dark .tag,.card-dark .pn{color:var(--on-dark-muted)}
.pr{margin-top:18px;display:flex;align-items:baseline;gap:5px;font-size:${three ? 30 : 36}px;white-space:nowrap}
.pr .v-unit{font-size:${three ? 18 : 20}px;opacity:.75}
.pn{margin-top:6px;font-size:14px;color:var(--muted);min-height:21px}
.pts{list-style:none;margin:18px 0 0;padding:16px 0 0;border-top:1px solid var(--line);display:grid;gap:10px}
.card-dark .pts{border-color:var(--on-dark-line)}
.pts li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;font-size:16px;line-height:1.4}
.ck{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--accent-soft);color:var(--accent-ink)}
.card-dark .ck{background:rgba(255,255,255,.1);color:var(--on-dark-accent)}
.ck svg{width:13px;height:13px;stroke-width:2.6}
</style>
<div class="cmp">${items
        .map((i) => {
          const rec = i.recommended === true;
          const points = strings(i.points).slice(0, 6);
          return `<article class="col ${rec ? "card-dark topline rec" : "card"}">${rec ? `<span class="badge">${icon("check", 14)}${esc(recLabel)}</span>` : three && anyRec ? '<span class="slot"></span>' : ""}<h4>${esc(i.name)}</h4>${anyTagline ? `<p class="tag clamp-2">${esc(i.tagline)}</p>` : ""}<div class="pr num">${splitValue(i.price)}</div><div class="pn">${esc(i.priceNote)}</div>${points.length ? `<ul class="pts">${points.map((pt) => `<li><span class="ck">${icon("check", 13)}</span><span class="clamp-2">${esc(pt)}</span></li>`).join("")}</ul>` : ""}</article>`;
        })
        .join("")}</div>`;
    },
  },

  /* ---------------------------------------------------------------------- */
  {
    id: "faq",
    name: "Veelgestelde vragen",
    description:
      "Uitklapbare vragen en antwoorden, er staat steeds één open. Werkt ook zonder JavaScript. Voor de twijfels die je klant waarschijnlijk heeft. In de PDF staat de eerste vraag open.",
    category: "vertrouwen",
    height: 470,
    interactive: true,
    brands: ["websup", "koolhaas"],
    params: {
      eyebrow: "Optioneel klein label, bijvoorbeeld 'Goed om te weten'.",
      title: "Kop, bijvoorbeeld 'Vragen die ik vaak krijg'. Max 50 tekens.",
      highlight: "Optioneel. Stuk letterlijk uit title dat in het merkverloop komt.",
      items: "Lijst van {q, a}. 3 tot 6 stuks. q max 70 tekens. a max 260 tekens, wordt na vier regels afgekapt.",
    },
    maxItems: { items: 6 },
    example: {
      eyebrow: "Goed om te weten",
      title: "Vragen die ik vaak krijg",
      highlight: "vaak krijg",
      items: [
        { q: "Hoe lang duurt de installatie?", a: "Meestal één werkdag. De stroom is hooguit een uur uit, dat plan ik samen met je in." },
        { q: "Wat als er iets stuk gaat?", a: "Je belt of appt mij direct. Ik kom zelf langs en regel de garantie met de fabrikant." },
        { q: "Kan ik later uitbreiden?", a: "Ja. De omvormer kan een tweede batterijmodule aan en ik laat ruimte in de groepenkast." },
        { q: "Moet ik zelf iets voorbereiden?", a: "Zorg dat de meterkast en de plek van de batterij vrij bereikbaar zijn. De rest regel ik." },
      ],
    },
    heightFor: (p) => {
      const items = list(p.items).slice(0, 6);
      const lines = Math.min(4, Math.max(1, ...items.map((i) => Math.ceil(String(i.a ?? "").length / 78))));
      return fit(headerHeight(p) + items.length * 60 + lines * 26 + 18);
    },
    render: (p) => {
      const items = list(p.items).slice(0, 6);
      return `<style>${HEAD_CSS}
.faq{display:grid;gap:8px}
details{position:relative;background:var(--paper);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
details[open]{box-shadow:var(--shadow);border-color:var(--line-tint)}
details[open]::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--grad)}
summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:13px 14px 13px 22px;cursor:pointer;font-family:var(--font-head);font-weight:var(--title-weight);font-size:17px;letter-spacing:var(--title-track);line-height:1.35}
summary::-webkit-details-marker{display:none}
summary .q{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
.tg{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--surface-2);color:var(--ink);transition:background .2s,transform .25s}
.tg svg{stroke-width:2}
.tg .x{display:none}
details[open] .tg{background:var(--dark);color:#fff;transform:rotate(90deg)}
details[open] .tg .x{display:block}details[open] .tg .p{display:none}
summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:var(--r)}
.a{padding:0 22px 16px;font-size:16px;line-height:1.6;color:var(--muted)}
</style>
${header(p.eyebrow, p.title, p.highlight)}
<div class="faq">${items
        .map(
          (i, n) =>
            `<details name="faq"${n === 0 ? " open" : ""}><summary><span class="q">${esc(i.q)}</span><span class="tg"><span class="p">${icon("plus", 16)}</span><span class="x">${icon("x", 16)}</span></span></summary><p class="a clamp-4">${esc(i.a)}</p></details>`,
        )
        .join("")}</div>
<script>
(function(){
  // Browsers zonder details[name]: houd er zelf één open, anders loopt het blok uit zijn hoogte.
  var all=document.querySelectorAll('details');
  all.forEach(function(d){d.addEventListener('toggle',function(){if(d.open)all.forEach(function(o){if(o!==d)o.open=false;});});});
})();
</script>`;
    },
  },
];

/**
 * Voorbeelden van vrij ontwerp: gewone HTML met alleen de standaardklassen uit de
 * iframe. Geen eigen kleuren, fonts of maten. ChatGPT krijgt ze mee als richtlijn;
 * de inhoud en de vorm bepaalt het zelf.
 */
export type ArtifactExample = { id: string; name: string; description: string; height: number; html: string };

export const ARTIFACT_EXAMPLES: ArtifactExample[] = [
  {
    id: "vrij-scope",
    name: "Wat zit erin",
    description: "Twee kolommen: inbegrepen en niet inbegrepen. Witte kaart naast een zacht vlak.",
    height: 290,
    html: `<div class="grid-2">
  <div class="card pad stack">
    <h3 class="h3">Dit zit erin</h3>
    <ul class="check-list">
      <li>Ontwerp van vijf pagina's</li>
      <li>Teksten herschreven op basis van jouw input</li>
      <li>Bestelmodule met ophaaltijden</li>
      <li>Hosting en onderhoud het eerste jaar</li>
    </ul>
  </div>
  <div class="soft pad stack">
    <h3 class="h3">Dit zit er niet in</h3>
    <ul class="cross-list">
      <li>Fotografie op locatie</li>
      <li>Koppeling met je kassasysteem</li>
      <li>Advertenties beheren</li>
    </ul>
  </div>
</div>`,
  },
  {
    id: "vrij-werkwijze",
    name: "Werkwijze",
    description: "Label, kop en drie tot vijf stappen naast elkaar met de klasse steps.",
    height: 250,
    html: `<div class="stack-lg">
  <div class="stack">
    <span class="eyebrow">Zo pak ik het aan</span>
    <h2 class="h2">Van eerste schets tot <span class="grad-text">live</span></h2>
  </div>
  <ol class="steps">
    <li><h3 class="h3">Kennismaken</h3><p class="small">We lopen je wensen door en ik maak een schets.</p></li>
    <li><h3 class="h3">Ontwerp</h3><p class="small">Je ziet de pagina's voordat er iets gebouwd wordt.</p></li>
    <li><h3 class="h3">Bouwen</h3><p class="small">Ik bouw en test, jij kijkt mee in een testomgeving.</p></li>
    <li><h3 class="h3">Live</h3><p class="small">Ik zet alles online en leg uit hoe je het beheert.</p></li>
  </ol>
</div>`,
  },
  {
    id: "vrij-advies",
    name: "Advies met kerncijfer",
    description: "Donkere kaart met één cijfer naast een korte uitleg en een callout met de aanname.",
    height: 220,
    html: `<div class="grid-2" style="grid-template-columns:1fr 1.3fr;align-items:stretch">
  <div class="card-dark topline pad-lg stack">
    <span class="label">Verwacht eigen verbruik</span>
    <div class="stat-value">78<small>%</small></div>
    <p class="small">van je zonnestroom gebruik je zelf, nu is dat 31%.</p>
  </div>
  <div class="stack" style="justify-content:center">
    <h3 class="h3">Waarom een batterij bij jou past</h3>
    <p>Overdag ben je weinig thuis. De batterij bewaart de stroom van je panelen voor de avond, in plaats van dat je hem goedkoop teruglevert.</p>
    <div class="callout small">Berekend op je verbruik van 4.200 kWh per jaar.</div>
  </div>
</div>`,
  },
  {
    id: "vrij-tabel",
    name: "Overzicht in een tabel",
    description: "Kop met tabel. Bedragen altijd uit de calculatie, rechts uitgelijnd met de klasse r.",
    height: 250,
    html: `<div class="card pad stack">
  <div class="row between"><h3 class="h3">Maandelijkse kosten</h3><span class="chip">Na oplevering</span></div>
  <table class="table">
    <tr><th>Onderdeel</th><th>Wat je krijgt</th><th class="r">Per maand</th></tr>
    <tr><td>Hosting</td><td class="muted">Snelle server, back-ups, SSL</td><td class="r">€ 25</td></tr>
    <tr><td>Onderhoud</td><td class="muted">Updates en een uur aanpassingen</td><td class="r">€ 45</td></tr>
  </table>
</div>`,
  },
];

const exampleText = ARTIFACT_EXAMPLES.map((example) => `--- ${example.name} (hoogte ${example.height}) ---\n${example.html}`).join("\n\n");

export const ARTIFACT_DESIGN_GUIDE = `
ONTWERPGIDS VOOR OFFERTE-ARTIFACTS (HTML, CSS en JS in een offerteblok)

UITGANGSPUNT
Je bent vrij in wat je maakt: kies zelf de vorm die het verhaal van deze offerte het best vertelt. De huisstijl ligt vast. Bouw daarom met de standaardklassen hieronder in plaats van eigen kleuren, fonts en maten. Dan past elk blok bij het bedrijf en bij de rest van de offerte. Een sjabloon (list_quote_artifacts) is een snelle optie, geen verplichting.

HARDE REGELS (de app of de validator weigert anders)
- Maximaal 60.000 tekens.
- Geen <iframe>, <object>, <embed>, <base>, <form>, <link rel=import>, <meta http-equiv=refresh>.
- Geen externe scripts (<script src=...>). Alle JS staat inline.
- Geen netwerkverkeer: fetch, XMLHttpRequest en WebSocket worden door de CSP geblokkeerd. Alle gegevens staan in het blok zelf.
- Externe bronnen mogen alleen: Google Fonts en afbeeldingen via https of data:.
- Geen verwijzingen naar parent, top, cookies of localStorage.

FORMAAT
- Vaste breedte van 673px. Op smallere schermen schaalt de app het hele blok kleiner, dus geen media queries.
- Hoogte is VAST (items: [{"height": 360}], maximaal 880). Er is geen scroll: wat buiten de hoogte valt, is weg. Een A4-pagina heeft ongeveer 880px.
- Hoogte schatten: tel op wat je stapelt en tel er 20 bij op.
  Regelhoogtes: tekst 25px, .lead 29px, .small 21px, .h1 36px, .h2 29px, .h3 24px, .stat-value 36px, .eyebrow 34px.
  Ruimtes: .pad 48 (boven en onder samen), .pad-lg 64, .stack 12 tussen elk element, .stack-lg 24, lijstregel 32.
  Te krap is erger dan 20px te ruim.

STANDAARDKLASSEN (komen per bedrijf in de juiste stijl mee)
Typografie: .h1 (34px), .h2 (26px), .h3 (19px), .lead (18px), gewone tekst (16px), .small (14px), .label (14px vet), .eyebrow (label boven een kop), .grad-text (één woord in het merkverloop), .muted
Vlakken: .card (witte kaart), .soft (licht vlak), .tint (zachte merktint), .card-dark (donkere merkkaart, tekst wordt vanzelf licht), .topline (merklijn bovenaan een kaart), .callout (opvallende notitie), .divider
Opbouw: .stack en .stack-lg (onder elkaar), .row en .between (naast elkaar), .grid-2, .grid-3, .grid-4, .pad, .pad-lg
Onderdelen: .check-list (vinkjes), .cross-list (niet inbegrepen), .steps (genummerde stappen naast elkaar, <ol> met <li>), .stat-value met <small> voor de eenheid, .chip, .badge, .icon (vakje voor een svg-icoon), .table met .r voor bedragen
Afkappen: .clamp-1 tot en met .clamp-4
Tokens als je toch iets eigens nodig hebt: --ink, --muted, --line, --surface, --accent, --accent-ink, --accent-soft, --fill, --grad, --dark-bg, --on-dark, --r, --r-lg, --shadow. Nooit een hexkleur.

STIJLREGELS
- Eén hoofdpunt per blok. Wat moet de klant hier onthouden? Dat wordt het grootst.
- Accent spaarzaam: één woord in .grad-text per blok, hooguit één .card-dark per blok.
- Liever witruimte dan een vol blok. Maximaal 6 items in een lijst, 4 kolommen in een grid.
- Tekst minimaal 16px, kleine labels minimaal 14px. Geen lichtgrijs op wit.
- Geen gradient-vlakken, glow, glaseffecten, emoji of em dashes.
- Iconen als inline SVG met stroke="currentColor" en stroke-width 1.75.

INHOUD
- Verzin geen cijfers, claims, reviews, certificaten of prijzen. Elk getal komt uit de calculatie, de offerte of een aangeleverde berekening.
- Schrijf in de je-vorm, kort en concreet. Een rekenvoorbeeld toont altijd zijn aannames.
- De PDF print de beginstand: alles moet zonder klikken leesbaar zijn. Niets hangt af van hover.
- Toegankelijk: labels bij inputs, <button> voor acties, kleur nooit het enige signaal.

WERKWIJZE
1. Bedenk wat dit blok moet vertellen en kies een vorm. Kijk eventueel naar list_quote_artifacts.
2. Schrijf de HTML met de standaardklassen en sla het op met add_quote_artifact, of vul een sjabloon in met render_quote_artifact.
3. Controleer het resultaat met preview_quote_artifact_page voordat je de offerte deelt.

VOORBEELDEN VAN VRIJ ONTWERP (alleen standaardklassen, geen eigen CSS)
${exampleText}
`.trim();

/** Controleert artifact-HTML voordat het in de database komt. Geeft een lijst met problemen terug. */
export function validateArtifactHtml(html: string): string[] {
  const problems: string[] = [];
  if (!html.trim()) problems.push("De HTML is leeg.");
  if (html.length > 60_000) problems.push(`De HTML is ${html.length} tekens, maximaal 60.000.`);
  const checks: [RegExp, string][] = [
    [/<\s*iframe\b/i, "<iframe> is niet toegestaan."],
    [/<\s*(object|embed)\b/i, "<object> en <embed> zijn niet toegestaan."],
    [/<\s*base\b/i, "<base> is niet toegestaan."],
    [/<\s*form\b/i, "<form> is niet toegestaan; gebruik losse inputs met JavaScript."],
    [/<\s*meta[^>]+http-equiv\s*=\s*["']?\s*refresh/i, "<meta http-equiv=refresh> is niet toegestaan."],
    [/<\s*script[^>]+\bsrc\s*=/i, "Externe scripts zijn niet toegestaan; zet de JavaScript inline."],
    [/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\b/, "Netwerkverkeer is niet toegestaan en wordt geblokkeerd."],
    [/\b(window\.(top|parent)|parent\.|top\.location|document\.cookie|localStorage|sessionStorage)\b/, "Toegang tot parent, top, cookies of opslag is niet toegestaan."],
    [/<\s*link\b[^>]+rel\s*=\s*["']?(?!stylesheet)/i, "Alleen <link rel=stylesheet> naar Google Fonts is toegestaan."],
  ];
  for (const [pattern, message] of checks) if (pattern.test(html)) problems.push(message);
  for (const match of html.matchAll(/<\s*link\b[^>]*href\s*=\s*["']([^"']+)["']/gi)) {
    if (!/^https:\/\/fonts\.googleapis\.com\//i.test(match[1])) problems.push(`Stylesheet ${match[1]} is niet toegestaan; alleen Google Fonts.`);
  }
  return problems;
}

export function clampArtifactHeight(height: number | undefined, fallback: number): number {
  const value = Number.isFinite(height) && (height as number) > 0 ? (height as number) : fallback;
  return Math.min(Math.round(value), 880);
}

/** Hoogte voor een ingevuld sjabloon: eerst de berekening per invulling, anders de standaard. */
export function templateHeight(template: ArtifactTemplate, params: Record<string, unknown>): number {
  try {
    const value = template.heightFor?.(params);
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return clampArtifactHeight(value, template.height);
  } catch {
    // Onbruikbare invoer: val terug op de standaardhoogte.
  }
  return template.height;
}
