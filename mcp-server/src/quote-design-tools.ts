import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ARTIFACT_DESIGN_GUIDE, ARTIFACT_TEMPLATES, clampArtifactHeight, templateHeight, validateArtifactHtml } from "./artifacts.js";

/**
 * Alles waarmee ChatGPT de opbouw en het ontwerp van een offerte kan bepalen:
 * losse inhoudsblokken beheren, artifacts (HTML, CSS, JS) plaatsen en secties
 * aan of uit zetten. Staat los van index.ts zodat die niet nog groter wordt.
 */

export const contentBlockInputSchema = z.object({
  type: z.enum(["heading", "text", "list", "steps", "callout", "specs", "image", "html"])
    .describe("heading = sectiekop, text = alinea's, list = opsomming, steps = genummerde stappen, callout = kader dat opvalt, specs = twee kolommen kenmerk/waarde, image = afbeelding met bijschrift, html = vrij ontworpen onderdeel in HTML, CSS en JS (zie get_quote_design_guide)"),
  title: z.string().optional().describe("Kop boven het blok"),
  body: z.string().optional().describe("Tekst; lege regels scheiden alinea's. Bij een heading is dit het kleine label erboven. Bij html is dit het HTML-fragment."),
  height: z.number().optional().describe("Alleen voor html: vaste hoogte in pixels, maximaal 880. Standaard 360."),
  items: z.array(z.unknown()).optional()
    .describe("list: [\"regel\", ...] · steps: [{t, d}, ...] · specs: [{k, v}, ...]"),
  tone: z.enum(["info", "warning", "success"]).optional().describe("Alleen voor callout"),
  image_url: z.string().optional().describe("Alleen voor image"),
  caption: z.string().optional().describe("Bijschrift onder een afbeelding of artifact"),
});

export type ContentBlockInput = z.infer<typeof contentBlockInputSchema>;

type Db = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  queryOne: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T | null>;
};

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

/** Controleert een invoerblok. Alleen html-blokken kunnen afgekeurd worden. */
export function blockProblems(block: ContentBlockInput): string[] {
  return block.type === "html" ? validateArtifactHtml(block.body ?? "") : [];
}

