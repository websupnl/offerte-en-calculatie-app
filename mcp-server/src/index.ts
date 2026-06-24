import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import pg from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const { Pool } = pg;

// ─── Database ─────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

const quoteItemInputSchema = z.object({
  description: z.string().describe("Omschrijving van precies één losse offerteregel. Zet geen meerdere onderdelen of bulletlijst in één omschrijving."),
  qty: z.number().default(1).describe("Aantal voor deze ene regel"),
  unit_price: z.number().describe("Prijs per eenheid excl. btw voor deze ene regel. Gebruik 0 alleen voor inhoudelijke pakketregels zonder losse prijs; de offerte toont geen prijs per regel, alleen het totaal incl. btw onder de tabel."),
  cost_price: z.number().optional().describe("Inkoopprijs excl. btw"),
  vat_rate: z.number().default(21).describe("BTW-percentage voor deze ene regel"),
  indent: z.number().min(0).max(1).default(0).describe("Inspringen (1 voor sub-regel)"),
});

const optionalWorkInputSchema = z.object({
  id: z.string().describe("Stabiele unieke slug, bijvoorbeeld backup-gateway"),
  title: z.string().describe("Korte klantgerichte titel"),
  summary: z.string().describe("Maximaal twee korte zinnen; lange specificaties horen in details"),
  tag: z.string().default("Optioneel"),
  price_ex_vat: z.number().min(0).describe("Meerprijs exclusief btw"),
  vat_rate: z.number().default(21),
  details: z.array(z.string()).optional().default([]),
  technical_condition: z.string().optional().describe("Voorwaarde waaronder dit meerwerk technisch toepasbaar is"),
});

const configurationInputSchema = z.object({
  id: z.string().describe("Stabiele unieke slug voor de keuzegroep"),
  title: z.string().describe("Concrete keuzevraag, bijvoorbeeld Kies uw batterijsysteem"),
  description: z.string().optional(),
  recommended_choice_id: z.string().optional(),
  choices: z.array(z.object({
    id: z.string().describe("Stabiele unieke slug voor deze configuratie"),
    label: z.string().optional(),
    title: z.string().describe("Merk/model of duidelijke configuratienaam; nooit Optie 1 of Hoofdregel"),
    summary: z.string().optional().describe("Maximaal twee korte zinnen"),
    tag: z.string().optional(),
    items: z.array(quoteItemInputSchema).min(1),
  })).min(2),
});

function normalizeOptionalWork(options: z.infer<typeof optionalWorkInputSchema>[]) {
  return options.map((option) => ({
    id: option.id,
    t: option.title,
    d: option.summary,
    tag: option.tag,
    price: option.price_ex_vat,
    vatRate: option.vat_rate,
    details: option.details,
    technicalCondition: option.technical_condition,
  }));
}

function normalizeConfigurations(groups: z.infer<typeof configurationInputSchema>[]) {
  return groups.map((group) => ({
    id: group.id,
    title: group.title,
    type: "SINGLE_SELECT" as const,
    description: group.description,
    recommendedChoiceId: group.recommended_choice_id,
    choices: group.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      title: choice.title,
      summary: choice.summary,
      tag: choice.tag,
      items: choice.items.map((item) => ({
        description: item.description,
        qty: item.qty,
        unitPrice: item.unit_price,
        costPrice: item.cost_price,
        vatRate: item.vat_rate,
        indent: item.indent,
      })),
    })),
  }));
}

