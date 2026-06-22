/**
 * Gedeelde Prisma-client voor scripts buiten Next.js.
 * Laadt DATABASE_URL automatisch uit .env.local.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Laad .env.local handmatig (dotenvx is alleen beschikbaar via npx)
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && !key.startsWith('#') && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    }
  } catch {
    // .env.local bestaat niet — DATABASE_URL moet al in env staan
  }
}

loadEnv();

const { PrismaClient } = await import('/home/daan-koolhaas/Documenten/GitHub/offerte-en-calculatie-app/src/generated/prisma/index.js');
const { PrismaPg } = await import('/home/daan-koolhaas/Documenten/GitHub/offerte-en-calculatie-app/node_modules/@prisma/adapter-pg/dist/index.mjs');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ontbreekt. Voeg het toe aan .env.local of stel het in als omgevingsvariabele.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

export async function getCompany(slug) {
  const company = await prisma.company.findFirst({ where: { slug } });
  if (!company) throw new Error(`Company '${slug}' niet gevonden in de database.`);
  return company;
}
