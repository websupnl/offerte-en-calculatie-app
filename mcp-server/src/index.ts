import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import pg from "pg";

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

function defaultTemplateFields(companySlug: string) {
  if (companySlug === "koolhaas") {
    return {
      title: "Thuisbatterij installatie",
      category: "Installatie · Energieopslag",
      tagline: "Advies · Installatie · Inbedrijfstelling",
      itemsHeader: "Wat wordt er geïnstalleerd",
      flow: [
        { n: 1, t: "Akkoord & opname", d: "Offerte akkoord, laatste technische check en bevestiging van de opstelplek." },
        { n: 2, t: "Materialen bestellen", d: "Batterij, omvormer, beveiligingen, bekabeling en montagemateriaal worden ingepland." },
        { n: 3, t: "Meterkast voorbereiden", d: "Controle op fasen, beschikbare ruimte, hoofdzekering en benodigde uitbreidingen." },
        { n: 4, t: "Montage & bekabeling", d: "Plaatsing van de installatie met nette kabelroute en veilige afwerking." },
        { n: 5, t: "Aansluiten & testen", d: "Elektrische controle, inbedrijfstelling, app-koppeling en functionele test." },
        { n: 6, t: "Uitleg & oplevering", d: "Korte uitleg over gebruik, monitoring, onderhoud en wat u kunt verwachten." },
      ],
      approach: [
        { n: "01", t: "Technische controle", d: "Ik controleer of de gekozen oplossing past bij woning, meterkast en verbruik." },
        { n: "02", t: "Heldere voorbereiding", d: "Planning, materialen en eventuele bijzonderheden worden vooraf afgestemd." },
        { n: "03", t: "Veilige uitvoering", d: "Installatie volgens geldende normen, met nette montage en duidelijke kabelroutes." },
        { n: "04", t: "Inbedrijfstelling", d: "Systeem testen, instellingen nalopen en zorgen dat monitoring werkt." },
        { n: "05", t: "Oplevering", d: "Samen controleren we de installatie en krijgt u uitleg over gebruik en onderhoud." },
      ],
      options: [
        { t: "Meterkast uitbreiding", d: "Extra groep, beveiliging of aanpassing als de bestaande situatie dat vraagt.", tag: "Na opname" },
        { t: "Energiemanagement", d: "EMS voor slim sturen van batterij, zonnepanelen, laadpaal en grootverbruikers.", tag: "Optioneel" },
        { t: "Extra monitoring", d: "Inzicht in verbruik, teruglevering en batterijgedrag via app of dashboard.", tag: "Op aanvraag" },
        { t: "Onderhoudscontrole", d: "Periodieke controle op veiligheid, instellingen en prestaties.", tag: "Jaarlijks" },
      ],
      exclusions: [
        "Bouwkundige werkzaamheden zoals hak-, breek-, stuc- of schilderwerk",
        "Graafwerk of herstel van bestrating tenzij expliciet opgenomen",
        "Netverzwaring of werkzaamheden door de netbeheerder",
        "Vergunningen, subsidies of gemeentelijke regelingen",
        "Aanpassingen buiten de beschreven installatie en materialen",
      ],
    };
  }

  return {
    title: "Maatwerk offerte-aanvraagmodule laadpalen",
    category: "Maatwerk module · WordPress",
    tagline: "Ontwerp · Bouw · Plaatsing",
    itemsHeader: "Onderdelen binnen fase 1.",
    flow: [
      { n: 1, t: "Locatie & situatie", d: "Adres, type woning of pand en de gewenste plek voor de laadpaal." },
      { n: 2, t: "Meterkast & aansluiting", d: "Foto meterkast, close-up slimme meter en het aantal fasen." },
      { n: 3, t: "Verdeelkast", d: "Overzichtsfoto en ruimte voor een extra groep of loadbalancing." },
      { n: 4, t: "Kabelroute", d: "Route en lengte van meterkast naar paal - is er graafwerk nodig?" },
      { n: 5, t: "Laadpaal & montage", d: "Type 2 of vaste kabel, gevel of montagepaal, verrekening." },
      { n: 6, t: "Klantgegevens", d: "Contactgegevens en of het zakelijk of particulier is." },
      { n: 7, t: "Controle & versturen", d: "Overzicht van alle gegevens en foto's, akkoord en verzenden." },
    ],
    approach: [
      { n: "01", t: "Inventarisatie", d: "Samen scope, velden en interne opvolging scherp krijgen." },
      { n: "02", t: "UX-ontwerp", d: "Stappen, volgorde en logica van de aanvraagflow." },
      { n: "03", t: "Visueel ontwerp", d: "Styling in de huisstijl - klaar voor akkoord." },
      { n: "04", t: "Technische bouw", d: "Maatwerk in WordPress: uploads, e-mail en formulierlogica." },
      { n: "05", t: "Test & feedback", d: "Testen op alle apparaten + een feedbackronde." },
      { n: "06", t: "Livegang & nazorg", d: "Plaatsing, korte uitleg en ondersteuning na oplevering." },
    ],
    options: [
      { t: "Dashboardomgeving", d: "Alle aanvragen, foto's en statussen centraal op een scherm.", tag: "Aparte offerte" },
      { t: "Extra dienst-flows", d: "Airco, warmtepomp, zonnepanelen, thuisbatterij, EMS - per dienst uitgebreid.", tag: "Per dienst" },
      { t: "Foto-export naar dossier", d: "Aangeleverde foto's makkelijk toevoegen aan een dossier in Syntess.", tag: "Op aanvraag" },
      { t: "Onderhoud & support", d: "Updates, monitoring en kleine aanpassingen na oplevering.", tag: "Maandelijks" },
    ],
    exclusions: [
      "Betaalde plugins of externe licenties",
      "Hosting en domeinnaam",
      "Teksten of fotografie",
      "Grote wijzigingen buiten de afgesproken scope",
      "Koppelingen met systemen buiten deze offerte",
    ],
  };
}

