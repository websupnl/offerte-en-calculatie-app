# Offerte & Calculatie App

> **Vibe code project** — gebouwd met AI-assistentie als persoonlijk intern tool voor WebsUp.nl en Koolhaas Installaties. Deze app is niet ontworpen voor productie en heeft geen security audit gehad. Gebruik op eigen risico.

Een multi-tenant offerte-app waarmee je professionele 5-pagina offertes kunt aanmaken, versturen en laten accorderen via een klantportaal. Inclusief een MCP-server zodat je Claude direct offertes kunt laten maken.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **PostgreSQL** via Prisma ORM
- **Auth:** NextAuth.js v5 (credentials + JWT)
- **AI:** OpenAI GPT-4o
- **PDF:** @react-pdf/renderer
- **MCP Server:** Express + @modelcontextprotocol/sdk (HTTP transport)

## Multi-tenant

Eén app, twee bedrijven via een company switcher bij login.

- `websup` — WebsUp.nl
- `koolhaas` — Koolhaas Installaties

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # Vul de variabelen in
npm run db:push               # Maak tabellen aan
npm run db:seed               # Seed bedrijven + admin gebruiker
npm run dev
```

Login: `info@websup.nl` / `Admin123!`

## Facturen via Mollie

Facturen gebruiken uitsluitend een live Mollie-betaallink voor klantbetalingen. De PDF toont dan een betaalknop en QR-code, zonder IBAN. Een testlink wordt nooit op de klantfactuur getoond en de app verstuurt geen factuurmail zonder live link.

Zet in de productieomgeving `MOLLIE_API_KEY_WEBSUP` en `MOLLIE_API_KEY_KOOLHAAS` op de live API-key van het juiste bedrijf. Voor mail zijn `BREVO_SMTP_HOST`, `BREVO_SMTP_PORT`, `BREVO_SMTP_LOGIN` en `BREVO_SMTP_KEY` nodig. `NEXT_PUBLIC_APP_URL` moet de publieke HTTPS-URL van de app zijn. Voeg sleutels toe aan de hostingomgeving, niet aan de repository.

## MCP Server

De MCP server draait als aparte service en stelt Claude in staat offertes te maken via natuurlijke taal.

```bash
cd mcp-server
npm install
npm run build
MCP_API_KEY=geheim DATABASE_URL=... npm start
```

Koppelen in Claude Code:

```
URL: https://jouw-domein.nl/mcp
Header: Authorization: Bearer <MCP_API_KEY>
```

MCP 2.0 kan de actuele appfuncties bekijken en bedienen via `get_app_capabilities`,
`app_read` en `app_write`. De catalogus wordt bij `npm run build` automatisch
opnieuw gemaakt; lokaal kan dit met `npm run mcp:catalog`.

Stel dezelfde `MCP_APP_KEY` in op de Next-app en MCP-service. Stel op de app
`MCP_USER_ID` in op de bestaande gebruiker namens wie de AI werkt. De gateway
controleert diens bedrijfstoegang en gebruikt daarna de normale app-authenticatie.
Privétaken en notities blijven aan die gebruiker gekoppeld. Zet `APP_URL` op de
MCP-service op de app-URL; beide services moeten met deze update worden uitgerold.
`MCP_API_KEY` blijft de sleutel waarmee de AI de MCP-service zelf benadert.

In het calculatieoverzicht: vink meerdere calculaties aan en kies
**Toevoegen aan offerte**. Kies een bestaande conceptofferte of maak een nieuwe,
en kies per calculatie **Basis** (optellen) of **Variant** (minimaal twee
alternatieven). Andere calculaties op de offerte blijven gekoppeld. De AI doet
hetzelfde met `link_calculations_to_quote`. Voor een lege calculatie in een
offerte bestaat `create_quote_calculation`. Het oude `copy_items` is vervallen.

Controle: `npm test`, `npm run build` en `cd mcp-server && npm run build`.
De handmatige integratietest `node scripts/test-mcp-smoke.mjs` start de app op
`:3001`, test de MCP via stdio, selecteert twee tijdelijke calculaties in de
browser en ruimt de testklant met zijn documenten op. Vereist `.env.local`, een
gebouwde app/MCP en Chrome (ander pad via `SMOKE_BROWSER`). Screenshots staan in
`output/mcp-smoke/`. Deze test verstuurt geen e-mail of betalingsverzoeken.

## Environment variabelen

Zie `.env.example` voor alle benodigde variabelen.

## Disclaimer

Dit project is gebouwd als persoonlijk intern tool via vibe coding met Claude. Er is geen formele security review gedaan. Zet dit niet live voor publieke eindgebruikers zonder eigen beoordeling van de code.
