#!/usr/bin/env node
/**
 * Importeer een offerte-JSON direct in de app via de CLI API.
 * Maakt automatisch een klant aan als die nog niet bestaat.
 *
 * Gebruik:
 *   node scripts/import-quote.mjs <json-bestand> --company koolhaas --customer "Arjan Koolhaas"
 *   node scripts/import-quote.mjs ~/Bureaublad/offerte-ouders-koolhaas.json \
 *     --company koolhaas \
 *     --customer "Arjan Koolhaas" \
 *     --email "arjan@example.nl" \
 *     --address "Arendswyk 45" \
 *     --city "Rottevalle" \
 *     --zip "9221 TV"
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Laad .env.local voor CLI_API_KEY en APP_URL
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && !key.startsWith('#') && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    }
  } catch { /* ignore */ }
}
loadEnv();

const args = process.argv.slice(2);
const jsonFile = args.find(a => !a.startsWith('--'));
if (!jsonFile) {
  console.error('Gebruik: node scripts/import-quote.mjs <json-bestand> --company koolhaas --customer "Naam"');
  process.exit(1);
}

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const companySlug = getArg('--company') ?? 'koolhaas';
const customerName = getArg('--customer');
const customerEmail = getArg('--email');
const customerAddress = getArg('--address');
const customerCity = getArg('--city');
const customerZip = getArg('--zip');
const appUrl = process.env.APP_URL ?? 'http://localhost:3001';
const apiKey = process.env.CLI_API_KEY;

if (!apiKey) {
  console.error('CLI_API_KEY ontbreekt in .env.local');
  process.exit(1);
}

// Lees het JSON-bestand
const quoteJson = JSON.parse(readFileSync(resolve(jsonFile), 'utf8'));

console.log(`Importeren: ${jsonFile}`);
console.log(`  Bedrijf:  ${companySlug}`);
console.log(`  Klant:    ${customerName ?? '(niet opgegeven)'}`);
console.log(`  App:      ${appUrl}`);

const payload = {
  companySlug,
  customer: {
    name: customerName,
    email: customerEmail,
    address: customerAddress,
    city: customerCity,
    zipCode: customerZip,
  },
  quote: quoteJson,
};

const res = await fetch(`${appUrl}/api/cli/import-quote`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CLI-Key': apiKey,
  },
  body: JSON.stringify(payload),
});

const data = await res.json();

if (!res.ok) {
  console.error('✗ Import mislukt:', JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(`\n✓ Offerte aangemaakt!`);
console.log(`  Nummer:  ${data.number}`);
console.log(`  Klant:   ${data.customer?.name}`);
console.log(`  URL:     ${appUrl}/quotes/${data.id}`);
