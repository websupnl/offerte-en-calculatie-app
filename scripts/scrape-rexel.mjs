#!/usr/bin/env node
/**
 * Scrape productprijzen van Rexel (rexel.nl).
 * Vereist: Brave open met --remote-debugging-port=9222, ingelogd op rexel.nl (klantnummer/account).
 *
 * Gebruik:
 *   node scripts/scrape-rexel.mjs [zoekterm]
 *   node scripts/scrape-rexel.mjs installatieautomaat
 *
 * Output: JSON-array van producten (stdout) + opslaan in DB indien --save flag meegegeven.
 *   node scripts/scrape-rexel.mjs installatieautomaat --save --company koolhaas
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

// ── 2. Navigeren naar zoekresultaten ─────────────────────────────────────

const searchUrl = `https://www.rexel.nl/nln/search?text=${encodeURIComponent(query)}`;
console.error(`Zoeken naar '${query}'...`);
await navigateTab(tab.ws, searchUrl, 3000);

// Rexel laadt extra resultaten pas na scrollen (lazy load) — help een handje.
for (let i = 0; i < 5; i++) {
  await evalTab(tab.ws, 'window.scrollTo(0, document.body.scrollHeight)');
  await new Promise((r) => setTimeout(r, 900));
}

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
    if (!/^Art\.\s*nr\.?$/i.test(lines[i])) continue;

    const artikelnr = lines[i + 1] ?? null;
    if (!artikelnr || !/^\d+$/.test(artikelnr)) continue;

    const brand = lines[i - 2] ?? '';
    const beschrijving = lines[i - 1] ?? '';

    let levNr = null;
    let netto = null;
    let bruto = null;
    let korting = null;

    for (let j = i; j < Math.min(i + 20, lines.length); j++) {
      if (/^Art\.\s*nr\.?$/i.test(lines[j]) && j !== i) break; // volgende product begonnen

      if (/^Lev\.\s*Nr\.?:?/i.test(lines[j])) {
        levNr = lines[j + 1] ?? null;
      } else if (/^Uw prijs$/i.test(lines[j])) {
        netto = priceFromLine(lines[j + 1] ?? '');
      } else if (/^Brutoprijs:/i.test(lines[j])) {
        bruto = priceFromLine(lines[j]);
      } else if (/^Korting:/i.test(lines[j])) {
        const m = lines[j].match(/([\d,]+)\s*%/);
        if (m) korting = parseFloat(m[1].replace(',', '.'));
      } else if (/^Voeg toe$/i.test(lines[j])) {
        break;
      }
    }

    if (netto !== null && beschrijving) {
      products.push({ brand, model: beschrijving, artikelnr, levNr, bruto, korting, netto, beschrijving });
    }
  }

  return products;
}

const text = await getTabText(tab.ws);
const products = parseProducts(text);

const totalMatch = text.match(/\((\d[\d.]*)\s*Artikelen\)/i);
const total = totalMatch ? totalMatch[1] : null;

closeTab(tab.ws);
console.error(`\n✓ ${products.length} producten gescraped${total ? ` (van ${total} totaal — Rexel toont alleen de eerste batch, verfijn je zoekterm voor specifiekere resultaten)` : ''}\n`);

// ── 4. Output / opslaan ───────────────────────────────────────────────────

if (shouldSave) {
  const { prisma, getCompany } = await import('./db.mjs');
  const { updateLinkedProductPrice } = await import('./pricing.mjs');
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
          specs: { artikelnr: p.artikelnr, levNr: p.levNr, bruto: p.bruto, korting: p.korting != null ? `${p.korting}%` : null },
          price: p.netto,
          notes: `Rexel netto${p.korting != null ? ` (${p.korting}% korting)` : ''}. Art. nr. ${p.artikelnr}.`,
          sourceUrl: 'https://www.rexel.nl',
        },
        update: {
          specs: { artikelnr: p.artikelnr, levNr: p.levNr, bruto: p.bruto, korting: p.korting != null ? `${p.korting}%` : null },
          price: p.netto,
          notes: `Rexel netto${p.korting != null ? ` (${p.korting}% korting)` : ''}. Art. nr. ${p.artikelnr}.`,
          sourceUrl: 'https://www.rexel.nl',
        },
      });
      await updateLinkedProductPrice(prisma, datasheet.id, p.netto, { supplier: 'Rexel', sku: p.artikelnr });
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
