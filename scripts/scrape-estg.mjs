#!/usr/bin/env node
/**
 * Scrape productprijzen van ESTG (estg.eu) — zonnepanelen & thuisbatterijen groothandel.
 * Vereist: Brave open met --remote-debugging-port=9222, ingelogd op estg.eu (klantaccount).
 *
 * Gebruik:
 *   node scripts/scrape-estg.mjs [zoekterm]
 *   node scripts/scrape-estg.mjs sigenergy
 *
 * Output: JSON-array van producten (stdout) + opslaan in DB indien --save flag meegegeven.
 *   node scripts/scrape-estg.mjs sigenergy --save --company koolhaas
 */

import { getActiveTab, navigateTab, getTabText, closeTab } from './cdp.mjs';

const query = process.argv[2] ?? 'sigenergy';
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

// ── 2. Navigeren naar zoekresultaten (ESTG gebruikt /s/{query}?page=N) ────

const baseUrl = `https://www.estg.eu/nl-nl/s/${encodeURIComponent(query)}`;
console.error(`Zoeken naar '${query}'...`);
await navigateTab(tab.ws, baseUrl, 3000);

// ── 3. Tekst ophalen en parsen ────────────────────────────────────────────

function parseProducts(text) {
  const products = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const priceFromLine = (line) => {
    const m = line.match(/€\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/);
    if (!m) return null;
    return parseFloat(m[1].replace(/\./g, '') + '.' + m[2]);
  };

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^Art\.?\s*Nr\.?:\s*(.+)$/i);
    if (!m) continue;

    const artikelnr = m[1].trim();
    const model = lines[i - 1] ?? '';
    const brand = lines[i - 2] ?? '';

    const priceLines = [];
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      if (/^IN WINKELWAGEN$/i.test(lines[j])) break;
      if (/^Art\.?\s*Nr\.?:/i.test(lines[j])) break;
      const p = priceFromLine(lines[j]);
      if (p !== null) priceLines.push(p);
    }
    if (priceLines.length === 0 || !model) continue;

    const netto = priceLines.length > 1 ? priceLines[priceLines.length - 1] : priceLines[0];
    const bruto = priceLines.length > 1 ? priceLines[0] : null;

    products.push({ brand, model, artikelnr, bruto, netto, beschrijving: model });
  }

  return products;
}

let allProducts = [];
let firstPageText = await getTabText(tab.ws);
allProducts = parseProducts(firstPageText);

const totalMatch = firstPageText.match(/(\d[\d.]*)\s*producten/i);
const total = totalMatch ? parseInt(totalMatch[1].replace(/\./g, '')) : allProducts.length;
const perPage = Math.max(allProducts.length, 1);
const pages = Math.min(Math.ceil(total / perPage), 10);

if (pages > 1) {
  console.error(`${total} resultaten gevonden, ${pages} pagina's. Extra pagina's ophalen...`);
  for (let p = 2; p <= pages; p++) {
    await navigateTab(tab.ws, `${baseUrl}?page=${p}`, 2500);
    const pageText = await getTabText(tab.ws);
    const extra = parseProducts(pageText);
    if (extra.length === 0) break;
    allProducts = [...allProducts, ...extra];
    console.error(`  Pagina ${p}: ${extra.length} producten`);
  }
}

closeTab(tab.ws);
console.error(`\n✓ ${allProducts.length} producten gescraped\n`);

// ── 4. Output / opslaan ───────────────────────────────────────────────────

if (shouldSave) {
  const { prisma, getCompany } = await import('./db.mjs');
  const company = await getCompany(companySlug);
  let saved = 0;

  for (const p of allProducts) {
    try {
      const datasheet = await prisma.datasheet.upsert({
        where: { companyId_brand_model: { companyId: company.id, brand: p.brand, model: p.model } },
        create: {
          companyId: company.id,
          brand: p.brand,
          model: p.model,
          category: null,
          specs: { artikelnr: p.artikelnr, bruto: p.bruto },
          price: p.netto,
          notes: `ESTG netto. Art.Nr. ${p.artikelnr}.`,
          sourceUrl: 'https://www.estg.eu',
        },
        update: {
          specs: { artikelnr: p.artikelnr, bruto: p.bruto },
          price: p.netto,
          notes: `ESTG netto. Art.Nr. ${p.artikelnr}.`,
          sourceUrl: 'https://www.estg.eu',
        },
      });
      await prisma.product.updateMany({
        where: { datasheetId: datasheet.id },
        data: { costPrice: p.netto, supplier: 'ESTG', sku: p.artikelnr, priceUpdatedAt: new Date() },
      });
      saved++;
    } catch (e) {
      console.error(`  ✗ ${p.brand} ${p.model}: ${e.message.slice(0, 80)}`);
    }
  }

  console.error(`✓ ${saved} leveranciersprijzen opgeslagen en gekoppelde inkoopprijzen bijgewerkt (${companySlug})`);
  await prisma.$disconnect();
} else {
  console.log(JSON.stringify(allProducts, null, 2));
}
