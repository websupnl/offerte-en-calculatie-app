/**
 * Het HTML-document waarin een offerte-artifact draait. Los van de React-component
 * zodat de artifact-preview (scripts/artifact-preview.mjs) precies dezelfde
 * opbouw, CSP en basis-CSS gebruikt als de app. Geen imports via `@/` hier.
 */

export const ARTIFACT_DEFAULT_HEIGHT = 360;
export const ARTIFACT_MAX_HEIGHT = 880;

export function artifactHeight(items: unknown): number {
  const first = Array.isArray(items) ? (items[0] as { height?: unknown } | undefined) : undefined;
  const value = Number(first?.height);
  if (!Number.isFinite(value) || value <= 0) return ARTIFACT_DEFAULT_HEIGHT;
  return Math.min(Math.round(value), ARTIFACT_MAX_HEIGHT);
}

export const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src data: https:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/**
 * Merkthema's. Elk artifact krijgt de tokens en fonts van het bedrijf mee, zodat
 * hetzelfde sjabloon bij WebsUp als WebsUp voelt en bij Koolhaas als Koolhaas.
 * Bron: de websites zelf (WebsUp.nl-new-website/app/globals.css en
 * Koolhaas Installaties/src/config/brand.ts, thema "koolhaas-new-gradient").
 *
 * Afgeleide tinten (--accent-ink, --accent-soft) komen uit color-mix met --accent,
 * dus een aangepaste accentkleur per bedrijf werkt overal door.
 */
export type ArtifactTheme = "websup" | "koolhaas";

export function artifactThemeFor(slug?: string | null): ArtifactTheme {
  return slug === "koolhaas" ? "koolhaas" : "websup";
}

const THEMES: Record<ArtifactTheme, { fonts: string; tokens: string; extra: string }> = {
  websup: {
    fonts:
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Geist:wght@400..700&display=swap",
    tokens: `
--font-head:'Bricolage Grotesque',system-ui,sans-serif;--font-body:'Geist','Nunito',system-ui,sans-serif;
--head-weight:800;--head-track:-.035em;--title-weight:700;--title-track:-.015em;
--ink:#0b1526;--muted:#56647a;--line:rgba(11,21,38,.09);--line-strong:rgba(11,21,38,.16);
--surface:#f8f9fc;--surface-2:#eef1f8;--paper:#fff;
--accent:#f97316;--accent-2:#ec4899;--accent-3:#a78bfa;
--line-tint:rgba(236,72,153,.18);
--dark:#06040c;--dark-bg:linear-gradient(155deg,#141a2e 0%,#0b0a18 52%,#06040c 100%);
--on-dark:#fff;--on-dark-muted:rgba(255,255,255,.7);--on-dark-line:rgba(255,255,255,.1);--on-dark-accent:#fdba74;
--grad:linear-gradient(135deg,#f97316 0%,#ec4899 50%,#a78bfa 100%);
--grad-line:linear-gradient(90deg,#f97316,#ec4899,#a78bfa);
--grad-text:linear-gradient(100deg,#f97316 0%,#ec4899 60%,#a78bfa 100%);
--grad-text-dark:linear-gradient(100deg,#fb923c 0%,#f472b6 55%,#c4b5fd 100%);
--grad-soft:linear-gradient(135deg,rgba(249,115,22,.08) 0%,rgba(236,72,153,.06) 50%,rgba(167,139,250,.09) 100%);
--fill:linear-gradient(135deg,#f97316 0%,#ec4899 100%);
--r-sm:10px;--r:14px;--r-lg:20px;
--shadow:0 1px 2px rgba(11,21,38,.04),0 10px 30px rgba(11,21,38,.06);
--shadow-lg:0 2px 4px rgba(11,21,38,.05),0 24px 56px rgba(11,21,38,.12);`,
    // WebsUp-eyebrow: pill met de drie merkpunten, zoals op de site.
    extra: `
.eyebrow{display:inline-flex;align-items:center;gap:10px;padding:5px 14px 5px 12px;border-radius:999px;background:#fff;border:1px solid var(--line-tint);font-size:14px;font-weight:600;letter-spacing:0;color:#334155}
.eyebrow::before{content:"";flex:none;width:22px;height:6px;background:radial-gradient(circle at 3px 3px,#f97316 2.6px,transparent 3.2px),radial-gradient(circle at 11px 3px,#ec4899 2.6px,transparent 3.2px),radial-gradient(circle at 19px 3px,#a78bfa 2.6px,transparent 3.2px)}
.on-dark .eyebrow,.card-dark .eyebrow{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:rgba(255,255,255,.86)}`,
  },
  koolhaas: {
    fonts: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&display=swap",
    tokens: `
--font-head:'DM Sans',system-ui,sans-serif;--font-body:'DM Sans',system-ui,sans-serif;
--head-weight:500;--head-track:-.035em;--title-weight:600;--title-track:-.01em;
--ink:#102d59;--muted:#536881;--line:#d9e8f0;--line-strong:#bcd3e2;
--surface:#f4f9fc;--surface-2:#e8f4fb;--paper:#fff;
--accent:#247eb2;--accent-2:#55cfc5;--accent-3:#61cfc4;
--line-tint:#d9e8f0;
--dark:#102d59;--dark-bg:linear-gradient(150deg,#163c70 0%,#102d59 50%,#0a2749 100%);
--on-dark:#fff;--on-dark-muted:rgba(255,255,255,.74);--on-dark-line:rgba(255,255,255,.12);--on-dark-accent:#7fe0d4;
--grad:linear-gradient(120deg,#102d59 0%,#247eb2 48%,#6edbcf 100%);
--grad-line:linear-gradient(90deg,#247eb2,#6edbcf);
--grad-text:linear-gradient(100deg,#1d6fa0 0%,#247eb2 45%,#2a9d96 100%);
--grad-text-dark:linear-gradient(100deg,#7cc4ec 0%,#61cfc4 55%,#eafff6 100%);
--grad-soft:linear-gradient(135deg,#eef7fc 0%,#e9f8f6 100%);
--fill:linear-gradient(120deg,#0369a1 0%,#1f74a6 50%,#0b7db0 100%);
--r-sm:8px;--r:12px;--r-lg:14px;
--shadow:0 1px 2px rgba(16,45,89,.04),0 6px 20px rgba(16,45,89,.06);
--shadow-lg:0 2px 4px rgba(16,45,89,.06),0 16px 40px rgba(16,45,89,.12);`,
    // Koolhaas-eyebrow: rustig label met een korte merklijn ervoor.
    extra: `
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--accent-ink)}
.eyebrow::before{content:"";width:20px;height:2px;border-radius:2px;background:var(--grad-line)}
.on-dark .eyebrow,.card-dark .eyebrow{color:var(--on-dark-accent)}`,
  },
};

