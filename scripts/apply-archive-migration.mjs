/**
 * Handmatige migratie (geen `prisma db push` — zie CLAUDE.md).
 *
 * 1. Voegt `archivedAt` toe aan Quote en Calculation (ADD COLUMN IF NOT EXISTS).
 * 2. Dedupliceert bestaande dubbele nummers per bedrijf: het record met de
 *    zwaarste status blijft, de rest krijgt het eerstvolgende vrije nummer.
 * 3. Legt een unieke index op ("companyId", "number") voor beide tabellen.
 *
 * Draai eerst `node scripts/apply-archive-migration.mjs --plan` om te zien wat
 * er hernummerd wordt. Daarna `--apply`. Alles in --apply zit in één transactie.
 *
 * Vereist alleen `pg` + DATABASE_URL uit .env.local. Werkt op Windows en Linux.
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
    /* geen .env.local — DATABASE_URL moet dan al in de omgeving staan */
  }
}

loadEnvLocal();

const APPLY = process.argv.includes("--apply");
const PLAN = process.argv.includes("--plan") || !APPLY;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ontbreekt (.env.local of omgeving).");
  process.exit(1);
}

const QUOTE_STATUS_WEIGHT = { ACCEPTED: 6, DECLINED: 5, VIEWED: 4, SENT: 3, EXPIRED: 2, DRAFT: 1 };
const CALC_STATUS_WEIGHT = { QUOTED: 3, COMPLETED: 2, DRAFT: 1 };

/** prefix = nummer zonder de laatste cijferreeks; padlengte = lengte van die reeks. */
function splitNumber(number) {
  const m = String(number).match(/^(.*?)(\d+)$/);
  if (!m) return { prefix: number, pad: 0, value: NaN };
  return { prefix: m[1], pad: m[2].length, value: Number(m[2]) };
}

async function planTable(client, { table, weight, minPad }) {
  const { rows } = await client.query(
    `SELECT id, "companyId", number, status, "createdAt",
            (SELECT name FROM "Customer" c WHERE c.id = t."customerId") AS customer_name
     FROM "${table}" t ORDER BY "companyId", number, "createdAt"`,
  );

  // Hoogste bestaande suffix per (companyId, prefix) bijhouden zodat we vrije nummers uitdelen.
  const maxByKey = new Map();
  for (const r of rows) {
    const { prefix, value } = splitNumber(r.number);
    const key = `${r.companyId}::${prefix}`;
    if (Number.isFinite(value)) {
      maxByKey.set(key, Math.max(maxByKey.get(key) ?? 0, value));
    }
  }

  // Groepeer op (companyId, number).
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.companyId}::${r.number}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const renames = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      const w = (weight[b.status] ?? 0) - (weight[a.status] ?? 0);
      if (w !== 0) return w;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    const [keep, ...losers] = sorted;
    for (const loser of losers) {
      const { prefix, pad } = splitNumber(loser.number);
      const key = `${loser.companyId}::${prefix}`;
      const next = (maxByKey.get(key) ?? 0) + 1;
      maxByKey.set(key, next);
      const newNumber = `${prefix}${String(next).padStart(Math.max(pad, minPad), "0")}`;
      renames.push({
        table,
        id: loser.id,
        oldNumber: loser.number,
        newNumber,
        status: loser.status,
        customer: loser.customer_name ?? "—",
        keptId: keep.id,
        keptStatus: keep.status,
      });
    }
  }
  return renames;
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log(`Verbonden. Modus: ${APPLY ? "APPLY" : "PLAN (dry-run)"}\n`);

  try {
    if (APPLY) {
      await client.query("BEGIN");
      await client.query(`ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`);
      await client.query(`ALTER TABLE "Calculation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`);
      console.log("archivedAt toegevoegd aan Quote + Calculation.");
    }

    const quoteRenames = await planTable(client, {
      table: "Quote",
      weight: QUOTE_STATUS_WEIGHT,
      minPad: 4,
    });
    const calcRenames = await planTable(client, {
      table: "Calculation",
      weight: CALC_STATUS_WEIGHT,
      minPad: 3,
    });
    const renames = [...quoteRenames, ...calcRenames];

    if (renames.length === 0) {
      console.log("Geen dubbele nummers gevonden.");
    } else {
      console.log(`${renames.length} record(s) worden hernummerd:\n`);
      for (const r of renames) {
        console.log(
          `  [${r.table}] ${r.oldNumber} -> ${r.newNumber}  (${r.status}, ${r.customer})  ` +
            `| blijft: ${r.keptId} (${r.keptStatus})`,
        );
      }
      console.log();
    }

    if (APPLY) {
      for (const r of renames) {
        await client.query(`UPDATE "${r.table}" SET number = $1 WHERE id = $2`, [r.newNumber, r.id]);
      }
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "Quote_companyId_number_key" ON "Quote"("companyId", "number")`,
      );
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "Calculation_companyId_number_key" ON "Calculation"("companyId", "number")`,
      );
      await client.query("COMMIT");
      console.log("Klaar. Unieke indexen staan. Draai nu: npx prisma generate  (en herstart de dev-server).");
    } else {
      console.log("PLAN klaar. Niets gewijzigd. Draai opnieuw met --apply om door te voeren.");
    }
  } catch (err) {
    if (APPLY) await client.query("ROLLBACK").catch(() => {});
    console.error("\nMislukt, teruggedraaid:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
