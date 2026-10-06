#!/usr/bin/env node
/**
 * Live preview van de offerte-artifacts: `npm run artifacts:preview` (poort 3010).
 *
 * Laadt de echte sjablonen (mcp-server/src/artifacts.ts) en de echte iframe-opbouw
 * (src/lib/artifact-document.ts) via Node's eigen TypeScript-ondersteuning. Bij elke
 * wijziging in die bestanden herlaadt de pagina vanzelf. Schrijft niets weg.
 *
 * Alleen in de preview komt er een klein meetscript in elk artifact dat de werkelijk
 * gebruikte hoogte doorgeeft, zodat je ziet of een sjabloon past of ruimte verspilt.
 */
import { createServer } from "node:http";
import { watch } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 3010);
const SOURCES = [path.join(root, "mcp-server/src/artifacts.ts"), path.join(root, "src/lib/artifact-document.ts")];

const BRANDS = {
  websup: { label: "WebsUp", accent: "#f97316", theme: "websup" },
  koolhaas: { label: "Koolhaas", accent: "#247EB2", theme: "koolhaas" },
};

const clients = new Set();
let version = Date.now();
for (const file of SOURCES) {
  watch(file, () => {
    version = Date.now();
    for (const res of clients) res.write(`data: ${version}\n\n`);
  });
}

async function load() {
  const [templates, doc] = await Promise.all(
    SOURCES.map((file) => import(`${pathToFileURL(file).href}?v=${version}`)),
  );
  return { templates: templates.ARTIFACT_TEMPLATES, validate: templates.validateArtifactHtml, heightOf: templates.templateHeight, doc };
}

const attr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Vult elke lijst in het voorbeeld aan tot maxItems, door de bestaande items te herhalen.
function maxed(template) {
  const out = structuredClone(template.example ?? {});
  for (const [key, limit] of Object.entries(template.maxItems ?? {})) {
    const items = Array.isArray(out[key]) ? out[key] : [];
    if (!items.length) continue;
    out[key] = Array.from({ length: limit }, (_, i) => items[i % items.length]);
  }
  return out;
}

// Laagste onderrand van alle zichtbare elementen, plus de 2px bodypadding onderaan.
const MEASURE = `<script>(function(){function send(){var bottom=0;document.body.querySelectorAll('*').forEach(function(el){if(el.tagName==='SCRIPT'||el.tagName==='STYLE')return;if(el.checkVisibility&&!el.checkVisibility())return;var b=el.getBoundingClientRect().bottom;if(b>bottom)bottom=b});parent.postMessage({artifactId:window.name,height:Math.ceil(bottom+2)},'*')}addEventListener('load',function(){send();setTimeout(send,1200)});if(document.fonts)document.fonts.ready.then(send)})();</script>`;

async function page(url) {
  const brand = BRANDS[url.searchParams.get("brand")] ?? BRANDS.websup;
  const mode = url.searchParams.get("mode") === "max" ? "max" : "example";
  const { templates, validate, heightOf, doc } = await load();

  const cards = templates
    .map((t) => {
      const params = mode === "max" ? maxed(t) : t.example;
      let html = "";
      let error = "";
      try {
        html = t.render(params);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      const problems = error ? [] : validate(html);
      const srcdoc = doc.buildArtifactDocument(html + MEASURE, brand.accent, brand.theme);
      const height = heightOf ? heightOf(t, params) : t.height;
      return `<section class="tpl">
  <header>
    <div><h2>${esc(t.name)}</h2><code>${esc(t.id)}</code>${t.category ? `<span class="tag">${esc(t.category)}</span>` : ""}${t.interactive ? `<span class="tag">interactief</span>` : ""}</div>
    <div class="meta"><span class="fit" data-for="${attr(t.id)}" data-height="${height}">meten...</span><span>${html.length.toLocaleString("nl-NL")} tekens</span></div>
  </header>
  <p class="desc">${esc(t.description)}</p>
  ${error ? `<p class="bad">render() faalt: ${esc(error)}</p>` : ""}
  ${problems.length ? `<p class="bad">${problems.map(esc).join("<br>")}</p>` : ""}
  <div class="stage"><iframe name="${attr(t.id)}" sandbox="allow-scripts" scrolling="no" style="height:${height}px" srcdoc="${attr(srcdoc)}"></iframe></div>
</section>`;
    })
    .join("\n");

  const link = (key, value, label, current) =>
    `<a href="?${new URLSearchParams({ brand: url.searchParams.get("brand") ?? "websup", mode, [key]: value })}" class="${current ? "on" : ""}">${label}</a>`;

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Artifact-preview</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Nunito:wght@400;600;700&display=swap">
<style>
:root{--ink:#0b1526;--soft:#56647a;--line:rgba(11,21,38,.12);--bg:#eef0f3;--accent:${brand.accent}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Nunito,system-ui,sans-serif}
.bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:24px;align-items:center;padding:12px 24px;background:#fff;border-bottom:1px solid var(--line)}
.bar strong{font-family:'Bricolage Grotesque',sans-serif;font-size:18px;margin-right:auto}
.seg{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.seg a{padding:6px 14px;color:var(--ink);text-decoration:none;font-weight:600;font-size:15px}.seg a.on{background:var(--ink);color:#fff}
main{max-width:769px;margin:0 auto;padding:32px 16px 96px;display:grid;gap:40px}
.tpl header{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
.tpl h2{display:inline;font:700 22px 'Bricolage Grotesque',sans-serif;margin:0 10px 0 0}
code{font-size:14px;color:var(--soft)}.tag{margin-left:8px;font-size:14px;padding:2px 8px;border-radius:999px;background:#fff;border:1px solid var(--line)}
.meta{display:flex;gap:12px;font-size:14px;color:var(--soft)}.fit{font-weight:700}.fit.ok{color:#15803d}.fit.waste{color:#b45309}.fit.over{color:#b91c1c}
.desc{margin:4px 0 12px;color:var(--soft);max-width:673px}.bad{margin:0 0 12px;padding:8px 12px;border-radius:10px;background:#fee2e2;color:#7f1d1d;font-size:15px}
.stage{background:#fff;padding:24px 32px;border-radius:12px;width:max-content;max-width:100%}
iframe{display:block;width:673px;border:0;outline:1.5px dashed color-mix(in srgb,var(--accent) 70%,white);outline-offset:0}
</style></head><body>
<div class="bar"><strong>Artifact-preview</strong>
<div class="seg">${link("brand", "websup", "WebsUp", brand === BRANDS.websup)}${link("brand", "koolhaas", "Koolhaas", brand === BRANDS.koolhaas)}</div>
<div class="seg">${link("mode", "example", "Voorbeeld", mode === "example")}${link("mode", "max", "Maximale invulling", mode === "max")}</div>
</div>
<main>${cards}</main>
<script>
addEventListener('message',function(e){var d=e.data||{};if(!d.artifactId)return;var el=document.querySelector('.fit[data-for="'+CSS.escape(d.artifactId)+'"]');if(!el)return;var max=+el.dataset.height,used=d.height;
el.textContent=used+' van '+max+'px';el.className='fit '+(used>max?'over':(max-used>40?'waste':'ok'));
el.title=used>max?'Loopt over: wordt afgeknipt':(max-used>40?(max-used)+'px loze ruimte':'Past');});
new EventSource('/events').onmessage=function(){location.reload()};
</script></body></html>`;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(": open\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname !== "/") {
    res.writeHead(404).end();
    return;
  }
  try {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(await page(url));
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end(String(e?.stack ?? e));
  }
}).listen(PORT, () => console.log(`Artifact-preview op http://localhost:${PORT}`));