async function recalculateQuoteTotals(quoteId: string): Promise<void> {
  await query(
    `UPDATE "Quote" SET
      "totalExVat"  = COALESCE((SELECT SUM(qty * "unitPrice") FROM "QuoteItem" WHERE "quoteId" = $1), 0),
      "totalVat"    = COALESCE((SELECT SUM(qty * "unitPrice" * "vatRate" / 100) FROM "QuoteItem" WHERE "quoteId" = $1), 0),
      "totalIncVat" = COALESCE((SELECT SUM(qty * "unitPrice" * (1 + "vatRate" / 100)) FROM "QuoteItem" WHERE "quoteId" = $1), 0),
      "pdfUrl"      = NULL,
      "updatedAt"   = NOW()
     WHERE id = $1`,
    [quoteId]
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateQuoteNumber(companySlug = "websup"): string {
  const now = new Date();
  const yy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  return `${prefix}-${yy}-${mm}-${rand}`;
}

function generateToken(): string {
  return crypto.randomUUID();
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function storeBase64Image(imageBase64: string, mimeType = "image/png"): Promise<string> {
  const ext = MIME_EXTENSIONS[mimeType.toLowerCase()] ?? "png";
  const projectRoot = path.basename(process.cwd()) === "mcp-server"
    ? path.resolve(process.cwd(), "..")
    : process.cwd();
  const uploadDir = path.join(projectRoot, "public", "uploads", "quote-attachments");
  const fileName = `${crypto.randomUUID()}.${ext}`;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), Buffer.from(imageBase64, "base64"));

  return `/uploads/quote-attachments/${fileName}`;
}

function defaultTemplateFields(companySlug: string) {
  if (companySlug === "koolhaas") {
    return {
      title: "Voorstel",
      category: "Installatie",
      tagline: "Levering, montage en inbedrijfstelling",
      itemsHeader: "Inbegrepen werkzaamheden",
      flow: [],
      approach: [],
      options: [],
      exclusions: [],
    };
  }

  return {
    title: "Maatwerk offerte-aanvraagmodule laadpalen",
    category: "Maatwerk module, WordPress",
    tagline: "Ontwerp, bouw en plaatsing",
    itemsHeader: "Prijsopbouw",
    flow: [],
    approach: [],
    options: [],
    exclusions: [],
  };
}

function normalizeQuoteText(value: string): string {
  return value
    .replace(/[\u2012\u2013\u2014\u2015]/g, " - ")
    .replace(/\s*[\u00B7\u2022]\s*/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

function normalizeQuoteValue<T>(value: T): T {
  if (typeof value === "string") return normalizeQuoteText(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeQuoteValue(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeQuoteValue(item)]),
    ) as T;
  }
  return value;
}

// ─── MCP Server factory ────────────────────────────────────────────────────────

function createMcpServer() {
  const server = new McpServer({
    name: "websup-quote-engine",
    version: "1.1.0",
  });

  server.tool(
    "get_quote_contract",
    "Geef de actuele veldbetekenis voor offertes. Gebruik dit vóór create_quote wanneer je twijfelt over basisregels, configuraties of meerwerk.",
    {},
    async () => ({
      content: [{
        type: "text",
        text: JSON.stringify({
          version: "2026-06-20",
          items: "Vaste basis die bij iedere samenstelling hoort.",
          configurations: "Minimaal twee volledige, onderling exclusieve systemen; klant kiest exact één per groep bij akkoord.",
          optional_work: "Los aanvinkbaar meerwerk met expliciete prijs exclusief btw.",
          rules: [
            "Dupliceer prijzen nooit tussen items, configurations en optional_work.",
            "Maak geen placeholders zoals Optie 1, Optie 2, Hoofdregel of Kies uw optie.",
            "Maak geen configuratie of meerwerk wanneer de bron geen echte klantkeuze bevat.",
            "Lever geen totalen aan; de app rekent server-side.",
          ],
        }, null, 2),
      }],
    })
  );

  server.tool(
    "list_companies",
    "Geef een lijst van alle beschikbare bedrijven (websup, koolhaas, etc.)",
    {},
    async () => {
      const companies = await query(
        `SELECT id, name, slug, "createdAt" FROM "Company" ORDER BY name`
      );
      return { content: [{ type: "text", text: JSON.stringify(companies, null, 2) }] };
    }
  );

  server.tool(
    "list_customers",
    "Geef een lijst van klanten voor een bepaald bedrijf (op slug of ID)",
    {
      company_slug: z.string().optional().describe("Bedrijfsslug, bijv. 'websup' of 'koolhaas'"),
      company_id: z.string().optional().describe("Bedrijfs-ID (alternatief voor slug)"),
      search: z.string().optional().describe("Zoekterm op naam of e-mail"),
    },
    async ({ company_slug, company_id, search }) => {
      let cid = company_id;
      if (!cid && company_slug) {
        const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
        if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };
        cid = co.id;
      }
      if (!cid) return { content: [{ type: "text", text: "Geef company_slug of company_id op." }] };

      let sql = `SELECT id, name, email, phone, address, city, "zipCode" FROM "Customer" WHERE "companyId" = $1`;
      const params: unknown[] = [cid];
      if (search) {
        sql += ` AND (LOWER(name) LIKE $2 OR LOWER(email) LIKE $2)`;
        params.push(`%${search.toLowerCase()}%`);
      }
      sql += ` ORDER BY name`;

      const customers = await query(sql, params);
      return { content: [{ type: "text", text: JSON.stringify(customers, null, 2) }] };
    }
  );

  server.tool(
    "create_customer",
    "Maak een nieuwe klant aan voor een bedrijf",
    {
      company_slug: z.string().describe("Bedrijfsslug: 'websup' of 'koolhaas'"),
      name: z.string().describe("Volledige naam of bedrijfsnaam"),
      email: z.string().optional().describe("E-mailadres"),
      phone: z.string().optional().describe("Telefoonnummer"),
      address: z.string().optional().describe("Straat + huisnummer"),
      city: z.string().optional().describe("Stad"),
      zip_code: z.string().optional().describe("Postcode"),
    },
    async ({ company_slug, name, email, phone, address, city, zip_code }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      await query(
        `INSERT INTO "Customer" (id, "companyId", name, email, phone, address, city, "zipCode", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [id, co.id, name, email ?? null, phone ?? null, address ?? null, city ?? null, zip_code ?? null, now]
      );
      return { content: [{ type: "text", text: `Klant aangemaakt! ID: ${id}, Naam: ${name}` }] };
    }
  );

  server.tool(
    "get_customer",
    "Haal details van één klant op, inclusief alle offertes",
    { customer_id: z.string().describe("Klant-ID") },
    async ({ customer_id }) => {
      const customer = await queryOne(
        `SELECT c.*, co.slug AS company_slug FROM "Customer" c
         JOIN "Company" co ON co.id = c."companyId"
         WHERE c.id = $1`,
        [customer_id]
      );
      if (!customer) return { content: [{ type: "text", text: `Klant ${customer_id} niet gevonden.` }] };

      const quotes = await query(
        `SELECT id, number, title, status, "totalIncVat", "createdAt" FROM "Quote"
         WHERE "customerId" = $1 ORDER BY "createdAt" DESC`,
        [customer_id]
      );
      return { content: [{ type: "text", text: JSON.stringify({ ...customer, quotes }, null, 2) }] };
    }
  );

  server.tool(
    "update_customer",
    "Pas klantgegevens aan",
    {
      customer_id: z.string().describe("Klant-ID"),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      zip_code: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ customer_id, name, email, phone, address, city, zip_code, notes }) => {
      const map: Record<string, unknown> = { name, email, phone, address, city, notes };
      if (zip_code !== undefined) map["zipCode"] = zip_code;
      const fields = Object.entries(map).filter(([, v]) => v !== undefined);
      if (fields.length === 0) return { content: [{ type: "text", text: "Geen velden om bij te werken." }] };

      const setClauses = fields.map(([k], i) => `"${k}" = $${i + 2}`);
      await query(
        `UPDATE "Customer" SET ${setClauses.join(", ")}, "updatedAt" = NOW() WHERE id = $1`,
        [customer_id, ...fields.map(([, v]) => v)]
      );
      return { content: [{ type: "text", text: `Klant ${customer_id} bijgewerkt.` }] };
    }
  );

  server.tool(
    "delete_quote",
    "Verwijder een offerte inclusief alle regels en deellinks",
    { quote_id: z.string().describe("Quote ID") },
    async ({ quote_id }) => {
      const quote = await queryOne<{ number: string }>(
        `SELECT number FROM "Quote" WHERE id = $1`, [quote_id]
      );
      if (!quote) return { content: [{ type: "text", text: `Offerte ${quote_id} niet gevonden.` }] };

      await query(`DELETE FROM "Quote" WHERE id = $1`, [quote_id]);
      return { content: [{ type: "text", text: `Offerte ${quote.number} verwijderd.` }] };
    }
  );

  server.tool(
    "list_products",
    "Geef een lijst van producten/diensten voor een bedrijf, optioneel gefilterd op categorie",
    {
      company_slug: z.string().describe("Bedrijfsslug"),
      category: z.string().optional().describe("Filter op categorie"),
      active_only: z.boolean().optional().default(true).describe("Alleen actieve producten"),
    },
    async ({ company_slug, category, active_only }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      let sql = `SELECT id, name, description, category, unit, "basePrice", "vatRate", "costPrice" FROM "Product" WHERE "companyId" = $1`;
      const params: unknown[] = [co.id];
      if (active_only !== false) { sql += ` AND active = true`; }
      if (category) { sql += ` AND LOWER(category) = $${params.length + 1}`; params.push(category.toLowerCase()); }
      sql += ` ORDER BY category, "sortOrder", name`;

      const products = await query(sql, params);
      return { content: [{ type: "text", text: JSON.stringify(products, null, 2) }] };
    }
  );

  server.tool(
    "create_product",
    "Voeg een nieuw product of dienst toe aan de catalogus van een bedrijf",
    {
      company_slug: z.string().describe("Bedrijfsslug"),
      name: z.string().describe("Productnaam"),
      category: z.string().describe("Categorie, bijv. 'Installatie', 'Materiaal', 'Dienst'"),
      description: z.string().optional().describe("Omschrijving"),
      unit: z.string().optional().default("stuk").describe("Eenheid, bijv. 'stuk', 'uur', 'meter'"),
      base_price: z.number().describe("Basisprijs excl. btw"),
      cost_price: z.number().optional().describe("Inkoopprijs excl. btw"),
      vat_rate: z.number().optional().default(21).describe("BTW-percentage"),
      specs: z.record(z.string(), z.unknown()).optional().describe("Extra specs als JSON"),
    },
    async ({ company_slug, name, category, description, unit, base_price, cost_price, vat_rate, specs }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await query(
        `INSERT INTO "Product" (id, "companyId", name, category, description, unit, "basePrice", "costPrice", "vatRate", specs, active, "sortOrder", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,true,0,$11,$11)`,
        [id, co.id, name, category, description ?? null, unit ?? "stuk", base_price.toFixed(2), cost_price ? cost_price.toFixed(2) : null, (vat_rate ?? 21).toFixed(2), JSON.stringify(specs ?? {}), now]
      );
      return { content: [{ type: "text", text: `Product aangemaakt: "${name}" (ID: ${id})` }] };
    }
  );

  server.tool(
    "update_product",
    "Pas een product in de catalogus aan",
    {
      product_id: z.string().describe("Product-ID"),
      name: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      unit: z.string().optional(),
      base_price: z.number().optional(),
      cost_price: z.number().optional(),
      vat_rate: z.number().optional(),
      active: z.boolean().optional().describe("Actief of inactief"),
      specs: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ product_id, name, category, description, unit, base_price, cost_price, vat_rate, active, specs }) => {
      const map: Record<string, unknown> = { name, category, description, unit, active };
      if (base_price !== undefined) map["basePrice"] = base_price.toFixed(2);
      if (cost_price !== undefined) map["costPrice"] = cost_price.toFixed(2);
      if (vat_rate !== undefined) map["vatRate"] = vat_rate.toFixed(2);
      if (specs !== undefined) map["specs"] = JSON.stringify(specs);

      const fields = Object.entries(map).filter(([, v]) => v !== undefined);
      if (fields.length === 0) return { content: [{ type: "text", text: "Geen velden om bij te werken." }] };

      const jsonFields = new Set(["specs"]);
      const setClauses = fields.map(([k], i) => `"${k}" = $${i + 2}${jsonFields.has(k) ? "::jsonb" : ""}`);
      await query(
        `UPDATE "Product" SET ${setClauses.join(", ")}, "updatedAt" = NOW() WHERE id = $1`,
        [product_id, ...fields.map(([, v]) => v)]
      );
      return { content: [{ type: "text", text: `Product ${product_id} bijgewerkt.` }] };
    }
  );

  server.tool(
    "delete_product",
    "Verwijder een product uit de catalogus (alleen als het niet gekoppeld is aan offerteregels)",
    { product_id: z.string().describe("Product-ID") },
    async ({ product_id }) => {
      const product = await queryOne<{ name: string }>(
        `SELECT name FROM "Product" WHERE id = $1`, [product_id]
      );
      if (!product) return { content: [{ type: "text", text: `Product ${product_id} niet gevonden.` }] };

      const inUse = await queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM "QuoteItem" WHERE "productId" = $1`, [product_id]
      );
      if (Number(inUse?.count) > 0) {
        return { content: [{ type: "text", text: `Product "${product.name}" is gekoppeld aan ${inUse?.count} offerteregels. Zet het eerst op inactief met update_product.` }] };
      }

      await query(`DELETE FROM "Product" WHERE id = $1`, [product_id]);
      return { content: [{ type: "text", text: `Product "${product.name}" verwijderd.` }] };
    }
  );

  server.tool(
    "list_product_sets",
    "Geef een overzicht van productsets (standaardpakketten) voor een bedrijf",
    {
      company_slug: z.string().describe("Bedrijfsslug"),
      include_items: z.boolean().optional().default(false).describe("Inclusief de losse producten per set"),
    },
    async ({ company_slug, include_items }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const sets = await query(
        `SELECT id, name, description, category FROM "ProductSet" WHERE "companyId" = $1 AND active = true ORDER BY name`,
        [co.id]
      );

      if (!include_items) {
        return { content: [{ type: "text", text: JSON.stringify(sets, null, 2) }] };
      }

      const result = [];
      for (const set of sets) {
        const items = await query(
          `SELECT p.id AS product_id, p.name, p.category, p."basePrice", p.unit, psi.qty
           FROM "ProductSetItem" psi
           JOIN "Product" p ON p.id = psi."productId"
           WHERE psi."setId" = $1 ORDER BY psi."sortOrder"`,
          [(set as Record<string, unknown>).id]
        );
        result.push({ ...set, items });
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "add_set_to_quote",
    "Voeg alle producten uit een productset in één keer toe aan een offerte. Handig voor standaardpakketten.",
    {
      quote_id: z.string().describe("Quote ID"),
      set_id: z.string().describe("Productset-ID (gebruik list_product_sets om te vinden)"),
      price_override: z.number().optional().describe("Overschrijf de basisprijs van alle items met dit percentage (bijv. 110 = 10% opslag)"),
    },
    async ({ quote_id, set_id, price_override }) => {
      const quote = await queryOne<{ id: string }>(
        `SELECT id FROM "Quote" WHERE id = $1`, [quote_id]
      );
      if (!quote) return { content: [{ type: "text", text: `Offerte ${quote_id} niet gevonden.` }] };

      const items = await query<{ productId: string; name: string; basePrice: string; costPrice: string; vatRate: string; unit: string; qty: string }>(
        `SELECT p.id AS "productId", p.name, p."basePrice", p."costPrice", p."vatRate", p.unit, psi.qty
         FROM "ProductSetItem" psi
         JOIN "Product" p ON p.id = psi."productId"
         WHERE psi."setId" = $1 ORDER BY psi."sortOrder"`,
        [set_id]
      );
      if (items.length === 0) return { content: [{ type: "text", text: `Productset ${set_id} niet gevonden of leeg.` }] };

      const maxSort = await queryOne<{ max: number }>(
        `SELECT COALESCE(MAX("sortOrder"), -1) AS max FROM "QuoteItem" WHERE "quoteId" = $1`, [quote_id]
      );
      let sortOrder = (maxSort?.max ?? -1) + 1;

      for (const item of items) {
        const basePrice = Number(item.basePrice);
        const unitPrice = price_override ? basePrice * (price_override / 100) : basePrice;
        const qty = Number(item.qty);
        const vatRate = Number(item.vatRate);
        await query(
          `INSERT INTO "QuoteItem" (id, "quoteId", "productId", description, qty, "unitPrice", "vatRate", total, "sortOrder", "costPrice", indent, "choiceGroupId")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [crypto.randomUUID(), quote_id, item.productId, item.name,
           qty.toFixed(2), unitPrice.toFixed(2), vatRate.toFixed(2),
           (qty * unitPrice).toFixed(2), sortOrder++, item.costPrice ? Number(item.costPrice).toFixed(2) : null, 0, null]
        );
      }

      await query(
        `UPDATE "Quote" SET
          "totalExVat"  = (SELECT SUM(qty * "unitPrice") FROM "QuoteItem" WHERE "quoteId" = $1),
          "totalVat"    = (SELECT SUM(qty * "unitPrice" * "vatRate" / 100) FROM "QuoteItem" WHERE "quoteId" = $1),
          "totalIncVat" = (SELECT SUM(qty * "unitPrice" * (1 + "vatRate" / 100)) FROM "QuoteItem" WHERE "quoteId" = $1),
          "updatedAt"   = NOW()
         WHERE id = $1`,
        [quote_id]
      );

      return { content: [{ type: "text", text: `${items.length} producten uit de set toegevoegd aan offerte ${quote_id}. Totalen herberekend.` }] };
    }
  );

  server.tool(
    "create_quote",
    "Maak een volledige offerte volgens hetzelfde contract als de plakimport. items bevat alleen de vaste basis. Zet volledige alternatieve systemen in configurations en selecteerbaar meerwerk in optional_work. Dubbel prijzen nooit tussen items, configurations en optional_work. Maak geen placeholders of verzonnen keuzes.",
    {
      company_slug: z.string().describe("Bedrijfsslug: 'websup' of 'koolhaas'"),
      customer_id: z.string().describe("ID van de klant (gebruik list_customers om te vinden)"),
      title: z.string().optional().default("Persoonlijk voorstel").describe("Titel van de offerte"),
      category: z.string().optional().default("Maatwerk project").describe("Categorie/type project"),
      tagline: z.string().optional().describe("Korte ondertitel. Gebruik komma's, geen middelpunttekens of lange streeptekens."),
      itemsHeader: z.string().optional().describe("Korte neutrale titel voor de prijstabel."),
      intro: z.string().optional().describe("Persoonlijke inleidende brief namens Daan Koolhaas. Begin met 'Beste [klantnaam],' en bedank voor de aanvraag. Schrijf in ik-vorm, niet als generieke technische samenvatting. Geen adres, bronnen, compatibiliteitslijst of voorwaarden hierin."),
      outro: z.string().optional().describe("Slottekst"),
      notes: z.string().optional().describe("Opmerkingen/interne of zichtbare notities"),
      quote_type: z.string().optional().default("GENERAL").describe("Type offerte (GENERAL, BATTERY, SOLAR, WEB)"),
      flow: z.array(z.object({ n: z.number(), t: z.string(), d: z.string() })).optional().describe("Processtappen voor pagina 3"),
      approach: z.array(z.object({ n: z.string(), t: z.string(), d: z.string() })).optional().describe("Werkwijze/fases voor pagina 3"),
      optional_work: z.array(optionalWorkInputSchema).optional().describe("Selecteerbaar optioneel meerwerk met expliciete meerprijs. Laat leeg als er geen echte uitbreiding is."),
      exclusions: z.array(z.string()).optional().describe("Wat niet binnen de offerte valt, als rustige concrete tekstregels. Zet hier beperkingen, voorwaarden en buiten-scope werk."),
      assumptions: z.array(z.string()).optional().describe("Uitgangspunten voor deze offerte. Zet hier technische basis, adres/situatie alleen wanneer relevant, compatibiliteit en aannames."),
      technical_notes: z.array(z.string()).optional().describe("Technische notities/randvoorwaarden die zichtbaar als uitgangspunten mogen worden getoond."),
      customer_responsibilities: z.array(z.string()).optional().describe("Verantwoordelijkheden van de klant"),
      planning: z.object({
        leadTime: z.string().optional(),
        executionDuration: z.string().optional(),
        preferredDate: z.string().optional(),
      }).optional().describe("Planning informatie"),
      commercial: z.object({
        validDays: z.number().optional(),
        paymentTerms: z.string().optional(),
        warranty: z.string().optional(),
      }).optional().describe("Commerciële voorwaarden"),
      battery_advice: z.object({
        nominalCapacityKwh: z.number().optional(),
        usableCapacityKwh: z.number().optional(),
        backupReservePercent: z.number().optional(),
        chargePowerKw: z.number().optional(),
        recommendedScenario: z.string().optional(),
      }).optional().describe("Thuisbatterij adviesgegevens"),
      configurations: z.array(configurationInputSchema).optional().describe("Volledige, onderling exclusieve systeemconfiguraties. Minimaal twee echte keuzes; laat anders leeg."),
      internal_advice: z.string().optional().describe("Uitgebreid blok met technisch advies (intern)"),
      valid_days: z.number().optional().default(30).describe("Geldigheidsduur in dagen"),
      attachments: z.array(z.object({
        image_url: z.string().optional().describe("Publieke image URL of data-URI"),
        live_url: z.string().optional().describe("Optionele live demo/prototype URL"),
        image_base64: z.string().optional().describe("Ruwe base64 van een afbeelding"),
        mime_type: z.string().optional().default("image/png").describe("MIME type"),
        title: z.string().optional().describe("Titel"),
        caption: z.string().optional().describe("Caption"),
      })).optional().describe("Optionele ontwerpen/mockups"),
      items: z.array(quoteItemInputSchema).describe("Offerteregels. Gebruik geen losse prijzen voor pakketonderdelen; één hoofdregel met prijs, daarna nulprijsregels voor inhoudelijke onderdelen."),
    },
    async ({ 
      company_slug, customer_id, title, category, tagline, itemsHeader, intro, outro, notes, 
      quote_type, flow, approach, optional_work, exclusions, assumptions, technical_notes,
      customer_responsibilities, planning, commercial, battery_advice, configurations,
      internal_advice, valid_days, attachments, items
    }) => {
      const defaults = defaultTemplateFields(company_slug);
      const quoteTitle = normalizeQuoteText(title === "Persoonlijk voorstel" ? defaults.title : title);
      const quoteCategory = normalizeQuoteText(category === "Maatwerk project" ? defaults.category : category);
      const quoteTagline = normalizeQuoteText(tagline ?? defaults.tagline);
      const quoteItemsHeader = normalizeQuoteText(itemsHeader ?? defaults.itemsHeader);
      const quoteFlow = normalizeQuoteValue(flow ?? defaults.flow);
      const quoteApproach = normalizeQuoteValue(approach ?? defaults.approach);
      const quoteOptions = normalizeQuoteValue(normalizeOptionalWork(optional_work ?? []));
      const quoteConfigurations = normalizeQuoteValue(normalizeConfigurations(configurations ?? []));
      const quoteExclusions = normalizeQuoteValue(exclusions ?? defaults.exclusions);
      const normalizedItems = normalizeQuoteValue(items);

      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const user = await queryOne<{ id: string }>(
        `SELECT u.id FROM "User" u
         JOIN "CompanyUser" cu ON cu."userId" = u.id
         WHERE cu."companyId" = $1
         ORDER BY u."createdAt" LIMIT 1`,
        [co.id]
      );
      if (!user) return { content: [{ type: "text", text: "Geen gebruiker gevonden voor dit bedrijf." }] };

      let totalExVat = 0;
      let totalVat = 0;
      for (const item of normalizedItems) {
        const lineTotal = item.qty * item.unit_price;
        totalExVat += lineTotal;
        totalVat += lineTotal * (item.vat_rate / 100);
      }
      for (const group of quoteConfigurations) {
        const recommended =
          group.choices.find((choice) => choice.id === group.recommendedChoiceId) ??
          group.choices[0];
        if (!recommended) continue;
        for (const item of recommended.items) {
          const lineTotal = item.qty * item.unitPrice;
          totalExVat += lineTotal;
          totalVat += lineTotal * (item.vatRate / 100);
        }
      }
      const totalIncVat = totalExVat + totalVat;

      const now = new Date().toISOString();
      const validUntilDate = new Date(Date.now() + (valid_days ?? 30) * 86400000).toISOString();
      const quoteId = crypto.randomUUID();
      const number = generateQuoteNumber(company_slug);

      await query(
        `INSERT INTO "Quote" (id, "companyId", "customerId", "createdById", number, title, category, tagline,
          "itemsHeader", intro, outro, notes, flow, approach, options, exclusions, status, "validUntil",
          "totalExVat", "totalVat", "totalIncVat", "quoteType", assumptions, "technicalNotes", 
          "customerResponsibilities", planning, commercial, "batteryAdvice", "choiceGroups", "internalAdvice",
          "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,'DRAFT',$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb,$27::jsonb,$28::jsonb,$29,$30,$30)`,
        [quoteId, co.id, customer_id, user.id, number, quoteTitle, quoteCategory,
         quoteTagline, quoteItemsHeader, normalizeQuoteValue(intro ?? null), normalizeQuoteValue(outro ?? null), normalizeQuoteValue(notes ?? null),
         JSON.stringify(quoteFlow), JSON.stringify(quoteApproach), JSON.stringify(quoteOptions), JSON.stringify(quoteExclusions),
         validUntilDate, totalExVat.toFixed(2), totalVat.toFixed(2), totalIncVat.toFixed(2),
         quote_type ?? 'GENERAL', JSON.stringify(normalizeQuoteValue(assumptions ?? [])), JSON.stringify(normalizeQuoteValue(technical_notes ?? [])),
         JSON.stringify(normalizeQuoteValue(customer_responsibilities ?? [])), JSON.stringify(normalizeQuoteValue(planning ?? {})), JSON.stringify(normalizeQuoteValue(commercial ?? {})),
         JSON.stringify(normalizeQuoteValue(battery_advice ?? {})), JSON.stringify(quoteConfigurations), normalizeQuoteValue(internal_advice ?? null), now]
      );

      for (let i = 0; i < normalizedItems.length; i++) {
        const item = normalizedItems[i];
        const lineTotal = item.qty * item.unit_price;
        await query(
          `INSERT INTO "QuoteItem" (id, "quoteId", description, qty, "unitPrice", "vatRate", total, "sortOrder", "costPrice", indent, "choiceGroupId")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [crypto.randomUUID(), quoteId, item.description,
           item.qty.toFixed(2), item.unit_price.toFixed(2),
           item.vat_rate.toFixed(2), lineTotal.toFixed(2), i,
           item.cost_price ? item.cost_price.toFixed(2) : null, item.indent ?? 0, null]
        );
      }

      if (attachments?.length) {
        for (let i = 0; i < attachments.length; i++) {
          const attachment = attachments[i];
          const imageUrl = attachment.image_url ?? (
            attachment.image_base64 ? await storeBase64Image(attachment.image_base64, attachment.mime_type) : null
          );
          if (!imageUrl) continue;
          await query(
            `INSERT INTO "QuoteAttachment" (id, "quoteId", title, "imageUrl", "liveUrl", caption, "sortOrder", "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
            [crypto.randomUUID(), quoteId, attachment.title ?? null, imageUrl, attachment.live_url ?? null, attachment.caption ?? null, i, now]
          );
        }
      }

      return {
        content: [{
          type: "text",
          text: `Offerte aangemaakt!\nNummer: ${number}\nID: ${quoteId}\nTotaal excl. btw: €${totalExVat.toFixed(2)}\nTotaal incl. btw: €${totalIncVat.toFixed(2)}`,
        }],
      };
    }
  );

  server.tool(
    "list_quotes",
    "Geef een overzicht van offertes voor een bedrijf",
    {
      company_slug: z.string().describe("Bedrijfsslug"),
      status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"]).optional().describe("Filter op status"),
      limit: z.number().optional().default(20).describe("Max aantal resultaten"),
    },
    async ({ company_slug, status, limit }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      let sql = `
        SELECT q.id, q.number, q.title, q.status, q."totalIncVat", q."createdAt", q."validUntil",
               c.name AS customer_name, c.email AS customer_email
        FROM "Quote" q
        JOIN "Customer" c ON c.id = q."customerId"
        WHERE q."companyId" = $1
      `;
      const params: unknown[] = [co.id];
      if (status) { sql += ` AND q.status = $2`; params.push(status); }
      sql += ` ORDER BY q."createdAt" DESC LIMIT $${params.length + 1}`;
      params.push(limit ?? 20);

      const quotes = await query(sql, params);
      return { content: [{ type: "text", text: JSON.stringify(quotes, null, 2) }] };
    }
  );

  server.tool(
    "get_quote",
    "Haal alle details van een offerte op, inclusief regels en klantgegevens",
    { quote_id: z.string().describe("Quote ID") },
    async ({ quote_id }) => {
      const quote = await queryOne(
        `SELECT q.*, c.name AS customer_name, c.email AS customer_email,
                c.address AS customer_address, c.city AS customer_city,
                co.name AS company_name, co.slug AS company_slug
         FROM "Quote" q
         JOIN "Customer" c ON c.id = q."customerId"
         JOIN "Company" co ON co.id = q."companyId"
         WHERE q.id = $1`,
        [quote_id]
      );
      if (!quote) return { content: [{ type: "text", text: `Offerte ${quote_id} niet gevonden.` }] };

      const items = await query(
        `SELECT id, description, qty, "unitPrice", "vatRate", total, "sortOrder", "costPrice", indent, "choiceGroupId"
         FROM "QuoteItem" WHERE "quoteId" = $1 ORDER BY "sortOrder"`,
        [quote_id]
      );
      const attachments = await query(
        `SELECT id, title, "imageUrl", caption, "sortOrder", "createdAt"
         FROM "QuoteAttachment" WHERE "quoteId" = $1 ORDER BY "sortOrder"`,
        [quote_id]
      );
      const share = await queryOne(
        `SELECT token, "acceptedAt", "declinedAt", "viewedAt" FROM "QuoteShare" WHERE "quoteId" = $1`,
        [quote_id]
      );

      return { content: [{ type: "text", text: JSON.stringify({ ...quote, items, attachments, share }, null, 2) }] };
    }
  );

  server.tool(
    "add_quote_attachment",
    "Voeg een ontwerp/mockup/screenshot toe aan een offerte. Gebruik image_url voor publieke URLs of image_base64 voor uploads uit de chat.",
    {
      quote_id: z.string().describe("Quote ID"),
      image_url: z.string().optional().describe("Publieke image URL of data-URI"),
      image_base64: z.string().optional().describe("Ruwe base64 afbeelding; wordt opgeslagen als bestand in public/uploads"),
      mime_type: z.string().optional().default("image/png").describe("MIME type bij image_base64"),
      title: z.string().optional().describe("Titel"),
      caption: z.string().optional().describe("Caption onder de afbeelding"),
    },
    async ({ quote_id, image_url, image_base64, mime_type, title, caption }) => {
      const quote = await queryOne<{ id: string }>(`SELECT id FROM "Quote" WHERE id = $1`, [quote_id]);
      if (!quote) return { content: [{ type: "text", text: `Offerte ${quote_id} niet gevonden.` }] };

      const imageUrl = image_url ?? (image_base64 ? await storeBase64Image(image_base64, mime_type) : null);
      if (!imageUrl) return { content: [{ type: "text", text: "Geef image_url of image_base64 mee." }] };

      const maxSort = await queryOne<{ max: number }>(
        `SELECT COALESCE(MAX("sortOrder"), -1) AS max FROM "QuoteAttachment" WHERE "quoteId" = $1`,
        [quote_id]
      );
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await query(
        `INSERT INTO "QuoteAttachment" (id, "quoteId", title, "imageUrl", caption, "sortOrder", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
        [id, quote_id, title ?? null, imageUrl, caption ?? null, (maxSort?.max ?? -1) + 1, now]
      );
      await query(`UPDATE "Quote" SET "pdfUrl" = NULL, "updatedAt" = NOW() WHERE id = $1`, [quote_id]);

      return { content: [{ type: "text", text: `Ontwerp toegevoegd aan offerte ${quote_id}. Attachment ID: ${id}` }] };
    }
  );

  server.tool(
    "list_quote_attachments",
    "Toon alle ontwerp/mockup-afbeeldingen bij een offerte.",
    { quote_id: z.string().describe("Quote ID") },
    async ({ quote_id }) => {
      const attachments = await query(
        `SELECT id, title, "imageUrl", caption, "sortOrder", "createdAt"
         FROM "QuoteAttachment" WHERE "quoteId" = $1 ORDER BY "sortOrder"`,
        [quote_id]
      );
      return { content: [{ type: "text", text: JSON.stringify(attachments, null, 2) }] };
    }
  );

  server.tool(
    "remove_quote_attachment",
    "Verwijder een ontwerp/mockup-afbeelding uit een offerte.",
    { attachment_id: z.string().describe("Attachment ID") },
    async ({ attachment_id }) => {
      const attachment = await queryOne<{ id: string; quoteId: string; title: string | null }>(
        `SELECT id, "quoteId", title FROM "QuoteAttachment" WHERE id = $1`,
        [attachment_id]
      );
      if (!attachment) return { content: [{ type: "text", text: `Attachment ${attachment_id} niet gevonden.` }] };

      await query(`DELETE FROM "QuoteAttachment" WHERE id = $1`, [attachment_id]);
      await query(`UPDATE "Quote" SET "pdfUrl" = NULL, "updatedAt" = NOW() WHERE id = $1`, [attachment.quoteId]);

      return { content: [{ type: "text", text: `Ontwerp verwijderd: ${attachment.title ?? attachment_id}` }] };
    }
  );

  server.tool(
    "update_quote",
    "Pas velden van een bestaande offerte aan (titel, intro, status, technische details, etc.)",
    {
      quote_id: z.string().describe("Quote ID"),
      title: z.string().optional(),
      category: z.string().optional(),
      tagline: z.string().optional(),
      itemsHeader: z.string().optional(),
      intro: z.string().optional(),
      outro: z.string().optional(),
      status: z.enum(["DRAFT", "SENT", "VIEWED", "DECLINED", "EXPIRED"]).optional().describe("ACCEPTED wordt uitsluitend door digitaal klantakkoord gezet"),
      notes: z.string().optional(),
      quote_type: z.string().optional(),
      flow: z.array(z.object({ n: z.number(), t: z.string(), d: z.string() })).optional(),
      approach: z.array(z.object({ n: z.string(), t: z.string(), d: z.string() })).optional(),
      optional_work: z.array(optionalWorkInputSchema).optional(),
      exclusions: z.array(z.string()).optional(),
      assumptions: z.array(z.string()).optional(),
      technical_notes: z.array(z.string()).optional(),
      customer_responsibilities: z.array(z.string()).optional(),
      planning: z.record(z.string(), z.unknown()).optional(),
      commercial: z.record(z.string(), z.unknown()).optional(),
      battery_advice: z.record(z.string(), z.unknown()).optional(),
      configurations: z.array(configurationInputSchema).optional(),
      internal_advice: z.string().optional(),
    },
    async ({ quote_id, ...updates }) => {
      const map: Record<string, unknown> = normalizeQuoteValue({ ...updates });
      
      // Map underscores to camelCase for DB
      if (updates.quote_type !== undefined) { map["quoteType"] = updates.quote_type; delete map.quote_type; }
      if (updates.technical_notes !== undefined) { map["technicalNotes"] = updates.technical_notes; delete map.technical_notes; }
      if (updates.customer_responsibilities !== undefined) { map["customerResponsibilities"] = updates.customer_responsibilities; delete map.customer_responsibilities; }
      if (updates.battery_advice !== undefined) { map["batteryAdvice"] = updates.battery_advice; delete map.battery_advice; }
      if (updates.optional_work !== undefined) { map.options = normalizeOptionalWork(updates.optional_work); delete map.optional_work; }
      if (updates.configurations !== undefined) { map["choiceGroups"] = normalizeConfigurations(updates.configurations); delete map.configurations; }
      if (updates.internal_advice !== undefined) { map["internalAdvice"] = updates.internal_advice; delete map.internal_advice; }

      const fields = Object.entries(map).filter(([, v]) => v !== undefined);
      if (fields.length === 0) return { content: [{ type: "text", text: "Geen velden om bij te werken." }] };

      const jsonFields = new Set(["flow", "approach", "options", "exclusions", "assumptions", "technicalNotes", "customerResponsibilities", "planning", "commercial", "batteryAdvice", "choiceGroups"]);
      const setClauses = fields.map(([k], i) => `"${k}" = $${i + 2}${jsonFields.has(k) ? "::jsonb" : ""}`);
      const values = [
        quote_id,
        ...fields.map(([k, v]) => (jsonFields.has(k) ? JSON.stringify(v) : v)),
      ];

      await query(
        `UPDATE "Quote" SET ${setClauses.join(", ")}, "updatedAt" = NOW() WHERE id = $1`,
        values
      );

      return { content: [{ type: "text", text: `Offerte ${quote_id} bijgewerkt.` }] };
    }
  );

  server.tool(
    "share_quote",
    "Maak een deelbare portaallink voor een offerte (of haal de bestaande op)",
    { quote_id: z.string().describe("Quote ID") },
    async ({ quote_id }) => {
      const quote = await queryOne<{ id: string; status: string }>(
        `SELECT id, status FROM "Quote" WHERE id = $1`,
        [quote_id]
      );
      if (!quote) return { content: [{ type: "text", text: `Offerte ${quote_id} niet gevonden.` }] };

      const existing = await queryOne<{ token: string }>(
        `SELECT token FROM "QuoteShare" WHERE "quoteId" = $1`,
        [quote_id]
      );

      if (existing) {
        return { content: [{ type: "text", text: `Bestaande deellink: /q/${existing.token}` }] };
      }

      const token = generateToken();
      const now = new Date().toISOString();
      await query(
        `INSERT INTO "QuoteShare" (id, "quoteId", token, "createdAt") VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), quote_id, token, now]
      );
      await query(
        `UPDATE "Quote" SET status = 'SENT', "updatedAt" = NOW() WHERE id = $1 AND status = 'DRAFT'`,
        [quote_id]
      );

      return { content: [{ type: "text", text: `Deellink aangemaakt!\nPortaal: /q/${token}` }] };
    }
  );

  server.tool(
    "add_quote_item",
    "Voeg één offerteregel toe aan een bestaande offerte en herbereken de totalen. Gebruik unit_price 0 voor een inbegrepen subregel die zonder €0,00 wordt getoond. Gebruik add_quote_items wanneer je meerdere onderdelen tegelijk hebt.",
    {
      quote_id: z.string().describe("Quote ID"),
      description: z.string().describe("Omschrijving van precies één losse offerteregel. Geen bulletlijst of meerdere onderdelen in één tekst."),
      qty: z.number().default(1).describe("Aantal"),
      unit_price: z.number().describe("Prijs excl. btw. Gebruik 0 voor inbegrepen subregels; de offerte toont dan 'Inbegrepen' in plaats van €0,00."),
      cost_price: z.number().optional().describe("Inkoopprijs excl. btw"),
      vat_rate: z.number().default(21).describe("BTW-percentage"),
      indent: z.number().min(0).max(1).default(0).describe("Inspringen (1 voor sub-regel)"),
    },
    async ({ quote_id, description, qty, unit_price, cost_price, vat_rate, indent }) => {
      const quote = await queryOne<{ id: string }>(`SELECT id FROM "Quote" WHERE id = $1`, [quote_id]);
      if (!quote) return { content: [{ type: "text", text: `Offerte ${quote_id} niet gevonden.` }] };

      const lineTotal = qty * unit_price;
      const lineVat = lineTotal * (vat_rate / 100);

      const maxSort = await queryOne<{ max: number }>(
        `SELECT COALESCE(MAX("sortOrder"), -1) AS max FROM "QuoteItem" WHERE "quoteId" = $1`,
        [quote_id]
      );

      await query(
        `INSERT INTO "QuoteItem" (id, "quoteId", description, qty, "unitPrice", "vatRate", total, "sortOrder", "costPrice", indent, "choiceGroupId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [crypto.randomUUID(), quote_id, description,
         qty.toFixed(2), unit_price.toFixed(2), vat_rate.toFixed(2),
         lineTotal.toFixed(2), (maxSort?.max ?? -1) + 1,
         cost_price ? cost_price.toFixed(2) : null, indent ?? 0, null]
      );

      await recalculateQuoteTotals(quote_id);

      return {
        content: [{
          type: "text",
          text: `Regel toegevoegd: "${description}" — €${lineTotal.toFixed(2)} excl. btw (+ €${lineVat.toFixed(2)} btw). Totalen herberekend.`,
        }],
      };
    }
  );

  server.tool(
    "add_quote_items",
    "Voeg meerdere losse offerteregels toe aan een bestaande offerte. Gebruik deze tool voor lijsten met onderdelen/materialen/diensten; elk onderdeel moet een apart item in items[] zijn. Voor pakketten: één betaalde hoofdregel, daarna inbegrepen subregels met unit_price 0.",
    {
      quote_id: z.string().describe("Quote ID"),
      items: z.array(quoteItemInputSchema).min(1).describe("Meerdere losse offerteregels. Maak voor elk onderdeel een apart object. Gebruik unit_price 0 voor inbegrepen subregels zodat er geen €0,00 in de offerte staat."),
    },
    async ({ quote_id, items }) => {
      const quote = await queryOne<{ id: string }>(`SELECT id FROM "Quote" WHERE id = $1`, [quote_id]);
      if (!quote) return { content: [{ type: "text", text: `Offerte ${quote_id} niet gevonden.` }] };

      const maxSort = await queryOne<{ max: number }>(
        `SELECT COALESCE(MAX("sortOrder"), -1) AS max FROM "QuoteItem" WHERE "quoteId" = $1`,
        [quote_id]
      );
      let sortOrder = (maxSort?.max ?? -1) + 1;
      let addedTotal = 0;

      for (const item of items) {
        const lineTotal = item.qty * item.unit_price;
        addedTotal += lineTotal;
        await query(
          `INSERT INTO "QuoteItem" (id, "quoteId", description, qty, "unitPrice", "vatRate", total, "sortOrder", "costPrice", indent, "choiceGroupId")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [crypto.randomUUID(), quote_id, item.description,
           item.qty.toFixed(2), item.unit_price.toFixed(2),
           item.vat_rate.toFixed(2), lineTotal.toFixed(2), sortOrder++,
           item.cost_price ? item.cost_price.toFixed(2) : null, item.indent ?? 0, null]
        );
      }

      await recalculateQuoteTotals(quote_id);

      return {
        content: [{
          type: "text",
          text: `${items.length} losse offerteregels toegevoegd. Totaal toegevoegd excl. btw: €${addedTotal.toFixed(2)}. Totalen herberekend.`,
        }],
      };
    }
  );

  server.tool(
    "update_quote_item",
    "Pas een bestaande offerteregel aan (omschrijving, aantal, prijs, btw, inspringen, keuze-groep). Herberekent automatisch de totalen.",
    {
      item_id: z.string().describe("ID van de offerteregel"),
      description: z.string().optional().describe("Nieuwe omschrijving"),
      qty: z.number().optional().describe("Nieuw aantal"),
      unit_price: z.number().optional().describe("Nieuwe prijs excl. btw"),
      cost_price: z.number().optional().describe("Nieuwe inkoopprijs excl. btw"),
      vat_rate: z.number().optional().describe("Nieuw BTW-percentage"),
      indent: z.number().min(0).max(1).optional().describe("Inspringen"),
    },
    async ({ item_id, description, qty, unit_price, cost_price, vat_rate, indent }) => {
      const item = await queryOne<{ id: string; quoteId: string; qty: string; unitPrice: string; vatRate: string }>(
        `SELECT id, "quoteId", qty, "unitPrice", "vatRate" FROM "QuoteItem" WHERE id = $1`,
        [item_id]
      );
      if (!item) return { content: [{ type: "text", text: `Offerteregel ${item_id} niet gevonden.` }] };

      const fields: string[] = [];
      const params: unknown[] = [item_id];
      if (description !== undefined) { fields.push(`description = $${params.length + 1}`); params.push(description); }
      if (qty !== undefined) { fields.push(`qty = $${params.length + 1}`); params.push(qty.toFixed(2)); }
      if (unit_price !== undefined) { fields.push(`"unitPrice" = $${params.length + 1}`); params.push(unit_price.toFixed(2)); }
      if (cost_price !== undefined) { fields.push(`"costPrice" = $${params.length + 1}`); params.push(cost_price.toFixed(2)); }
      if (vat_rate !== undefined) { fields.push(`"vatRate" = $${params.length + 1}`); params.push(vat_rate.toFixed(2)); }
      if (indent !== undefined) { fields.push(`indent = $${params.length + 1}`); params.push(indent); }

      if (fields.length === 0) return { content: [{ type: "text", text: "Geen velden om bij te werken." }] };

      // Herbereken total op basis van nieuwe of bestaande waarden
      const newQty = qty ?? Number(item.qty);
      const newPrice = unit_price ?? Number(item.unitPrice);
      fields.push(`total = $${params.length + 1}`);
      params.push((newQty * newPrice).toFixed(2));

      await query(`UPDATE "QuoteItem" SET ${fields.join(", ")} WHERE id = $1`, params);

      await recalculateQuoteTotals(item.quoteId);

      return { content: [{ type: "text", text: `Offerteregel bijgewerkt en totalen herberekend.` }] };
    }
  );

  server.tool(
    "delete_quote_item",
    "Verwijder een offerteregel en herbereken de totalen.",
    {
      item_id: z.string().describe("ID van de offerteregel"),
    },
    async ({ item_id }) => {
      const item = await queryOne<{ quoteId: string; description: string }>(
        `SELECT "quoteId", description FROM "QuoteItem" WHERE id = $1`,
        [item_id]
      );
      if (!item) return { content: [{ type: "text", text: `Offerteregel ${item_id} niet gevonden.` }] };

      await query(`DELETE FROM "QuoteItem" WHERE id = $1`, [item_id]);

      await query(
        `UPDATE "Quote" SET
          "totalExVat"  = COALESCE((SELECT SUM(qty * "unitPrice") FROM "QuoteItem" WHERE "quoteId" = $1), 0),
          "totalVat"    = COALESCE((SELECT SUM(qty * "unitPrice" * "vatRate" / 100) FROM "QuoteItem" WHERE "quoteId" = $1), 0),
          "totalIncVat" = COALESCE((SELECT SUM(qty * "unitPrice" * (1 + "vatRate" / 100)) FROM "QuoteItem" WHERE "quoteId" = $1), 0),
          "updatedAt"   = NOW()
         WHERE id = $1`,
        [item.quoteId]
      );

      return { content: [{ type: "text", text: `Regel "${item.description}" verwijderd en totalen herberekend.` }] };
    }
  );

  server.tool(
    "get_stats",
    "Haal statistieken op voor een bedrijf: aantal offertes per status, totaalwaarde, klanten",
    { company_slug: z.string().describe("Bedrijfsslug") },
    async ({ company_slug }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const [statusStats, customerCount, totalValue] = await Promise.all([
        query(`SELECT status, COUNT(*) AS count FROM "Quote" WHERE "companyId" = $1 GROUP BY status`, [co.id]),
        queryOne<{ count: string }>(`SELECT COUNT(*) AS count FROM "Customer" WHERE "companyId" = $1`, [co.id]),
        queryOne<{ total: string }>(
          `SELECT COALESCE(SUM("totalIncVat"), 0) AS total FROM "Quote"
           WHERE "companyId" = $1 AND status IN ('SENT','VIEWED','ACCEPTED')`,
          [co.id]
        ),
      ]);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            offertes_per_status: statusStats,
            totaal_klanten: customerCount?.count ?? 0,
            totaalwaarde_openstaand: `€${Number(totalValue?.total ?? 0).toFixed(2)}`,
          }, null, 2),
        }],
      };
    }
  );

  // ── save_datasheets_batch ─────────────────────────────────────────────────
  server.tool(
    "save_datasheets_batch",
    "Sla meerdere productdatasheets tegelijk op. Gebruik dit na onderzoek voor een offerte waarbij je meerdere componenten hebt gevonden (batterij, omvormer, kabels, interfaces, etc.).",
    {
      company_slug: z.string().describe("Bedrijfsslug: 'websup' of 'koolhaas' — datasheets worden per werkruimte gescheiden"),
      datasheets: z.array(z.object({
        brand: z.string().describe("Merk"),
        model: z.string().describe("Modelnaam"),
        category: z.string().optional().describe("Categorie, bijv. 'batterij', 'omvormer', 'laadpaal', 'kabel', 'interface'"),
        specs: z.record(z.string(), z.unknown()).optional().describe("Technische specs als JSON"),
        notes: z.string().optional().describe("Bevindingen, aandachtspunten, compatibiliteit"),
        price: z.number().optional().describe("Inkoopprijs excl. btw"),
        source_url: z.string().optional().describe("Bron URL"),
      })).describe("Lijst van datasheets om op te slaan"),
    },
    async ({ company_slug, datasheets }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const results: string[] = [];
      const now = new Date().toISOString();

      for (const ds of datasheets) {
        const existing = await queryOne<{ id: string }>(
          `SELECT id FROM "Datasheet" WHERE "companyId" = $1 AND LOWER(brand) = LOWER($2) AND LOWER(model) = LOWER($3)`,
          [co.id, ds.brand, ds.model]
        );

        if (existing) {
          const updates: string[] = ['"updatedAt" = $4'];
          const params: unknown[] = [co.id, ds.brand, ds.model, now];
          if (ds.category !== undefined) { updates.push(`category = $${params.length + 1}`); params.push(ds.category); }
          if (ds.specs !== undefined) { updates.push(`specs = $${params.length + 1}::jsonb`); params.push(JSON.stringify(ds.specs)); }
          if (ds.notes !== undefined) { updates.push(`notes = $${params.length + 1}`); params.push(ds.notes); }
          if (ds.price !== undefined) { updates.push(`price = $${params.length + 1}`); params.push(ds.price); }
          if (ds.source_url !== undefined) { updates.push(`"sourceUrl" = $${params.length + 1}`); params.push(ds.source_url); }
          await query(`UPDATE "Datasheet" SET ${updates.join(", ")} WHERE "companyId" = $1 AND LOWER(brand) = LOWER($2) AND LOWER(model) = LOWER($3)`, params);
          results.push(`Bijgewerkt: ${ds.brand} ${ds.model}`);
        } else {
          const id = crypto.randomUUID();
          await query(
            `INSERT INTO "Datasheet" (id, "companyId", brand, model, category, specs, notes, price, "sourceUrl", "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$10)`,
            [id, co.id, ds.brand, ds.model, ds.category ?? null, JSON.stringify(ds.specs ?? {}), ds.notes ?? null, ds.price ?? null, ds.source_url ?? null, now]
          );
          results.push(`Nieuw: ${ds.brand} ${ds.model}`);
        }
      }

      return { content: [{ type: "text", text: `${results.length} datasheets verwerkt:\n${results.join("\n")}` }] };
    }
  );

  // ── save_datasheet ───────────────────────────────────────────────────────
  server.tool(
    "save_datasheet",
    "Sla een productdatasheet op of update hem. Gebruik dit na elk product-onderzoek zodat je het nooit twee keer hoeft op te zoeken.",
    {
      company_slug: z.string().describe("Bedrijfsslug: 'websup' of 'koolhaas' — datasheets worden per werkruimte gescheiden"),
      brand: z.string().describe("Merk, bijv. 'Sofar' of 'Victron'"),
      model: z.string().describe("Modelnaam, bijv. 'BTS-10K'"),
      category: z.string().optional().describe("Categorie, bijv. 'batterij', 'omvormer', 'laadpaal'"),
      specs: z.record(z.string(), z.unknown()).optional().describe("Technische specs als JSON, bijv. {capaciteit: '10kWh', voltage: '48V'}"),
      notes: z.string().optional().describe("Jouw bevindingen, aandachtspunten, compatibiliteit"),
      price: z.number().optional().describe("Inkoopprijs excl. btw"),
      source_url: z.string().optional().describe("URL van de bron (fabrikant, leverancier)"),
    },
    async ({ company_slug, brand, model, category, specs, notes, price, source_url }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const now = new Date().toISOString();
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM "Datasheet" WHERE "companyId" = $1 AND LOWER(brand) = LOWER($2) AND LOWER(model) = LOWER($3)`,
        [co.id, brand, model]
      );

      if (existing) {
        const updates: string[] = ['"updatedAt" = $4'];
        const params: unknown[] = [co.id, brand, model, now];
        if (category !== undefined) { updates.push(`category = $${params.length + 1}`); params.push(category); }
        if (specs !== undefined) { updates.push(`specs = $${params.length + 1}::jsonb`); params.push(JSON.stringify(specs)); }
        if (notes !== undefined) { updates.push(`notes = $${params.length + 1}`); params.push(notes); }
        if (price !== undefined) { updates.push(`price = $${params.length + 1}`); params.push(price); }
        if (source_url !== undefined) { updates.push(`"sourceUrl" = $${params.length + 1}`); params.push(source_url); }
        await query(
          `UPDATE "Datasheet" SET ${updates.join(", ")} WHERE "companyId" = $1 AND LOWER(brand) = LOWER($2) AND LOWER(model) = LOWER($3)`,
          params
        );
        return { content: [{ type: "text", text: `Datasheet bijgewerkt: ${brand} ${model}` }] };
      }

      const id = crypto.randomUUID();
      await query(
        `INSERT INTO "Datasheet" (id, "companyId", brand, model, category, specs, notes, price, "sourceUrl", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$10)`,
        [id, co.id, brand, model, category ?? null, JSON.stringify(specs ?? {}), notes ?? null, price ?? null, source_url ?? null, now]
      );
      return { content: [{ type: "text", text: `Datasheet opgeslagen: ${brand} ${model} (ID: ${id})` }] };
    }
  );

  // ── search_datasheets ─────────────────────────────────────────────────────
  server.tool(
    "search_datasheets",
    "Zoek in opgeslagen productdatasheets. Doe dit ALTIJD als eerste stap bij product-onderzoek, vóór je naar internet gaat.",
    {
      company_slug: z.string().describe("Bedrijfsslug: 'websup' of 'koolhaas'"),
      query: z.string().describe("Zoekterm, bijv. 'Sofar batterij' of 'Victron omvormer'"),
      category: z.string().optional().describe("Filter op categorie"),
    },
    async ({ company_slug, query: q, category }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const term = `%${q.toLowerCase()}%`;
      const params: unknown[] = [co.id, term, term, term];
      let sql = `
        SELECT id, brand, model, category, specs, notes, price, "sourceUrl", "updatedAt"
        FROM "Datasheet"
        WHERE "companyId" = $1
          AND (LOWER(brand) LIKE $2 OR LOWER(model) LIKE $3 OR LOWER(COALESCE(notes,'')) LIKE $4)
      `;
      if (category) { sql += ` AND LOWER(category) = $${params.length + 1}`; params.push(category.toLowerCase()); }
      sql += ` ORDER BY "updatedAt" DESC LIMIT 10`;

      const results = await query(sql, params);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `Niets gevonden for '${q}'. Zoek op internet en sla daarna op met save_datasheet.` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ── save_finding ──────────────────────────────────────────────────────────
  server.tool(
    "save_finding",
    "Sla een bevinding of conclusie op. Gebruik dit voor compatibiliteitsnotes, prijsinfo, aandachtspunten of projectlessen.",
    {
      company_slug: z.string().describe("Bedrijfsslug: 'websup' of 'koolhaas' — bevindingen worden per werkruimte gescheiden"),
      topic: z.string().describe("Onderwerp, bijv. 'Sofar + Victron compatibiliteit' of 'installatie meterkast uitbreiding'"),
      content: z.string().describe("De bevinding zelf, zo concreet mogelijk"),
      tags: z.array(z.string()).optional().describe("Tags voor sneller terugvinden, bijv. ['batterij','compatibiliteit']"),
      quote_id: z.string().optional().describe("Optioneel: koppel aan een offerte-ID"),
    },
    async ({ company_slug, topic, content, tags, quote_id }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await query(
        `INSERT INTO "ResearchFinding" (id, "companyId", topic, content, tags, "quoteId", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
        [id, co.id, topic, content, tags ?? [], quote_id ?? null, now]
      );
      return { content: [{ type: "text", text: `Bevinding opgeslagen: "${topic}" (ID: ${id})` }] };
    }
  );

  // ── search_findings ───────────────────────────────────────────────────────
  server.tool(
    "search_findings",
    "Zoek in opgeslagen bevindingen en conclusies. Doe dit bij twijfel over compatibiliteit, prijzen of aanpak.",
    {
      company_slug: z.string().describe("Bedrijfsslug: 'websup' of 'koolhaas'"),
      query: z.string().describe("Zoekterm, bijv. 'Sofar compatibiliteit' of 'meterkast uitbreiding'"),
      tag: z.string().optional().describe("Filter op een specifieke tag"),
    },
    async ({ company_slug, query: q, tag }) => {
      const co = await queryOne<{ id: string }>(`SELECT id FROM "Company" WHERE slug = $1`, [company_slug]);
      if (!co) return { content: [{ type: "text", text: `Bedrijf '${company_slug}' niet gevonden.` }] };

      const term = `%${q.toLowerCase()}%`;
      const params: unknown[] = [co.id, term, term];
      let sql = `
        SELECT id, topic, content, tags, "quoteId", "createdAt"
        FROM "ResearchFinding"
        WHERE "companyId" = $1
          AND (LOWER(topic) LIKE $2 OR LOWER(content) LIKE $3)
      `;
      if (tag) { sql += ` AND $${params.length + 1} = ANY(tags)`; params.push(tag); }
      sql += ` ORDER BY "createdAt" DESC LIMIT 10`;

      const results = await query(sql, params);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `Geen bevindingen gevonden voor '${q}'.` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  return server;
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "20mb" }));

const MCP_API_KEY = process.env.MCP_API_KEY;

app.use("/mcp", (req: Request, res: Response, next) => {
  if (MCP_API_KEY) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${MCP_API_KEY}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  next();
});

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "websup-quote-mcp" });
});

if (process.env.MCP_HTTP_MODE === "true") {
  const PORT = process.env.MCP_PORT ?? process.env.PORT ?? 3001;
  app.listen(PORT, () => {
    process.stderr.write(`WebsUp Quote MCP server draait op http://0.0.0.0:${PORT}/mcp\n`);
  });
} else {
  // Stdio mode — Claude Code draait de server direct als process
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const transport = new StdioServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
  process.stderr.write("WebsUp Quote MCP server gestart op stdio\n");
}
