import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

type AppInput = {
  company_slug: string; path: string; method?: string;
  query?: Record<string, string | number | boolean>; body?: unknown;
  files?: { field: string; name: string; mime: string; base64: string }[];
};

async function gateway(method: string, body?: unknown) {
  const key = process.env.MCP_APP_KEY;
  if (!key) throw new Error('Configure MCP_APP_KEY on both the MCP server and the app, and MCP_USER_ID on the app.');
  const url = `${(process.env.APP_URL || 'https://app.websup.nl').replace(/\/+$/, '')}/api/mcp`;
  const response = await fetch(url, { method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(125_000) });
  if (response.status >= 300 && response.status < 400) throw new Error('MCP gateway redirected. Deploy the updated app and check APP_URL.');
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}

export async function callApp(input: AppInput): Promise<{ status: number; data: unknown }> {
  return gateway('POST', { ...input, method: input.method ?? 'GET' });
}

export function appResult(result: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

type AppReferences = {
  quoteCompany: (id: string) => Promise<string>;
  calculationId: (ref: string, company: string) => Promise<string>;
};

export function registerAppTools(server: McpServer, refs: AppReferences) {
  const company = z.string().describe('Actief bedrijf: websup of koolhaas. Privéwerk via scope=private gebruikt de vaste MCP-gebruiker.');
  const query = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional();
  const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  server.registerTool('get_app_capabilities', {
    description: 'Ontdek ALLE actuele appfuncties en hun invoervelden. Taken, lijsten, notities, agenda, klanten, projecten, calculaties, offertes, artikelen, bestanden, facturen, abonnementen, contracten, portaal, reviewborden, AI en instellingen. De catalogus wordt bij iedere app-build bijgewerkt. Lees eerst de relevante paden en schema’s, gebruik daarna app_read of app_write. Schema’s gebruiken camelCase.',
    inputSchema: { filter: z.string().optional().describe('Filter op pad, bijvoorbeeld tasks, subscriptions, calculations of quotes') }, annotations: read,
  }, async ({ filter }) => {
    try {
      const catalog = await gateway('GET');
      const routes = filter ? catalog.routes.filter((r: { path: string }) => r.path.toLowerCase().includes(filter.toLowerCase())) : catalog.routes.map(({ schemas: _schemas, ...route }: { schemas: string; path: string }) => route);
      return appResult({ ...catalog, routes, rules: ['Basiscalculaties tellen op; minimaal twee VARIANT-calculaties vormen alternatieven.', 'Gebruik link_calculations_to_quote om bestaande calculaties samen toe te voegen.', 'Gebruik app_write voor nieuwe functies; deze voert de echte appregels en nevenacties uit.', 'Versturen en betalingslinks maken zijn afzonderlijke acties, voer ze alleen op gebruikersverzoek uit.'] });
    } catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
  server.registerTool('app_read', {
    description: 'Bekijk iedere leesbare appfunctie via de actuele API. Lees eerst get_app_capabilities. Geef een concreet /api/... pad met IDs en queryvelden. Taken/notities/lijsten: query scope=business of private. Geeft HTTP-status en volledige appgegevens, inclusief gekoppelde calculaties en prijskeuzes.',
    inputSchema: { company_slug: company, path: z.string(), query }, annotations: read,
  }, async input => {
    try { return appResult(await callApp(input)); } catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
  server.registerTool('app_write', {
    description: 'Bedien iedere actuele appfunctie: aanmaken, wijzigen, verwijderen, archiveren, koppelen, calculeren, bestanden uploaden, AI genereren, facturen/contracten/offertes versturen en agenda synchroniseren. Lees eerst get_app_capabilities voor methode, pad en velden. Gebruik camelCase; PUT kan volledige lijsten vervangen: lees eerst de huidige gegevens. Een bestand gebruikt files met base64. Externe verzending alleen op gebruikersverzoek.',
    inputSchema: {
      company_slug: company, path: z.string(), method: z.enum(['POST', 'PUT', 'PATCH', 'DELETE']), query,
      body: z.unknown().optional(),
      files: z.array(z.object({ field: z.string(), name: z.string(), mime: z.string(), base64: z.string() })).optional(),
    }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  }, async input => {
    try { return appResult(await callApp(input)); } catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
  server.registerTool('link_calculations_to_quote', {
    description: 'Koppel meerdere BESTAANDE calculaties atomair, zonder andere koppelingen te verwijderen of bronregels, prijzen, opslagen en totalen te veranderen. Gebruik calculation_ids (IDs of nummers), of calculations voor rol en sort_order per calculatie. Zonder rol blijft de bestaande rol behouden. BASE telt altijd op; voor twee volledige alternatieven gebruik mode=alternatives zodat BEIDE VARIANT zijn. De eerste variant is aanbevolen, of kies recommended_calculation_id. copy_items=false legt alleen de relatie en opgegeven relatiemetadata. copy_items=true wordt expliciet geweigerd. get_quote retourneert calculations[] EN calculaties[].',
    inputSchema: { company_slug: company.optional(), quote_id: z.string().optional(), customer_id: z.string().optional(), title: z.string().optional(),
      calculation_ids: z.array(z.string().min(1)).min(1).max(200).optional(),
      calculations: z.array(z.object({ id: z.string().min(1), role: z.enum(['BASE', 'VARIANT']).optional(), sort_order: z.number().int().min(0).optional() })).min(1).max(200).optional(),
      role: z.enum(['BASE', 'VARIANT']).optional().describe('Optionele rol voor alle opgegeven calculaties'),
      mode: z.enum(['append', 'alternatives']).default('append'),
      recommended_calculation_id: z.string().optional().describe('ID of nummer van de standaard aanbevolen variant'),
      copy_items: z.boolean().default(false),
    },
  }, async ({ company_slug, quote_id, customer_id, title, calculation_ids, calculations, role, mode, recommended_calculation_id, copy_items }) => {
    try {
      if (copy_items) throw new Error('copy_items=true wordt niet ondersteund. De calculaties blijven de prijsbron; gebruik false. Er is niets gewijzigd.');
      if (Boolean(calculation_ids) === Boolean(calculations)) throw new Error('Geef precies één van calculation_ids of calculations op.');
      const companySlug = company_slug ?? (quote_id ? await refs.quoteCompany(quote_id) : undefined);
      if (!companySlug) throw new Error('company_slug is verplicht voor een nieuwe offerte.');
      const selected = calculations ?? calculation_ids!.map(id => ({ id, role: undefined, sort_order: undefined }));
      const resolved = await Promise.all(selected.map(async c => ({ id: await refs.calculationId(c.id, companySlug), role: mode === 'alternatives' ? 'VARIANT' : c.role ?? role, sortOrder: c.sort_order })));
      const recommendedId = recommended_calculation_id ? await refs.calculationId(recommended_calculation_id, companySlug) : undefined;
      return appResult(await callApp({ company_slug: companySlug, path: '/api/calculations/link-to-quote', method: 'POST', body: { quoteId: quote_id, customerId: customer_id, title, calculations: resolved, recommendedCalculationId: recommendedId, copyItems: false } }));
    }
    catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
  server.registerTool('unlink_calculation_from_quote', {
    description: 'Ontkoppel één calculatie van een conceptofferte. Verwijdert uitsluitend de relatie; behoudt calculatieregels, prijzen, opslagen, totalen, rol en volgorde. Andere calculaties blijven gekoppeld. Herhaling is veilig. get_quote toont daarna de resterende echte calculaties.',
    inputSchema: { quote_id: z.string(), calculation_id: z.string().describe('ID of calculatienummer'), company_slug: company.optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ quote_id, calculation_id, company_slug }) => {
    try {
      const companySlug = company_slug ?? await refs.quoteCompany(quote_id);
      const calculationId = await refs.calculationId(calculation_id, companySlug);
      return appResult(await callApp({ company_slug: companySlug, path: '/api/calculations/unlink-from-quote', method: 'POST', body: { quoteId: quote_id, calculationId } }));
    } catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
  server.registerTool('create_quote_calculation', {
    description: 'Maak een nieuwe lege basiscalculatie of variant binnen een conceptofferte. Gebruik move_items alleen om oude losse offerteregels naar de basiscalculatie te migreren. Vul de calculatie daarna via app_write /api/calculations/[id]. Voor bestaande calculaties gebruik link_calculations_to_quote.',
    inputSchema: { company_slug: company, quote_id: z.string(), title: z.string().optional(), role: z.enum(['BASE', 'VARIANT']).default('BASE'), move_items: z.boolean().default(false) },
  }, async ({ company_slug, quote_id, title, role, move_items }) => {
    try { return appResult(await callApp({ company_slug, path: `/api/quotes/${quote_id}/calculations`, method: 'POST', body: { title, role, moveItems: move_items } })); }
    catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
}