export function registerQuoteDesignTools(server: McpServer, { query, queryOne }: Db) {
  /** Zet een invoerblok om naar databasewaarden. Bij html komt de hoogte in items[0].height. */
  function blockValues(block: ContentBlockInput) {
    const items = block.type === "html" ? [{ height: clampArtifactHeight(block.height, 360) }] : block.items ?? [];
    return [block.type, block.title ?? null, block.body ?? null, JSON.stringify(items), block.tone ?? null, block.image_url ?? null, block.caption ?? null];
  }

  async function insertBlock(quoteId: string, block: ContentBlockInput, sortOrder: number) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO "QuoteContentBlock" (id,"quoteId",type,title,body,items,tone,"imageUrl",caption,"sortOrder","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,NOW(),NOW())`,
      [id, quoteId, ...blockValues(block), sortOrder]
    );
    return id;
  }

  /** Zet een blok op een plek (0 = bovenaan, leeg = onderaan) en schuift de rest op. */
  async function addBlockAt(quoteId: string, block: ContentBlockInput, position?: number) {
    const rows = await query<{ id: string }>(`SELECT id FROM "QuoteContentBlock" WHERE "quoteId" = $1 ORDER BY "sortOrder", "createdAt"`, [quoteId]);
    const at = position === undefined ? rows.length : Math.max(0, Math.min(position, rows.length));
    const id = await insertBlock(quoteId, block, at);
    const ordered = [...rows.slice(0, at).map((row) => row.id), id, ...rows.slice(at).map((row) => row.id)];
    for (const [index, blockId] of ordered.entries()) {
      await query(`UPDATE "QuoteContentBlock" SET "sortOrder" = $2 WHERE id = $1`, [blockId, index]);
    }
    await query(`UPDATE "Quote" SET "pdfUrl" = NULL, "updatedAt" = NOW() WHERE id = $1`, [quoteId]);
    return { id, position: at };
  }

  const quoteExists = (quoteId: string) => queryOne<{ id: string }>(`SELECT id FROM "Quote" WHERE id = $1`, [quoteId]);

  server.tool(
    "add_quote_content_block",
    "Voeg één inhoudsblok toe aan een offerte zonder de andere blokken aan te raken. position 0 zet hem bovenaan, zonder position komt hij onderaan. Gebruik dit in plaats van set_quote_content voor kleine aanvullingen.",
    {
      quote_id: z.string().describe("Quote ID"),
      block: contentBlockInputSchema,
      position: z.number().int().min(0).optional().describe("Plek in de lijst, 0 = bovenaan. Leeg = onderaan."),
    },
    async ({ quote_id, block, position }) => {
      if (!(await quoteExists(quote_id))) return text(`Offerte ${quote_id} niet gevonden.`);
      const problems = blockProblems(block);
      if (problems.length > 0) return text(`Niet opgeslagen.\n${problems.join("\n")}`);
      const result = await addBlockAt(quote_id, block, position);
      return text(`Blok toegevoegd op plek ${result.position}. block_id: ${result.id}`);
    }
  );

  server.tool(
    "update_quote_content_block_legacy",
    "Pas één bestaand inhoudsblok aan. Alleen de velden die je meegeeft veranderen. Het type kan niet wijzigen; verwijder en voeg opnieuw toe als dat nodig is. Haal block_id's op met get_quote_content.",
    {
      block_id: z.string().describe("ID van het blok"),
      title: z.string().optional(),
      body: z.string().optional().describe("Tekst, of bij een html-blok het HTML-fragment"),
      items: z.array(z.unknown()).optional(),
      tone: z.enum(["info", "warning", "success"]).optional(),
      image_url: z.string().optional(),
      caption: z.string().optional(),
      height: z.number().optional().describe("Alleen voor html-blokken: nieuwe hoogte in pixels, maximaal 880"),
    },
    async ({ block_id, height, ...fields }) => {
      const current = await queryOne<{ quoteId: string; type: string }>(`SELECT "quoteId", type FROM "QuoteContentBlock" WHERE id = $1`, [block_id]);
      if (!current) return text(`Blok ${block_id} niet gevonden.`);

      if (current.type === "html" && fields.body !== undefined) {
        const problems = validateArtifactHtml(fields.body);
        if (problems.length > 0) return text(`Niet opgeslagen.\n${problems.join("\n")}`);
      }

      const sets: string[] = [];
      const values: unknown[] = [block_id];
      const set = (column: string, value: unknown, cast = "") => {
        values.push(value);
        sets.push(`${column} = $${values.length}${cast}`);
      };
      if (fields.title !== undefined) set("title", fields.title);
      if (fields.body !== undefined) set("body", fields.body);
      if (fields.tone !== undefined) set("tone", fields.tone);
      if (fields.image_url !== undefined) set('"imageUrl"', fields.image_url);
      if (fields.caption !== undefined) set("caption", fields.caption);
      if (current.type === "html" && height !== undefined) set("items", JSON.stringify([{ height: clampArtifactHeight(height, 360) }]), "::jsonb");
      else if (fields.items !== undefined) set("items", JSON.stringify(fields.items), "::jsonb");
      if (sets.length === 0) return text("Geen velden om bij te werken.");

      await query(`UPDATE "QuoteContentBlock" SET ${sets.join(", ")}, "updatedAt" = NOW() WHERE id = $1`, values);
      await query(`UPDATE "Quote" SET "pdfUrl" = NULL, "updatedAt" = NOW() WHERE id = $1`, [current.quoteId]);
      return text("Blok bijgewerkt.");
    }
  );

  server.tool(
    "remove_quote_content_block",
    "Verwijder één inhoudsblok van een offerte",
    { block_id: z.string().describe("ID van het blok") },
    async ({ block_id }) => {
      const gone = await query<{ quoteId: string }>(`DELETE FROM "QuoteContentBlock" WHERE id = $1 RETURNING "quoteId"`, [block_id]);
      if (gone.length === 0) return text(`Blok ${block_id} niet gevonden.`);
      await query(`UPDATE "Quote" SET "pdfUrl" = NULL, "updatedAt" = NOW() WHERE id = $1`, [gone[0].quoteId]);
      return text("Blok verwijderd.");
    }
  );

  server.tool(
    "set_quote_sections",
    "Zet secties van de offerte aan of uit. Uitzetten verbergt alleen, de inhoud blijft bewaard. Beschikbare secties: content (inhoudsblokken), approach (werkwijze), visuals (ontwerpvoorbeelden), modules (optionele keuzes), terms (afspraken), sources (bronnen). Omslag en akkoordpagina kunnen niet uit. Zo bepaal je de opbouw en lengte van de offerte.",
    {
      quote_id: z.string().describe("Quote ID"),
      hidden: z.array(z.enum(["content", "approach", "visuals", "modules", "terms", "sources"])).describe("Secties die NIET getoond worden. Een lege lijst toont alles."),
    },
    async ({ quote_id, hidden }) => {
      const updated = await query(`UPDATE "Quote" SET "hiddenSections" = $2, "pdfUrl" = NULL, "updatedAt" = NOW() WHERE id = $1 RETURNING id`, [quote_id, hidden]);
      if (updated.length === 0) return text(`Offerte ${quote_id} niet gevonden.`);
      return text(hidden.length ? `Verborgen: ${hidden.join(", ")}.` : "Alle secties zijn zichtbaar.");
    }
  );

  server.tool(
    "get_quote_design_guide",
    "Lees dit EERST voordat je een offerte ontwerpt of een artifact (HTML, CSS, JS) maakt. Geeft de regels, afmetingen, CSS-variabelen en beperkingen van offerte-artifacts, plus welke blokken en secties de opbouw van een offerte bepalen.",
    {},
    async () => text(`${ARTIFACT_DESIGN_GUIDE}

OPBOUW VAN EEN OFFERTE (je stuurt dit allemaal via de MCP)
- Voorblad en akkoordpagina staan altijd. Titel, categorie, tagline: update_quote.
- Intro en outro: update_quote.
- Inhoudsblokken tussen intro en prijzen: set_quote_content, add_quote_content_block, update_quote_content_block, remove_quote_content_block. Typen: heading, text, list, steps, callout, specs, image en html (artifact).
- Prijzen komen uit gekoppelde calculaties: create_quote_calculation, link_calculations_to_quote.
- Keuzes voor de klant: optional_work en configurations in update_quote.
- Secties aan of uit: set_quote_sections.
- Branding per bedrijf: update_company_settings.
- Controleer de lengte met de layoutwaarschuwingen die create_quote en update_quote teruggeven.`)
  );

  server.tool(
    "list_quote_artifacts",
    "Toon de kant-en-klare artifact-sjablonen (HTML, CSS, JS) voor offertes, met per sjabloon de parameters en een voorbeeldinvulling. Gebruik daarna render_quote_artifact om er een in te vullen.",
    {},
    async () => text(JSON.stringify(ARTIFACT_TEMPLATES.map(({ render: _render, heightFor: _heightFor, ...template }) => template), null, 2))
  );

  server.tool(
    "render_quote_artifact",
    "Vul een artifact-sjabloon in. Zonder quote_id krijg je alleen de HTML terug (om te bekijken of aan te passen). Met quote_id wordt het meteen als blok in de offerte gezet. Vul alle getallen uit de calculatie of een onderbouwde berekening, verzin niets.",
    {
      template_id: z.string().describe(`ID uit list_quote_artifacts: ${ARTIFACT_TEMPLATES.map((candidate) => candidate.id).join(", ")}`),
      params: z.record(z.string(), z.unknown()).describe("Parameters volgens het sjabloon"),
      quote_id: z.string().optional().describe("Zet het resultaat direct in deze offerte"),
      position: z.number().int().min(0).optional().describe("Plek tussen de inhoudsblokken, 0 = bovenaan. Leeg = onderaan."),
      title: z.string().optional().describe("Optionele kop boven het artifact in de offerte"),
      caption: z.string().optional().describe("Optioneel bijschrift eronder"),
      height: z.number().optional().describe("Eigen hoogte in pixels, maximaal 880. Leeg = de hoogte die het sjabloon voor deze invulling uitrekent."),
    },
    async ({ template_id, params, quote_id, position, title, caption, height }) => {
      const template = ARTIFACT_TEMPLATES.find((candidate) => candidate.id === template_id);
      if (!template) return text(`Onbekend sjabloon. Kies uit: ${ARTIFACT_TEMPLATES.map((candidate) => candidate.id).join(", ")}`);
      const html = template.render(params);
      const finalHeight = clampArtifactHeight(height, templateHeight(template, params));
      if (!quote_id) return text(JSON.stringify({ height: finalHeight, html }, null, 2));
      if (!(await quoteExists(quote_id))) return text(`Offerte ${quote_id} niet gevonden.`);
      const result = await addBlockAt(quote_id, { type: "html", title, body: html, caption, height: finalHeight }, position);
      return text(`${template.name} toegevoegd op plek ${result.position}, hoogte ${finalHeight}px. block_id: ${result.id}`);
    }
  );

  server.tool(
    "add_quote_artifact",
    "Zet een zelf ontworpen artifact (HTML, CSS en JS) als blok in een offerte. Lees eerst get_quote_design_guide. De HTML wordt gecontroleerd: geen iframes, formulieren, externe scripts of netwerkverkeer. Past een sjabloon, gebruik dan render_quote_artifact.",
    {
      quote_id: z.string().describe("Quote ID"),
      html: z.string().describe("HTML-fragment met eventueel <style> en <script>. Maximaal 60.000 tekens."),
      height: z.number().describe("Vaste hoogte in pixels, maximaal 880. Het ontwerp moet erin passen, er is geen scroll."),
      title: z.string().optional().describe("Optionele kop boven het artifact"),
      caption: z.string().optional().describe("Optioneel bijschrift eronder"),
      position: z.number().int().min(0).optional().describe("Plek tussen de inhoudsblokken, 0 = bovenaan. Leeg = onderaan."),
    },
    async ({ quote_id, html, height, title, caption, position }) => {
      if (!(await quoteExists(quote_id))) return text(`Offerte ${quote_id} niet gevonden.`);
      const problems = validateArtifactHtml(html);
      if (problems.length > 0) return text(`Niet opgeslagen.\n${problems.join("\n")}`);
      const result = await addBlockAt(quote_id, { type: "html", title, body: html, caption, height }, position);
      return text(`Artifact toegevoegd op plek ${result.position}, hoogte ${clampArtifactHeight(height, 360)}px. block_id: ${result.id}`);
    }
  );

  return { insertBlock };
}
