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

## Environment variabelen

Zie `.env.example` voor alle benodigde variabelen.

## Disclaimer

Dit project is gebouwd als persoonlijk intern tool via vibe coding met Claude. Er is geen formele security review gedaan. Zet dit niet live voor publieke eindgebruikers zonder eigen beoordeling van de code.
