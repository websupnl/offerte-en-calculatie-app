#!/usr/bin/env node
/**
 * Scrape Sigenergy (of ander merk) productprijzen van Oosterberg.
 * Vereist: Brave open met --remote-debugging-port=9222, ingelogd op webshop.oosterberg.nl.
 *
 * Gebruik:
 *   node scripts/scrape-oosterberg.mjs [zoekterm]
 *   node scripts/scrape-oosterberg.mjs sigenergy
 *   node scripts/scrape-oosterberg.mjs huawei
 *
 * Output: JSON-array van producten (stdout) + opslaan in DB indien --save flag meegegeven.
 *   node scripts/scrape-oosterberg.mjs sigenergy --save --company koolhaas
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

// ── 2. Navigeren naar zoekresultaten ─────────────────────────────────────

const searchUrl = `https://webshop.oosterberg.nl/zoeken?q=${encodeURIComponent(query)}&page=1`;
console.error(`Zoeken naar '${query}'...`);
await navigateTab(tab.ws, searchUrl, 3000);

// ── 3. Tekst ophalen en parsen ────────────────────────────────────────────

async function scrapePage(pageNum) {
  if (pageNum > 1) {
    await navigateTab(tab.ws, searchUrl.replace('page=1', `page=${pageNum}`), 2500);
  }
  return getTabText(tab.ws);
}

function parseProducts(text) {
  const products = [];
  // Regex om een productblok te herkennen: artikelnummer + merk + naam + prijs
  // Formaat in Oosterberg tekst:
  //   "MERK, MODEL\n\nartikelNr  MERK, MODEL, beschrijving...\n...Bruto prijs:\n€ X,XX / st\nKorting: N%\nNetto prijs:\n€ Y,YY / st"
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    // Zoek een artikelnummer (8+ cijfers gevolgd door merk/naam)
    const artMatch = lines[i].match(/^(\d{7,9})\s+([A-Z][A-Z\s,.\-\/0-9]+)$/);
    if (artMatch) {
      const artikelnr = artMatch[1];
      const beschrijving = artMatch[2];

      // Zoek Netto prijs in de volgende regels
      let bruto = null, netto = null, korting = null;
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j].startsWith('Bruto prijs:')) {
          const prijsLine = lines[j + 1] ?? '';
          const m = prijsLine.match(/€\s*([\d.]+,\d{2})/);
          if (m) bruto = parseFloat(m[1].replace('.', '').replace(',', '.'));
        }
        if (lines[j].startsWith('Korting:')) {
          const m = lines[j].match(/([\d,]+)%/);
          if (m) korting = parseFloat(m[1].replace(',', '.'));
        }
        if (lines[j].startsWith('Netto prijs:')) {
          const prijsLine = lines[j + 1] ?? '';
          const m = prijsLine.match(/€\s*([\d.]+,\d{2})/);
          if (m) netto = parseFloat(m[1].replace('.', '').replace(',', '.'));
          break;
        }
      }

      if (netto !== null) {
        // Haal merk en model uit de beschrijving
        const parts = beschrijving.split(',').map(p => p.trim());
        const brand = parts[0] ?? '';
        const model = parts.slice(1).join(',').trim() || beschrijving;

        products.push({ brand, model, artikelnr, bruto, korting, netto, beschrijving });
      }
    }
    i++;
  }
  return products;
}

// Eerste pagina
const page1Text = await getTabText(tab.ws);
let products = parseProducts(page1Text);

// Controleer of er meer pagina's zijn
const totalMatch = page1Text.match(/Artikelen \((\d+)\)/);
const total = totalMatch ? parseInt(totalMatch[1]) : products.length;
const perPage = 20; // Oosterberg toont ~20 per pagina
const pages = Math.ceil(total / perPage);

if (pages > 1) {
  console.error(`${total} resultaten gevonden, ${pages} pagina's. Extra pagina's ophalen...`);
  for (let p = 2; p <= Math.min(pages, 10); p++) {
    const pageText = await scrapePage(p);
    const extra = parseProducts(pageText);
    products = [...products, ...extra];
    console.error(`  Pagina ${p}: ${extra.length} producten`);
  }
}

closeTab(tab.ws);
console.error(`\n✓ ${products.length} producten gescraped\n`);

// ── 4. Output / opslaan ───────────────────────────────────────────────────

if (shouldSave) {
  const { prisma, getCompany } = await import('./db.mjs');
  const company = await getCompany(companySlug);
  let saved = 0;

  for (const p of products) {
    try {
      await prisma.datasheet.upsert({
        where: { companyId_brand_model: { companyId: company.id, brand: p.brand, model: p.model } },
        create: {
          companyId: company.id,
          brand: p.brand,
          model: p.model,
          category: null,
          specs: { artikelnr: p.artikelnr, bruto: p.bruto, korting: `${p.korting}%` },
          price: p.netto,
          notes: `Oosterberg netto (${p.korting}% korting). Bruto €${p.bruto}.`,
          sourceUrl: 'https://webshop.oosterberg.nl',
        },
        update: {
          specs: { artikelnr: p.artikelnr, bruto: p.bruto, korting: `${p.korting}%` },
          price: p.netto,
          notes: `Oosterberg netto (${p.korting}% korting). Bruto €${p.bruto}.`,
          sourceUrl: 'https://webshop.oosterberg.nl',
        },
      });
      saved++;
    } catch (e) {
      console.error(`  ✗ ${p.brand} ${p.model}: ${e.message.slice(0, 80)}`);
    }
  }

  console.error(`✓ ${saved} producten opgeslagen in DB (${companySlug})`);
  await prisma.$disconnect();
} else {
  // Print als JSON naar stdout
  console.log(JSON.stringify(products, null, 2));
}
