/**
 * Draai een handgeschreven SQL-migratie tegen de database in DATABASE_URL.
 *
 *   node scripts/run-migration.mjs scripts/migrations/001_subscriptions_agreements.sql
 *
 * `prisma db push` is verboden in dit project (schema en database zijn eerder
 * uit elkaar gelopen). Migraties zijn daarom handgeschreven, idempotent, en
 * draaien via dit script. Na afloop: `npx prisma generate` en dev-server herstart.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local hoeft niet te bestaan als DATABASE_URL al in de env staat
  }
}

loadEnvLocal();

const file = process.argv[2];
if (!file) {
  console.error("Gebruik: node scripts/run-migration.mjs <pad/naar/migratie.sql>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ontbreekt (.env.local of omgeving).");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), file), "utf8");
const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL).host;
  } catch {
    return "onbekend";
  }
})();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

console.log(`→ ${file}`);
console.log(`→ database host: ${host}`);

await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("✓ migratie toegepast (transactie gecommit)");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("✗ migratie mislukt, teruggedraaid:");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