// ─── MCP Server factory ────────────────────────────────────────────────────────

function createMcpServer() {
  const server = new McpServer({
    name: "websup-quote-engine",
    version: "1.0.0",
  });

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

      let sql = `SELECT id, name, description, category, unit, "basePrice", "vatRate" FROM "Product" WHERE "companyId" = $1`;
      const params: unknown[] = [co.id];
      if (active_only !== false) { sql += ` AND active = true`; }
      if (category) { sql += ` AND LOWER(category) = $${params.length + 1}`; params.push(category.toLowerCase()); }
      sql += ` ORDER BY category, "sortOrder", name`;

      const products = await query(sql, params);
      return { content: [{ type: "text", text: JSON.stringify(products, null, 2) }] };
    }
  );

  server.tool(
    "create_quote",
    "Maak een nieuwe offerte aan voor een klant, inclusief regels",
    {
      company_slug: z.string().describe("Bedrijfsslug: 'websup' of 'koolhaas'"),
      customer_id: z.string().describe("ID van de klant (gebruik list_customers om te vinden)"),
      title: z.string().optional().default("Persoonlijk voorstel").describe("Titel van de offerte"),
      category: z.string().optional().default("Maatwerk project").describe("Categorie/type project"),
      tagline: z.string().optional().describe("Ondertitel, bijv. 'Ontwerp · Bouw · Plaatsing'"),
      itemsHeader: z.string().optional().describe("Kop boven de lijst met werkzaamheden/onderdelen"),
      intro: z.string().optional().describe("Inleidende tekst"),
      outro: z.string().optional().describe("Slottekst"),
      notes: z.string().optional().describe("Opmerkingen/interne of zichtbare notities voor de offerte"),
      flow: z.array(z.object({ n: z.number(), t: z.string(), d: z.string() })).optional().describe("Processtappen voor pagina 3"),
      approach: z.array(z.object({ n: z.string(), t: z.string(), d: z.string() })).optional().describe("Werkwijze/fases voor pagina 3"),
      options: z.array(z.object({ t: z.string(), d: z.string(), tag: z.string() })).optional().describe("Optionele uitbreidingen of meerwerk"),
      exclusions: z.array(z.string()).optional().describe("Niet inbegrepen / uitsluitingen"),
      valid_days: z.number().optional().default(30).describe("Geldigheidsduur in dagen"),
      items: z.array(z.object({
        description: z.string().describe("Omschrijving van het item"),
        qty: z.number().default(1).describe("Aantal"),
        unit_price: z.number().describe("Prijs per eenheid excl. btw"),
        vat_rate: z.number().default(21).describe("BTW-percentage"),
      })).describe("Offerteregels"),
    },
    async ({ company_slug, customer_id, title, category, tagline, itemsHeader, intro, outro, notes, flow, approach, options, exclusions, valid_days, items }) => {
      const defaults = defaultTemplateFields(company_slug);
      const quoteTitle = title === "Persoonlijk voorstel" ? defaults.title : title;
      const quoteCategory = category === "Maatwerk project" ? defaults.category : category;
      const quoteTagline = tagline ?? defaults.tagline;
      const quoteItemsHeader = itemsHeader ?? defaults.itemsHeader;
      const quoteFlow = flow ?? defaults.flow;
      const quoteApproach = approach ?? defaults.approach;
      const quoteOptions = options ?? defaults.options;
      const quoteExclusions = exclusions ?? defaults.exclusions;

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
      for (const item of items) {
        const lineTotal = item.qty * item.unit_price;
        totalExVat += lineTotal;
        totalVat += lineTotal * (item.vat_rate / 100);
      }
      const totalIncVat = totalExVat + totalVat;

      const now = new Date().toISOString();
      const validUntil = new Date(Date.now() + (valid_days ?? 30) * 86400000).toISOString();
      const quoteId = crypto.randomUUID();
      const number = generateQuoteNumber(company_slug);

      await query(
        `INSERT INTO "Quote" (id, "companyId", "customerId", "createdById", number, title, category, tagline,
          "itemsHeader", intro, outro, notes, flow, approach, options, exclusions, status, "validUntil",
          "totalExVat", "totalVat", "totalIncVat", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,'DRAFT',$17,$18,$19,$20,$21,$21)`,
        [quoteId, co.id, customer_id, user.id, number, quoteTitle, quoteCategory,
         quoteTagline, quoteItemsHeader, intro ?? null, outro ?? null, notes ?? null,
         JSON.stringify(quoteFlow), JSON.stringify(quoteApproach), JSON.stringify(quoteOptions), JSON.stringify(quoteExclusions),
         validUntil, totalExVat.toFixed(2), totalVat.toFixed(2), totalIncVat.toFixed(2), now]
      );

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lineTotal = item.qty * item.unit_price;
        await query(
          `INSERT INTO "QuoteItem" (id, "quoteId", description, qty, "unitPrice", "vatRate", total, "sortOrder")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [crypto.randomUUID(), quoteId, item.description,
           item.qty.toFixed(2), item.unit_price.toFixed(2),
           item.vat_rate.toFixed(2), lineTotal.toFixed(2), i]
        );
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
        `SELECT id, description, qty, "unitPrice", "vatRate", total, "sortOrder"
         FROM "QuoteItem" WHERE "quoteId" = $1 ORDER BY "sortOrder"`,
        [quote_id]
      );
      const share = await queryOne(
        `SELECT token, "acceptedAt", "declinedAt", "viewedAt" FROM "QuoteShare" WHERE "quoteId" = $1`,
        [quote_id]
      );

      return { content: [{ type: "text", text: JSON.stringify({ ...quote, items, share }, null, 2) }] };
    }
  );

  server.tool(
    "update_quote",
    "Pas velden van een bestaande offerte aan (titel, intro, status, etc.)",
    {
      quote_id: z.string().describe("Quote ID"),
      title: z.string().optional(),
      category: z.string().optional(),
      tagline: z.string().optional(),
      itemsHeader: z.string().optional(),
      intro: z.string().optional(),
      outro: z.string().optional(),
      status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
      notes: z.string().optional(),
      flow: z.array(z.object({ n: z.number(), t: z.string(), d: z.string() })).optional(),
      approach: z.array(z.object({ n: z.string(), t: z.string(), d: z.string() })).optional(),
      options: z.array(z.object({ t: z.string(), d: z.string(), tag: z.string() })).optional(),
      exclusions: z.array(z.string()).optional(),
    },
    async ({ quote_id, ...updates }) => {
      const fields = Object.entries(updates).filter(([, v]) => v !== undefined);
      if (fields.length === 0) return { content: [{ type: "text", text: "Geen velden om bij te werken." }] };

      const jsonFields = new Set(["flow", "approach", "options", "exclusions"]);
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
    "Voeg een regel toe aan een bestaande offerte en herbereken de totalen",
    {
      quote_id: z.string().describe("Quote ID"),
      description: z.string().describe("Omschrijving"),
      qty: z.number().default(1).describe("Aantal"),
      unit_price: z.number().describe("Prijs excl. btw"),
      vat_rate: z.number().default(21).describe("BTW-percentage"),
    },
    async ({ quote_id, description, qty, unit_price, vat_rate }) => {
      const quote = await queryOne<{ id: string }>(`SELECT id FROM "Quote" WHERE id = $1`, [quote_id]);
      if (!quote) return { content: [{ type: "text", text: `Offerte ${quote_id} niet gevonden.` }] };

      const lineTotal = qty * unit_price;
      const lineVat = lineTotal * (vat_rate / 100);

      const maxSort = await queryOne<{ max: number }>(
        `SELECT COALESCE(MAX("sortOrder"), -1) AS max FROM "QuoteItem" WHERE "quoteId" = $1`,
        [quote_id]
      );

      await query(
        `INSERT INTO "QuoteItem" (id, "quoteId", description, qty, "unitPrice", "vatRate", total, "sortOrder")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [crypto.randomUUID(), quote_id, description,
         qty.toFixed(2), unit_price.toFixed(2), vat_rate.toFixed(2),
         lineTotal.toFixed(2), (maxSort?.max ?? -1) + 1]
      );

      await query(
        `UPDATE "Quote" SET
          "totalExVat"  = (SELECT SUM(qty * "unitPrice") FROM "QuoteItem" WHERE "quoteId" = $1),
          "totalVat"    = (SELECT SUM(qty * "unitPrice" * "vatRate" / 100) FROM "QuoteItem" WHERE "quoteId" = $1),
          "totalIncVat" = (SELECT SUM(qty * "unitPrice" * (1 + "vatRate" / 100)) FROM "QuoteItem" WHERE "quoteId" = $1),
          "updatedAt"   = NOW()
         WHERE id = $1`,
        [quote_id]
      );

      return {
        content: [{
          type: "text",
          text: `Regel toegevoegd: "${description}" — €${lineTotal.toFixed(2)} excl. btw (+ €${lineVat.toFixed(2)} btw). Totalen herberekend.`,
        }],
      };
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
    async ({ datasheets }) => {
      const results: string[] = [];
      const now = new Date().toISOString();

      for (const ds of datasheets) {
        const existing = await queryOne<{ id: string }>(
          `SELECT id FROM "Datasheet" WHERE LOWER(brand) = LOWER($1) AND LOWER(model) = LOWER($2)`,
          [ds.brand, ds.model]
        );

        if (existing) {
          const updates: string[] = ['"updatedAt" = $3'];
          const params: unknown[] = [ds.brand, ds.model, now];
          if (ds.category !== undefined) { updates.push(`category = $${params.length + 1}`); params.push(ds.category); }
          if (ds.specs !== undefined) { updates.push(`specs = $${params.length + 1}::jsonb`); params.push(JSON.stringify(ds.specs)); }
          if (ds.notes !== undefined) { updates.push(`notes = $${params.length + 1}`); params.push(ds.notes); }
          if (ds.price !== undefined) { updates.push(`price = $${params.length + 1}`); params.push(ds.price); }
          if (ds.source_url !== undefined) { updates.push(`"sourceUrl" = $${params.length + 1}`); params.push(ds.source_url); }
          await query(`UPDATE "Datasheet" SET ${updates.join(", ")} WHERE LOWER(brand) = LOWER($1) AND LOWER(model) = LOWER($2)`, params);
          results.push(`Bijgewerkt: ${ds.brand} ${ds.model}`);
        } else {
          const id = crypto.randomUUID();
          await query(
            `INSERT INTO "Datasheet" (id, brand, model, category, specs, notes, price, "sourceUrl", "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$9)`,
            [id, ds.brand, ds.model, ds.category ?? null, JSON.stringify(ds.specs ?? {}), ds.notes ?? null, ds.price ?? null, ds.source_url ?? null, now]
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
      brand: z.string().describe("Merk, bijv. 'Sofar' of 'Victron'"),
      model: z.string().describe("Modelnaam, bijv. 'BTS-10K'"),
      category: z.string().optional().describe("Categorie, bijv. 'batterij', 'omvormer', 'laadpaal'"),
      specs: z.record(z.string(), z.unknown()).optional().describe("Technische specs als JSON, bijv. {capaciteit: '10kWh', voltage: '48V'}"),
      notes: z.string().optional().describe("Jouw bevindingen, aandachtspunten, compatibiliteit"),
      price: z.number().optional().describe("Inkoopprijs excl. btw"),
      source_url: z.string().optional().describe("URL van de bron (fabrikant, leverancier)"),
    },
    async ({ brand, model, category, specs, notes, price, source_url }) => {
      const now = new Date().toISOString();
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM "Datasheet" WHERE LOWER(brand) = LOWER($1) AND LOWER(model) = LOWER($2)`,
        [brand, model]
      );

      if (existing) {
        const updates: string[] = ['"updatedAt" = $3'];
        const params: unknown[] = [brand, model, now];
        if (category !== undefined) { updates.push(`category = $${params.length + 1}`); params.push(category); }
        if (specs !== undefined) { updates.push(`specs = $${params.length + 1}::jsonb`); params.push(JSON.stringify(specs)); }
        if (notes !== undefined) { updates.push(`notes = $${params.length + 1}`); params.push(notes); }
        if (price !== undefined) { updates.push(`price = $${params.length + 1}`); params.push(price); }
        if (source_url !== undefined) { updates.push(`"sourceUrl" = $${params.length + 1}`); params.push(source_url); }
        await query(
          `UPDATE "Datasheet" SET ${updates.join(", ")} WHERE LOWER(brand) = LOWER($1) AND LOWER(model) = LOWER($2)`,
          params
        );
        return { content: [{ type: "text", text: `Datasheet bijgewerkt: ${brand} ${model}` }] };
      }

      const id = crypto.randomUUID();
      await query(
        `INSERT INTO "Datasheet" (id, brand, model, category, specs, notes, price, "sourceUrl", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$9)`,
        [id, brand, model, category ?? null, JSON.stringify(specs ?? {}), notes ?? null, price ?? null, source_url ?? null, now]
      );
      return { content: [{ type: "text", text: `Datasheet opgeslagen: ${brand} ${model} (ID: ${id})` }] };
    }
  );

  // ── search_datasheets ─────────────────────────────────────────────────────
  server.tool(
    "search_datasheets",
    "Zoek in opgeslagen productdatasheets. Doe dit ALTIJD als eerste stap bij product-onderzoek, vóór je naar internet gaat.",
    {
      query: z.string().describe("Zoekterm, bijv. 'Sofar batterij' of 'Victron omvormer'"),
      category: z.string().optional().describe("Filter op categorie"),
    },
    async ({ query: q, category }) => {
      const term = `%${q.toLowerCase()}%`;
      const params: unknown[] = [term, term, term];
      let sql = `
        SELECT id, brand, model, category, specs, notes, price, "sourceUrl", "updatedAt"
        FROM "Datasheet"
        WHERE (LOWER(brand) LIKE $1 OR LOWER(model) LIKE $2 OR LOWER(COALESCE(notes,'')) LIKE $3)
      `;
      if (category) { sql += ` AND LOWER(category) = $${params.length + 1}`; params.push(category.toLowerCase()); }
      sql += ` ORDER BY "updatedAt" DESC LIMIT 10`;

      const results = await query(sql, params);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `Niets gevonden voor '${q}'. Zoek op internet en sla daarna op met save_datasheet.` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ── save_finding ──────────────────────────────────────────────────────────
  server.tool(
    "save_finding",
    "Sla een bevinding of conclusie op. Gebruik dit voor compatibiliteitsnotes, prijsinfo, aandachtspunten of projectlessen.",
    {
      topic: z.string().describe("Onderwerp, bijv. 'Sofar + Victron compatibiliteit' of 'installatie meterkast uitbreiding'"),
      content: z.string().describe("De bevinding zelf, zo concreet mogelijk"),
      tags: z.array(z.string()).optional().describe("Tags voor sneller terugvinden, bijv. ['batterij','compatibiliteit']"),
      quote_id: z.string().optional().describe("Optioneel: koppel aan een offerte-ID"),
    },
    async ({ topic, content, tags, quote_id }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await query(
        `INSERT INTO "ResearchFinding" (id, topic, content, tags, "quoteId", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [id, topic, content, tags ?? [], quote_id ?? null, now]
      );
      return { content: [{ type: "text", text: `Bevinding opgeslagen: "${topic}" (ID: ${id})` }] };
    }
  );

  // ── search_findings ───────────────────────────────────────────────────────
  server.tool(
    "search_findings",
    "Zoek in opgeslagen bevindingen en conclusies. Doe dit bij twijfel over compatibiliteit, prijzen of aanpak.",
    {
      query: z.string().describe("Zoekterm, bijv. 'Sofar compatibiliteit' of 'meterkast uitbreiding'"),
      tag: z.string().optional().describe("Filter op een specifieke tag"),
    },
    async ({ query: q, tag }) => {
      const term = `%${q.toLowerCase()}%`;
      const params: unknown[] = [term, term];
      let sql = `
        SELECT id, topic, content, tags, "quoteId", "createdAt"
        FROM "ResearchFinding"
        WHERE (LOWER(topic) LIKE $1 OR LOWER(content) LIKE $2)
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
app.use(express.json({ limit: "4mb" }));

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
