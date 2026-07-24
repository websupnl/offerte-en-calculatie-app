#!/usr/bin/env node
/**
 * Scrape productprijzen van Elektramat (elektramat.nl) — elektrotechnische groothandel.
 * Werkt ook ZONDER zakelijk account (publieke consumentenprijzen incl./excl. BTW) —
 * handig als vergelijking naast Rexel/ESTG/4blue, maar dit is dus geen onderhandelde nettoprijs.
 *
 * Vereist: Brave open met --remote-debugging-port=9222.
 *
 * Let op: Elektramat's zoekfunctie leidt vaak door naar een categoriepagina i.p.v. een
 * generieke resultatenlijst. Gebruik daarom liefst een zoekterm die een productcategorie
 * dekt (bijv. "installatieautomaat", niet "kabel" — dat laatste opent een categorie-hub
 * zonder directe producten).
 *
 * Gebruik:
 *   node scripts/scrape-elektramat.mjs [zoekterm]
 *   node scripts/scrape-elektramat.mjs installatieautomaat
 *
 * Output: JSON-array van producten (stdout) + opslaan in DB indien --save flag meegegeven.
 *   node scripts/scrape-elektramat.mjs installatieautomaat --save --company koolhaas
 */

import { getActiveTab, navigateTab, getTabText, evalTab, closeTab } from './cdp.mjs';

const query = process.argv[2] ?? 'installatieautomaat';
const shouldSave = process.argv.includes('--save');
const companySlug = process.argv[process.argv.indexOf('--company') + 1] ?? 'koolhaas';

// ── 1. Verbinden met Brave ────────────────────────────────────────────────

let tab;
try {
  tab = await getActiveTab();
  console.error(`✓ Verbonden met Brave (${tab.url.slice(0, 60)}...)`);
} catch (e) {
  console.error(`✗ ${e.message}`);
  console.error('Start Brave met: /snap/brave/642/opt/brave.com/brave/brave-browser --remote-debugging-port=9222 &');
  process.exit(1);
}

// ── 2. Navigeren naar zoekresultaten (Magento — leidt vaak door naar categorie) ─

const searchUrl = `https://www.elektramat.nl/catalogsearch/result/?q=${encodeURIComponent(query)}&product_list_limit=48`;
console.error(`Zoeken naar '${query}'...`);
await navigateTab(tab.ws, searchUrl, 3000);

// ── 3. Tekst ophalen en parsen ────────────────────────────────────────────

function parseProducts(text) {
  const products = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const priceLine = (line) => /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(line);
  const toNum = (line) => parseFloat(line.replace(/\./g, '').replace(',', '.'));

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^Artikelnr\.\s*(\S+)$/i);
    if (!m) continue;

    const artikelnr = m[1];
    const beschrijving = lines[i + 1] ?? '';
    const brand = beschrijving.split(' ')[0] ?? '';

    let brutoInclBtw = null;
    let netto = null;
    for (let j = i + 2; j < Math.min(i + 10, lines.length); j++) {
      if (/^Artikelnr\./i.test(lines[j])) break;
      if (priceLine(lines[j])) {
        if (brutoInclBtw === null) brutoInclBtw = toNum(lines[j]);
        else {
          netto = toNum(lines[j]);
          break;
        }
      }
    }
    if (netto !== null && beschrijving) {
      products.push({ brand, model: beschrijving, artikelnr, bruto: brutoInclBtw, netto, beschrijving });
    }
  }

  return products;
}

const text = await getTabText(tab.ws);
const products = parseProducts(text);
const finalUrl = await evalTab(tab.ws, 'location.href');

closeTab(tab.ws);

if (products.length === 0) {
  console.error(`\n✗ Geen producten gevonden op ${finalUrl}. Elektramat leidde de zoekopdracht mogelijk door naar een categorie-overzicht zonder directe producten — probeer een specifiekere zoekterm (bijv. het exacte productgroep-woord).\n`);
} else {
  console.error(`\n✓ ${products.length} producten gescraped (${finalUrl}) — let op: dit zijn publieke prijzen, geen onderhandelde nettoprijs.\n`);
}

// ── 4. Output / opslaan ───────────────────────────────────────────────────

if (shouldSave) {
  const { prisma, getCompany } = await import('./db.mjs');
  const company = await getCompany(companySlug);
  let saved = 0;

  for (const p of products) {
    try {
      const datasheet = await prisma.datasheet.upsert({
        where: { companyId_brand_model: { companyId: company.id, brand: p.brand, model: p.model } },
        create: {
          companyId: company.id,
          brand: p.brand,
          model: p.model,
          category: null,
          specs: { artikelnr: p.artikelnr, inclBtw: p.bruto },
          price: p.netto,
          notes: `Elektramat publieke prijs excl. BTW (geen accountkorting). Art.nr. ${p.artikelnr}.`,
          sourceUrl: 'https://www.elektramat.nl',
        },
        update: {
          specs: { artikelnr: p.artikelnr, inclBtw: p.bruto },
          price: p.netto,
          notes: `Elektramat publieke prijs excl. BTW (geen accountkorting). Art.nr. ${p.artikelnr}.`,
          sourceUrl: 'https://www.elektramat.nl',
        },
      });
      await prisma.product.updateMany({
        where: { datasheetId: datasheet.id },
        data: { costPrice: p.netto, supplier: "Elektramat", sku: p.artikelnr, priceUpdatedAt: new Date() },
      });
      saved++;
    } catch (e) {
      console.error(`  ✗ ${p.brand} ${p.model}: ${e.message.slice(0, 80)}`);
    }
  }

  console.error(`✓ ${saved} leveranciersprijzen opgeslagen en gekoppelde inkoopprijzen bijgewerkt (${companySlug})`);
  await prisma.$disconnect();
} else {
  console.log(JSON.stringify(products, null, 2));
}
