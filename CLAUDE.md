# Offerte App — WebsUp & Koolhaas Installaties
gebruik .claude\commands\maak-offerte.md bij het maken van offertesm werkt dit bestand ook bij bij nieuwe mogelijkheden

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

## Prijzen: de calculatie is de bron

Sinds september 2026 komt de prijs van een offerte uit gekoppelde calculaties.
Daarvoor kon een prijs op vier plekken ontstaan (losse `QuoteItem`-regels, een
`choiceGroups`-blob, `QuoteModule`, en de calculatie), met kopieën die je met de
hand moest synchroniseren.

```
Quote ──< Calculation      role = BASE     telt altijd mee in de prijs
                           role = VARIANT  de klant kiest er een uit
          └──< CalculationItem
                 gewoon                 bepaalt de prijs
                 optional = true        de klant vinkt het aan als extra
                 hiddenOnQuote = true   alleen intern
                 recurringInterval      abonnement per maand of per jaar
                 quoteNote              wat de klant bij een extra leest
```

### Oud en nieuw naast elkaar
`usesCalculationPricing()` in `src/lib/quote-pricing.ts` bepaalt het pad:
**een calculatie gekoppeld én geen `QuoteItem`-regels meer = nieuw pad.**
Offertes van voor de omslag houden hun regels en renderen onveranderd. Verstuurde
offertes worden nooit omgezet.

### Sleutelbestanden
| Bestand | Wat |
|---|---|
| `src/lib/quote-pricing.ts` | Calculaties -> wat de klant ziet, plus de grens oud/nieuw |
| `src/lib/quote-with-pricing.ts` | `applyCalculationPricing()`, gebruik dit bij elke offerte die je laadt om te tonen |
| `src/lib/quote-totals.ts` | `Quote.total*` gelijktrekken na elke calculatiewijziging |
| `src/lib/calculation-number.ts` | Volgend nummer op basis van het hoogste bestaande, niet op het aantal records |
| `src/app/api/quotes/[id]/calculations` | Calculatie maken bij een offerte, ook varianten en het omzetten van oude regels |
| `src/components/forms/quote-price-panel.tsx` | Waar de prijs vandaan komt, in de bouwer |
| `src/components/forms/quote-page-rail.tsx` | De paginastrip die de zijkolom verving |

### Regels bij het bouwen
- De preview, het klantportaal en de PDF renderen nog steeds `items`,
  `choiceGroups` en `options`. Die vorm wordt afgeleid uit de calculaties door
  `pricingToPreviewShape()`. Nooit rechtstreeks wegschrijven op het nieuwe pad.
- `CalculationItem.id` is stabiel: het klantportaal onthoudt aangevinkte extra's
  op dat id. De PUT van een calculatie werkt regels daarom bij op id in plaats
  van ze weg te gooien en opnieuw aan te maken.
- Optionele regels in een `VARIANT` verschijnen niet op de offerte. Zet extra's
  in de basiscalculatie. `variantExtraWaarschuwing()` meldt dit in de editor.

## Migraties
`npm run db:push` is **verboden**: schema en database zijn uit elkaar gelopen
(`QuoteTemplate` en `Quote.document` staan wel in de database, niet in het
schema). Push zou die droppen. Altijd handgeschreven SQL met
`ADD COLUMN IF NOT EXISTS`, daarna `npx prisma generate`.

Na `prisma generate` moet de dev-server herstart worden. Hij houdt anders de
oude client vast en geeft `PrismaClientValidationError` op nieuwe velden.

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

## Werkplek (PLAN-werkplek.md — fase 0 t/m 7)

Taken, notities, agenda, contracten, klantportaal en review-tool. Zie
`PLAN-werkplek.md` voor de onderbouwing per keuze.

### Scope-regel (belangrijk)
Een privé-item heeft `companyId = null` en hangt alleen aan `ownerId`.
Gebruik **altijd** `scopeWhere()` / `scopeData()` uit `src/lib/tasks.ts` — dan
kan privéwerk niet in een zakelijk overzicht opduiken.
Concepten tellen nooit mee in cijfers: `src/lib/stats.ts`.

### Sleutelbestanden
| Bestand | Wat |
|---|---|
| `src/lib/tasks.ts` | Scope-helpers + Nederlandse quick-add parser |
| `src/lib/stats.ts` | Wat telt mee in de cijfers (concepten niet) |
| `src/lib/ai/provider.ts` | Kiest lokale CLI-relay of OpenAI |
| `scripts/ai-relay.mjs` | Relay die de Claude/Codex CLI aanroept |
| `src/lib/calendar/ics.ts` | ICS-feed bouwen (RFC 5545) |
| `src/lib/calendar/google.ts` | Google Calendar push-sync |
| `src/lib/calendar/recurrence.ts` | Herhalende taken |
| `src/lib/portal.ts` | Klanttoegang (server-only!) |
| `src/lib/portal-labels.ts` | Labels voor de browser — niet uit portal.ts importeren |
| `src/lib/push.ts` | Web Push |
| `public/review.js` | Review-widget voor klantsites |

### AI zonder API-kosten
```bash
npm run ai:relay          # relay op :8787 handmatig in de voorgrond
npm run ai:relay:status   # status van de permanente systemd-service
npm run ai:relay:logs     # live logs van de permanente systemd-service
npm run ai:relay:restart  # permanente systemd-service herstarten
```
De bestaande named Cloudflare Tunnel publiceert de relay via
`https://ai-relay.websup.nl`; start geen losse Quick Tunnel. Zet `AI_RELAY_URL`
(het tunneladres) + `AI_RELAY_KEY` in Vercel. Staat de laptop
uit, dan valt de app terug op OpenAI — of toont "AI offline" als die key weg is.

### Review-widget op een klantsite
```html
<script defer src="https://app.websup.nl/review.js"></script>
```
Doet niets tot de URL `?review=TOKEN` bevat. Een iframe van een andere site kan
dit níet: die is cross-origin afgeschermd, dus je kunt er niet in klikken of de
scrollpositie lezen.

### Extra env-variabelen
```
AI_RELAY_URL, AI_RELAY_KEY, AI_CLI          # AI via lokale CLI
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET      # Google Calendar
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY         # Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY                # zelfde publieke sleutel, voor de browser
```
