#!/usr/bin/env node
/**
 * Scrape productprijzen van Technim (technim.nl) — installatie groothandel (CV, airco, elektra).
 * Werkt zonder zakelijk account (publieke prijzen incl./excl. BTW) — handig als vergelijking,
 * geen onderhandelde nettoprijs zoals bij Rexel/ESTG/4blue.
 *
 * Vereist: Brave open met --remote-debugging-port=9222.
 *
 * Gebruik:
 *   node scripts/scrape-technim.mjs [zoekterm]
 *   node scripts/scrape-technim.mjs installatieautomaat
 *
 * Output: JSON-array van producten (stdout) + opslaan in DB indien --save flag meegegeven.
 *   node scripts/scrape-technim.mjs installatieautomaat --save --company koolhaas
 */

import { getActiveTab, navigateTab, getTabText, closeTab } from './cdp.mjs';

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

// ── 2. Navigeren naar zoekresultaten (WordPress/WooCommerce: /?s=) ────────

const searchUrl = `https://www.technim.nl/?s=${encodeURIComponent(query)}`;
console.error(`Zoeken naar '${query}'...`);
await navigateTab(tab.ws, searchUrl, 3000);

// ── 3. Tekst ophalen en parsen ────────────────────────────────────────────

function parseProducts(text) {
  const products = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const priceFromEuroLine = (line) => {
    const m = line.match(/^€\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/);
    if (!m) return null;
    return parseFloat(m[1].replace(/\./g, '') + '.' + m[2]);
  };

  for (let i = 0; i < lines.length; i++) {
    if (!/^incl\.?\s*btw$/i.test(lines[i])) continue;

    const bruto = priceFromEuroLine(lines[i - 1] ?? '');
    const netto = priceFromEuroLine(lines[i + 1] ?? '');
    const isExcl = /^excl\.?\s*btw$/i.test(lines[i + 2] ?? '');
    if (bruto === null || netto === null || !isExcl) continue;

    const beschrijving = lines[i - 2] ?? '';
    if (!beschrijving) continue;
    const brand = beschrijving.split(' ')[0] ?? '';

    products.push({ brand, model: beschrijving, artikelnr: null, bruto, netto, beschrijving });
  }

  return products;
}

const text = await getTabText(tab.ws);
const products = parseProducts(text);

closeTab(tab.ws);
console.error(`\n✓ ${products.length} producten gescraped — let op: dit zijn publieke prijzen, geen onderhandelde nettoprijs.\n`);

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
          specs: { inclBtw: p.bruto },
          price: p.netto,
          notes: `Technim publieke prijs excl. BTW (geen accountkorting).`,
          sourceUrl: 'https://www.technim.nl',
        },
        update: {
          specs: { inclBtw: p.bruto },
          price: p.netto,
          notes: `Technim publieke prijs excl. BTW (geen accountkorting).`,
          sourceUrl: 'https://www.technim.nl',
        },
      });
      await prisma.product.updateMany({
        where: { datasheetId: datasheet.id },
        data: { costPrice: p.netto, supplier: "Technim", priceUpdatedAt: new Date() },
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