// Basis voor elk artifact. Oude namen (--ink-soft) blijven bestaan voor artifacts
// die al in offertes staan. De klassen hieronder zijn het gedeelde ontwerpsysteem:
// sjablonen en vrij ontworpen HTML gebruiken ze, zodat alles één serie vormt.
export const ARTIFACT_BASE_STYLE = `
:root{--accent-ink:color-mix(in srgb,var(--accent) 74%,#000);--accent-soft:color-mix(in srgb,var(--accent) 9%,#fff);--accent-tint:color-mix(in srgb,var(--accent) 18%,#fff);--ink-soft:var(--muted)}
*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{padding:12px 2px 2px}
body{font-family:var(--font-body);font-size:16px;line-height:1.55;color:var(--ink);-webkit-font-smoothing:antialiased;font-feature-settings:"tnum" 0}
h1,h2,h3,h4{font-family:var(--font-head);font-weight:var(--title-weight);letter-spacing:var(--title-track);line-height:1.15;margin:0;text-wrap:balance}
p{margin:0}
.display{font-family:var(--font-head);font-weight:var(--head-weight);letter-spacing:var(--head-track);line-height:1.06}
.num{font-family:var(--font-head);font-weight:var(--head-weight);letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
.muted{color:var(--muted)}
.grad-text{background:var(--grad-text);-webkit-background-clip:text;background-clip:text;color:transparent}
.on-dark .grad-text,.card-dark .grad-text{background-image:var(--grad-text-dark)}
.card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow)}
.card-dark{position:relative;background:var(--dark-bg);color:var(--on-dark);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow-lg)}
.card-dark .muted{color:var(--on-dark-muted)}
.topline{position:relative}.topline::after{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--grad-line)}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink);font-size:14px;font-weight:600;line-height:1.4;white-space:nowrap}
.icon{display:inline-grid;place-items:center;flex:none;width:40px;height:40px;border-radius:var(--r-sm);background:var(--accent-soft);color:var(--accent-ink)}
.icon svg{width:20px;height:20px}
.card-dark .icon,.on-dark .icon{background:rgba(255,255,255,.08);color:var(--on-dark-accent)}
.clamp-1,.clamp-2,.clamp-3,.clamp-4{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.clamp-1{-webkit-line-clamp:1}.clamp-2{-webkit-line-clamp:2}.clamp-3{-webkit-line-clamp:3}.clamp-4{-webkit-line-clamp:4}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
`;

const HEX = /^#[0-9a-f]{3,8}$/i;

// Ontwerpen zijn gemaakt voor een canvas van 673px (de A4-kolom). Op een smaller
// scherm (de klantpagina op een telefoon) schalen we dat canvas kleiner in plaats van
// de lay-out te laten omklappen: de hoogte is vast, dus herschikken zou afkappen.
export const ARTIFACT_CANVAS_WIDTH = 673;
const FIT_SCRIPT = `(function(){var W=${ARTIFACT_CANVAS_WIDTH},el=document.getElementById('ws-fit');function f(){var w=innerWidth-4;if(w>=W){el.style.width='';el.style.transform='';}else{el.style.width=W+'px';el.style.transform='scale('+(w/W)+')';}}f();addEventListener('resize',f);})();`;

export function buildArtifactDocument(html: string, accent?: string | null, theme: ArtifactTheme = "websup"): string {
  const brand = THEMES[theme] ?? THEMES.websup;
  const accentStyle = accent && HEX.test(accent) ? `:root{--accent:${accent}}` : "";
  return (
    `<!doctype html><html lang="nl"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_CSP}">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<link rel="stylesheet" href="${brand.fonts}">` +
    `<style>:root{${brand.tokens}}${accentStyle}${ARTIFACT_BASE_STYLE}${brand.extra}</style></head>` +
    `<body><div id="ws-fit" style="transform-origin:0 0">${html}</div><script>${FIT_SCRIPT}</script></body></html>`
  );
}
