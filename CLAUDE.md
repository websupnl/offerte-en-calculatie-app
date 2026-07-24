# Offerte App — WebsUp & Koolhaas Installaties

## Stack
- Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- Database: PostgreSQL via Prisma ORM
- Auth: NextAuth.js v5 (credentials, JWT)
- AI: OpenAI GPT-4o
- PDF: @react-pdf/renderer
- Email: Resend
- Deployment: Docker + Coolify op VPS

## Multi-tenant
Eén app, twee bedrijven (company switcher bij login).
- `websup` slug → WebsUp.nl branding
- `koolhaas` slug → Koolhaas Installaties branding
- Company context via session JWT + CompanyProvider

## Starten
```bash
npm install
cp .env.example .env  # Vul DATABASE_URL etc. in
npm run db:push       # Maak tabellen aan
npm run db:seed       # Seed bedrijven + admin user
npm run dev
```

Login: `info@websup.nl` / `Admin123!`

## Deploy (Coolify)
1. Push naar Git repo
2. In Coolify: New Service → Dockerfile → koppel repo
3. Stel env vars in (DATABASE_URL, NEXTAUTH_SECRET, OPENAI_API_KEY)
4. Deploy
5. Eerste keer: run `npm run db:seed` in de container

## Sleutelbestanden
- `src/lib/auth.ts` — NextAuth configuratie + JWT callbacks
- `src/lib/branding.ts` — Company thema's + AI prompts
- `src/lib/openai.ts` — GPT-4o integratie
- `src/lib/pdf/quote-template.tsx` — React-PDF offerte template
- `prisma/schema.prisma` — Database schema
- `prisma/seed.ts` — Seed data (bedrijven, gebruiker, producten)
- `src/middleware.ts` — Route bescherming
- `src/lib/company-context.tsx` — Company switcher context

## AI Features
- Offertetekst genereren: `POST /api/ai/quote-text`
- Adviesdocumenten (Koolhaas): `POST /api/ai/advice`
- Systeem-prompts aanpasbaar via Instellingen pagina

## Klantportaal
Publieke URL: `/q/[token]` — geen login vereist.
Klant kan accepteren/afwijzen.
Token aanmaken: `POST /api/quotes/[id]/share`

## CLI-workflow (Claude Code scrapen + importeren)

### App-poort
De app draait lokaal op **`:3001`** (niet :3000 — dat is een andere app).

### Brave starten met CDP
```bash
npm run brave
# of direct:
/snap/bin/brave --remote-debugging-port=9222 --user-data-dir="$HOME/snap/brave/current/.config/BraveSoftware/Brave-Browser" &
```
**Altijd als één regel** — argumenten op een nieuwe regel worden niet doorgegeven.

### Leveranciersprijs scrapen (Oosterberg)
```bash
# Scrape Sigenergy en sla op in DB (Koolhaas Installaties)
npm run scrape:oosterberg
# Of met aangepaste zoekterm:
node scripts/scrape-oosterberg.mjs huawei --save --company koolhaas
# Alleen preview, niet opslaan:
node scripts/scrape-oosterberg.mjs sigenergy | jq '.[].netto'
```
Vereist: Brave open op `webshop.oosterberg.nl` (ingelogd als 140613 Administrator).

### Offerte importeren vanuit JSON
```bash
npm run import:quote ~/Bureaublad/offerte-ouders-koolhaas.json \
  --company koolhaas \
  --customer "Arjan Koolhaas" \
  --email "arjan@koolhaas.nl" \
  --address "Arendswyk 45" \
  --city "Rottevalle" \
  --zip "9221 TV"
```
Maakt automatisch een klant aan als die nog niet bestaat.

### CLI API-routes (geen UI-login vereist)
Beveiligd met `X-CLI-Key` header (waarde in `.env.local` als `CLI_API_KEY`).

| Endpoint | Methode | Wat |
|---|---|---|
| `/api/cli/import-quote` | POST | Offerte-JSON importeren + klant aanmaken |
| `/api/cli/sync-products` | POST | Productprijzen upserten in Datasheet |

### Scripts
| Bestand | Wat |
|---|---|
| `scripts/cdp.mjs` | CDP WebSocket helper (navigeren, tekst ophalen) |
| `scripts/db.mjs` | Prisma-client voor scripts (laadt .env.local automatisch) |
| `scripts/scrape-oosterberg.mjs` | Oosterberg scraper |
| `scripts/import-quote.mjs` | Offerte importeren via CLI API |

### Prisma in scripts (buiten Next.js)
De app gebruikt `PrismaPg` adapter. Altijd zo initialiseren:
```js
import { PrismaClient } from './src/generated/prisma/index.js'
import { PrismaPg } from './node_modules/@prisma/adapter-pg/dist/index.mjs'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
```
Of gebruik `scripts/db.mjs` die dit al regelt.
