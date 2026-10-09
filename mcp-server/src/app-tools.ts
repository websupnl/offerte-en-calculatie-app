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
  server.registerTool('update_calculation', {
    description: 'Wijzig uitsluitend titel en algemene beschrijving van een bestaande calculatie. Behoudt artikelen, prijzen, marges en offertekoppelingen. Gekoppelde offertes lezen de actuele tekst en hun PDF-cache wordt vernieuwd. Ook tekstcorrecties bij verstuurde offertes zijn toegestaan.',
    inputSchema: {
      company_slug: company,
      calculation_id: z.string().min(1).describe('ID of calculatienummer, bijvoorbeeld KI-2026-C026'),
      title: z.string().trim().min(1).optional(),
      description: z.string().nullable().optional().describe('Algemene beschrijving. Null of een lege string wist de tekst.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ company_slug, calculation_id, title, description }) => {
    try {
      if (title === undefined && description === undefined) throw new Error('Geef een titel of beschrijving op.');
      const id = await refs.calculationId(calculation_id, company_slug);
      const result = await callApp({ company_slug, path: `/api/calculations/${id}`, method: 'PATCH', body: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
      } });
      return { ...appResult(result), ...(result.status >= 400 ? { isError: true } : {}) };
    } catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
  const mutation = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const quoteRef = { quote_id: z.string().min(1), company_slug: company.optional() };
  async function quoteRequest(quote_id: string, company_slug: string | undefined, suffix: string, method: string, body?: unknown) {
    const slug = company_slug ?? await refs.quoteCompany(quote_id);
    const result = await callApp({ company_slug: slug, path: `/api/quotes/${quote_id}${suffix}`, method, body });
    return { ...appResult(result), ...(result.status >= 400 ? { isError: true } : {}) };
  }
  const safely = async (action: () => Promise<ReturnType<typeof appResult>>) => {
    try { return await action(); } catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  };
  const fields = z.object({ title: z.string().min(1).optional(), category: z.string().optional(), tagline: z.string().optional(), intro: z.string().optional(), outro: z.string().optional(), itemsHeader: z.string().optional(), hiddenSections: z.array(z.enum(['content', 'approach', 'visuals', 'modules', 'terms', 'sources'])).optional() }).strict();
  const optionChanges = z.object({ title: z.string().min(1).optional(), description: z.string().optional(), details: z.array(z.string()).optional(), tag: z.string().min(1).optional() }).strict();
  server.registerTool('patch_quote', {
    description: 'Wijzig uitsluitend de opgegeven klantgerichte offertevelden. Geen prijswijzigingen of vervanging van lijsten. Voorbeeld fields={intro:"Nieuwe introductie"}. Geaccepteerde offertes blijven vergrendeld.',
    inputSchema: { ...quoteRef, fields }, annotations: mutation,
  }, ({ quote_id, company_slug, fields }) => safely(() => quoteRequest(quote_id, company_slug, '/presentation', 'PATCH', { fields })));
  server.registerTool('update_quote_option', {
    description: 'Wijzig titel, beschrijving, details of label van één optioneel meerwerkblok op de offerte, zonder broncalculatie of bedragen te veranderen. option_id uit get_quote.options; reset=true herstelt de actuele brontekst.',
    inputSchema: { ...quoteRef, option_id: z.string(), changes: optionChanges.optional(), reset: z.boolean().optional() }, annotations: mutation,
  }, ({ quote_id, company_slug, option_id, changes, reset }) => safely(() => quoteRequest(quote_id, company_slug, '/presentation', 'PATCH', { option: { id: option_id, changes, reset } })));
  server.registerTool('update_quote_item', {
    description: 'Wijzig alleen de klantomschrijving of zichtbaarheid van details van één offertepost. hidden_on_quote=true toont een neutrale som zodat geen geld verdwijnt. De broncalculatie, aantallen en prijzen blijven intact. reset=true gebruikt weer de bron.',
    inputSchema: { ...quoteRef, item_id: z.string(), description: z.string().min(1).optional(), hidden_on_quote: z.boolean().optional(), reset: z.boolean().optional() }, annotations: mutation,
  }, ({ quote_id, company_slug, item_id, description, hidden_on_quote, reset }) => safely(() => quoteRequest(quote_id, company_slug, '/presentation', 'PATCH', { item: { id: item_id, changes: { description, hiddenOnQuote: hidden_on_quote }, reset } })));
  server.registerTool('delete_quote_content_block', {
    description: 'Verwijder één verouderd inhoudsblok uit deze offerte. Andere blokken en calculaties blijven intact.',
    inputSchema: { ...quoteRef, block_id: z.string() }, annotations: { ...mutation, destructiveHint: true },
  }, ({ quote_id, company_slug, block_id }) => safely(() => quoteRequest(quote_id, company_slug, '/presentation', 'PATCH', { deleteBlockId: block_id })));
  server.registerTool('add_quote_image', {
    description: 'Voeg een productfoto of installatieschema als afzonderlijk afbeeldingblok toe. Gebruik een bestaande HTTPS-afbeelding, geen verzonnen foto.',
    inputSchema: { ...quoteRef, image_url: z.string().url(), title: z.string().optional(), caption: z.string().optional() }, annotations: { ...mutation, idempotentHint: false },
  }, ({ quote_id, company_slug, image_url, title, caption }) => safely(() => quoteRequest(quote_id, company_slug, '/presentation', 'PATCH', { image: { url: image_url, title, caption } })));
  server.registerTool('reorder_quote_sections', {
    description: 'Zet de echte offertepagina’s in een nieuwe volgorde. Omslag blijft eerste en akkoord laatste. Geef alle acht secties eenmaal op, ook als ze momenteel leeg of verborgen zijn.',
    inputSchema: { ...quoteRef, order: z.array(z.enum(['intro', 'content', 'approach', 'visuals', 'pricing', 'modules', 'terms', 'sources'])).length(8) }, annotations: mutation,
  }, ({ quote_id, company_slug, order }) => safely(() => quoteRequest(quote_id, company_slug, '/presentation', 'PATCH', { sectionOrder: order })));
  server.registerTool('preview_quote', {
    description: 'Render de werkelijke klantdocument-layout als PNG-pagina’s, inclusief actuele prijzen, optioneel meerwerk en opgeslagen klantkeuzes. Geen publicatie of verzending. Maximaal vier pagina’s per call; start_page is 0-based. Bekijk alle pagina’s voor een volledige opmaakcontrole.',
    inputSchema: { ...quoteRef, start_page: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(4).default(4) }, annotations: read,
  }, async ({ quote_id, company_slug, start_page, limit }) => {
    try {
      const slug = company_slug ?? await refs.quoteCompany(quote_id);
      const result = await callApp({ company_slug: slug, path: `/api/quotes/${quote_id}/preview`, query: { startPage: start_page, limit } });
      if (result.status >= 400) return { ...appResult(result), isError: true };
      const data = result.data as { images: string[]; [key: string]: unknown };
      const { images, ...metadata } = data;
      return { content: [{ type: 'text' as const, text: JSON.stringify(metadata, null, 2) }, ...images.map(image => ({ type: 'image' as const, data: image, mimeType: 'image/png' }))] };
    } catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
  server.registerTool('update_project', {
    description: 'Bewerk projecttitel, beschrijving, locatie en uitvoeringsstatus. Behoudt documenten en calculaties.',
    inputSchema: { company_slug: company, project_id: z.string(), fields: z.object({ title: z.string().min(1).optional(), description: z.string().nullable().optional(), address: z.string().nullable().optional(), city: z.string().nullable().optional(), zipCode: z.string().nullable().optional(), status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional() }).strict() }, annotations: mutation,
  }, ({ company_slug, project_id, fields }) => safely(async () => { const result = await callApp({ company_slug, path: `/api/projects/${project_id}`, method: 'PATCH', body: fields }); return { ...appResult(result), ...(result.status >= 400 ? { isError: true } : {}) }; }));
  server.registerTool('delete_project', {
    description: 'Verwijder een leeg project. Projecten met documenten, bestanden, taken of andere gekoppelde gegevens kunnen alleen worden gearchiveerd via update_project status=ARCHIVED.',
    inputSchema: { company_slug: company, project_id: z.string() }, annotations: { ...mutation, destructiveHint: true },
  }, ({ company_slug, project_id }) => safely(async () => { const result = await callApp({ company_slug, path: `/api/projects/${project_id}`, method: 'DELETE' }); return { ...appResult(result), ...(result.status >= 400 ? { isError: true } : {}) }; }));
  server.registerTool('validate_quote', {
    description: 'Controleer ontbrekende klantgegevens en meerwerkteksten, dubbele posten en mogelijke dubbele bedragen, en afwijkende calculatiekoppelingen. Signalen vervangen geen technische beoordeling: gebruik ook preview_quote.',
    inputSchema: quoteRef, annotations: read,
  }, ({ quote_id, company_slug }) => safely(() => quoteRequest(quote_id, company_slug, '/validate', 'GET')));
  server.registerTool('get_quote_history', {
    description: 'Toon maximaal 100 vastgelegde presentatieversies met tijd, actor en snapshot om tekst en opmaak te vergelijken. Alleen de nieuwe presentatieacties leggen deze versies vast; geen volledig calculatiearchief.',
    inputSchema: quoteRef, annotations: read,
  }, ({ quote_id, company_slug }) => safely(() => quoteRequest(quote_id, company_slug, '/history', 'GET')));
  server.registerTool('restore_quote_version', {
    description: 'Herstel een vastgelegde presentatieversie: commerciële tekst, meerwerkoverrides, inhoudsblokken en sectievolgorde. Calculatieregels, prijzen, koppelingen en klantkeuzes blijven intact. Geaccepteerde offertes zijn vergrendeld.',
    inputSchema: { ...quoteRef, version_id: z.string() }, annotations: { ...mutation, destructiveHint: true, idempotentHint: false },
  }, ({ quote_id, company_slug, version_id }) => safely(() => quoteRequest(quote_id, company_slug, '/history', 'POST', { versionId: version_id })));
  server.registerTool('clone_quote', {
    description: 'Maak een nieuw concept vanuit een bestaande offerte, inclusief eigen kopieën van calculaties en presentatie. customer_id kiest optioneel een nieuwe klant van hetzelfde bedrijf. De oorspronkelijke offerte blijft intact. Controleer klantgerichte tekst opnieuw met preview_quote.',
    inputSchema: { ...quoteRef, customer_id: z.string().optional() }, annotations: { ...mutation, idempotentHint: false },
  }, ({ quote_id, company_slug, customer_id }) => safely(() => quoteRequest(quote_id, company_slug, '/duplicate', 'POST', { customerId: customer_id })));
  server.registerTool('update_quote_content_block', {
    description: 'Wijzig alleen de opgegeven velden van één inhoudsblok, met bedrijfscontrole, PDF-vernieuwing en herstelbare presentatieversie. Het bloktype en andere blokken blijven intact. Voor HTML-hoogte geef items=[{height:360}] mee.',
    inputSchema: { ...quoteRef, block_id: z.string(), changes: z.object({ title: z.string().optional(), body: z.string().optional(), items: z.array(z.unknown()).optional(), tone: z.enum(['info', 'warning', 'success']).optional(), imageUrl: z.string().url().optional(), caption: z.string().optional() }).strict() }, annotations: mutation,
  }, ({ quote_id, company_slug, block_id, changes }) => safely(() => quoteRequest(quote_id, company_slug, '/presentation', 'PATCH', { block: { id: block_id, changes } })));
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
      calculations: z.array(z.object({ id: z.string().min(1), role: z.enum(['BASE', 'VARIANT', 'OPTION']).optional(), sort_order: z.number().int().min(0).optional() })).min(1).max(200).optional(),
      role: z.enum(['BASE', 'VARIANT', 'OPTION']).optional().describe('Optionele rol voor alle opgegeven calculaties. BASE telt altijd mee, VARIANT: klant kiest er één (minimaal twee), OPTION: meerprijs die de klant kan aanvinken.'),
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
    inputSchema: { company_slug: company, quote_id: z.string(), title: z.string().optional(), role: z.enum(['BASE', 'VARIANT', 'OPTION']).default('BASE').describe('BASE telt altijd mee, VARIANT: klant kiest er één (minimaal twee), OPTION: meerprijs die de klant kan aanvinken bovenop de basis.'), move_items: z.boolean().default(false) },
  }, async ({ company_slug, quote_id, title, role, move_items }) => {
    try { return appResult(await callApp({ company_slug, path: `/api/quotes/${quote_id}/calculations`, method: 'POST', body: { title, role, moveItems: move_items } })); }
    catch (error) { return { ...appResult({ error: String(error) }), isError: true }; }
  });
}
