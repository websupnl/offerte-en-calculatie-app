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

export function registerAppTools(server: McpServer) {
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
    description: 'Voeg meerdere BESTAANDE calculaties in één transactie aan dezelfde offerte toe. BASE telt op, minimaal twee VARIANT zijn alternatieven. Andere gekoppelde calculaties blijven bewaard. Geef quote_id voor een bestaande conceptofferte, of customer_id en title voor een nieuwe. Geen kopie van prijsregels. Calculaties bij een andere offerte moeten eerst los gedupliceerd worden.',
    inputSchema: { company_slug: company, quote_id: z.string().optional(), customer_id: z.string().optional(), title: z.string().optional(),
      calculations: z.array(z.object({ id: z.string(), role: z.enum(['BASE', 'VARIANT']).default('BASE') })).min(1).max(200) },
  }, async ({ company_slug, quote_id, customer_id, title, calculations }) => {
    try { return appResult(await callApp({ company_slug, path: '/api/calculations/link-to-quote', method: 'POST', body: { quoteId: quote_id, customerId: customer_id, title, calculations } })); }
    catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
  server.registerTool('create_quote_calculation', {
    description: 'Maak een nieuwe lege basiscalculatie of variant binnen een conceptofferte. Gebruik move_items alleen om oude losse offerteregels naar de basiscalculatie te migreren. Vul de calculatie daarna via app_write /api/calculations/[id]. Voor bestaande calculaties gebruik link_calculations_to_quote.',
    inputSchema: { company_slug: company, quote_id: z.string(), title: z.string().optional(), role: z.enum(['BASE', 'VARIANT']).default('BASE'), move_items: z.boolean().default(false) },
  }, async ({ company_slug, quote_id, title, role, move_items }) => {
    try { return appResult(await callApp({ company_slug, path: `/api/quotes/${quote_id}/calculations`, method: 'POST', body: { title, role, moveItems: move_items } })); }
    catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
}
