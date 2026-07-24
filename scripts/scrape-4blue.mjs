#!/usr/bin/env node
/**
 * Scrape productprijzen van 4blue (4blue.nl) — solar/batterij groothandel (Magento).
 * Vereist: Brave open met --remote-debugging-port=9222, ingelogd op 4blue.nl (klantaccount).
 *
 * Gebruik:
 *   node scripts/scrape-4blue.mjs [zoekterm]
 *   node scripts/scrape-4blue.mjs growatt
 *
 * Output: JSON-array van producten (stdout) + opslaan in DB indien --save flag meegegeven.
 *   node scripts/scrape-4blue.mjs growatt --save --company koolhaas
 */

import { getActiveTab, navigateTab, getTabText, closeTab } from './cdp.mjs';

const query = process.argv[2] ?? 'growatt';
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

// ── 2. Navigeren naar zoekresultaten (Magento: catalogsearch/result/?q=&p=) ─

const baseUrl = (page) =>
  `https://www.4blue.nl/catalogsearch/result/?q=${encodeURIComponent(query)}${page > 1 ? `&p=${page}` : ''}`;
console.error(`Zoeken naar '${query}'...`);
await navigateTab(tab.ws, baseUrl(1), 3000);

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
    if (!/^Bekijk product$/i.test(lines[i])) continue;
    const priceIdx = i - 1;
    const price = priceFromLine(lines[priceIdx] ?? '');
    if (price === null) continue;

    const hasAttrLine = (lines[priceIdx - 1] ?? '').includes('|') || /:\s*\S/.test(lines[priceIdx - 1] ?? '');
    const model = hasAttrLine ? lines[priceIdx - 2] : lines[priceIdx - 1];
    const brand = hasAttrLine ? lines[priceIdx - 3] : lines[priceIdx - 2];

    if (!model || !brand) continue;
    products.push({ brand, model, artikelnr: null, bruto: null, netto: price, beschrijving: model });
  }

  return products;
}

let allProducts = [];
const firstPageText = await getTabText(tab.ws);
allProducts = parseProducts(firstPageText);

const totalMatch = firstPageText.match(/(\d[\d.]*)\s*producten\(en\)/i);
const total = totalMatch ? parseInt(totalMatch[1].replace(/\./g, '')) : allProducts.length;
const perPage = Math.max(allProducts.length, 1);
const pages = Math.min(Math.ceil(total / perPage), 10);

if (pages > 1) {
  console.error(`${total} resultaten gevonden, ${pages} pagina's. Extra pagina's ophalen...`);
  for (let p = 2; p <= pages; p++) {
    await navigateTab(tab.ws, baseUrl(p), 2500);
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
          specs: {},
          price: p.netto,
          notes: `4blue netto (klantprijs).`,
          sourceUrl: 'https://www.4blue.nl',
        },
        update: {
          price: p.netto,
          notes: `4blue netto (klantprijs).`,
          sourceUrl: 'https://www.4blue.nl',
        },
      });
      await prisma.product.updateMany({
        where: { datasheetId: datasheet.id },
        data: { costPrice: p.netto, supplier: "4Blue", priceUpdatedAt: new Date() },
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
