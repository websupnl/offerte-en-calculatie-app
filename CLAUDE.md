# Offerte App — WebsUp & Koolhaas Installaties
gebruik .claude\commands\maak-offerte.md bij het maken van offertesm werkt dit bestand ook bij bij nieuwe mogelijkheden

## Database: je werkt in de live database

`.env.local` wijst naar dezelfde Neon-database als productie. Dat is bewust zo,
want offertes maken vanaf de CLI werkt daardoor meteen tegen de echte klanten en
artikelen. Het betekent wel dat er geen oefenomgeving is.

- **Lezen mag altijd.** Alles opvragen, tellen, analyseren: prima.
- **Schrijven alleen als Daan er expliciet om vraagt.** Dus geen testofferte,
  geen seed, geen opruimscript, geen `UPDATE` of `DELETE` op eigen initiatief.
- Dit geldt ook voor wat er indirect uit volgt: een offerte aanmaken of een
  klantportaal openen stuurt echte Telegram-meldingen naar Daans telefoon.

Twijfel je of iets schrijven is? Dan is het schrijven. Vraag het even.

## Stack
- Next.js 16 (App Router, Turbopack), React, TypeScript, Tailwind CSS, shadcn/ui
- Database: PostgreSQL via Prisma ORM
- Auth: NextAuth.js v5 (credentials, JWT)
- AI: OpenAI GPT-4o
- PDF: @react-pdf/renderer
- Email: Resend
- Deployment: Vercel (project `offerte-en-calculatie-app`), database op Neon

## Multi-tenant
Eén app, twee bedrijven (company switcher bij login).
- `websup` slug → WebsUp.nl branding
- `koolhaas` slug → Koolhaas Installaties branding
- Company context via session JWT + CompanyProvider

## Starten
```bash
npm install
npm run dev           # draait op :3001
```
`.env.local` staat er al en wijst naar de live database, dus `db:push` en
`db:seed` niet draaien. Zie de waarschuwing bij Migraties.

Login: `info@websup.nl` / `Admin123!`

## Deploy (Vercel)
Pushen naar `master` rolt vanzelf uit naar productie.

```bash
npx vercel env ls production          # welke variabelen staan er
npx vercel env add NAAM production    # variabele toevoegen
npx vercel redeploy <deployment-url>  # zelfde code, nieuwe variabelen oppikken
```

Een nieuwe variabele werkt pas na een redeploy. Meldingen vielen maandenlang
stil omdat `TELEGRAM_TOKEN` en `TELEGRAM_CHAT_ID` alleen lokaal stonden: de
app logt dan `[Telegram] Missing ...` en stuurt niets. Controleer bij een
"het werkt lokaal wel"-probleem dus eerst `vercel env ls production`.

Ontbreekt nog steeds op productie: `VAPID_*` (web push werkt daardoor nergens),
`AI_RELAY_KEY` en `CLI_API_KEY`.

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
- Een calculatieregel is eenmalig of terugkerend. `recurringInterval`
  (`maand` | `kwartaal` | `jaar`) is het veld dat je in de bouwer zet; de PUT
  leidt daar `lineType` (`ONE_OFF` | `RECURRING`) en `billingCycle`
  (`MONTHLY` | `QUARTERLY` | `YEARLY`) uit af. Nooit `lineType`/`billingCycle`
  los wegschrijven.

## Abonnementen, akkoorden & offerte verlengen

De app is de source of truth voor hosting-/domein-/service-abonnementen.

```
Quote ──akkoord──> AgreementLog   (onveranderbaar juridisch record, methode + IP + av_version + snapshot)
              └──> Subscription   (één per RECURRING calculatieregel die de klant accepteert)
                     └──< SubscriptionEvent   (CREATED, INVOICED, PRICE_CHANGED, PAUSED/RESUMED/CANCELLED, NOTE)
```

- **Bedragen in `Subscription`/`SubscriptionEvent`: hele centen (Int), ex btw.**
  Converteren gebeurt alleen in `src/lib/money.ts`; formatteren alleen in de UI.
- **Akkoord (portaal én handmatig-mondeling)** schrijft een `AgreementLog` in
  dezelfde transactie als de statuswissel, en maakt daarna de abonnementen aan.
  Idempotent op `sourceQuoteId` + `sourceCalculationItemId`.
- **"Te factureren"** = actieve abonnementen met `nextBillingDate` binnen 30 dagen
  die voor die periode nog niet gefactureerd zijn. De knop "Gefactureerd" zet
  `lastInvoicedAt` en schuift `nextBillingDate` één cyclus vooruit. Een tweede
  klik binnen dezelfde cyclus doet niets.
- **Offerte verlengen** (`POST /api/quotes/[id]/extend`): nieuwe `validUntil`,
  status terug naar `SENT`, `QuoteEvent` "EXTENDED", en een mail naar de klant
  met de portaallink. Voor een klant die "kom er op terug" zei en de offerte
  liet verlopen.

### Sleutelbestanden
| Bestand | Wat |
|---|---|
| `src/lib/money.ts` | Euro ⇄ centen, de enige conversieplek |
| `src/lib/subscriptions/cycle.ts` | Cyclus-rekenwerk (maandeinde-clamp, idempotentie) |
| `src/lib/subscriptions/from-quote.ts` | Geaccepteerde offerte -> abonnementsrijen (puur + DB-laag) |
| `src/lib/subscriptions/service.ts` | Gedeelde CRUD/invoiced-logica voor UI én Donna-gateway |
| `src/lib/agreements.ts` | `AgreementLog` schrijven, av_version, IP uit headers |
| `src/app/(dashboard)/subscriptions/` | De pagina "Abonnementen" + detail |
| `docs/donna-subscriptions-gateway.md` | Het exacte contract van de nieuwe Donna-endpoints |

### Donna-gateway (`/api/donna/v1`)
`GET /subscriptions`, `GET /subscriptions/:id`, `POST /subscriptions`,
`PATCH /subscriptions/:id`, `POST /subscriptions/:id/invoiced`,
`GET /billing/due`, `GET /agreements/gaps`. Zelfde bearer-auth en
`donnaResponse`/`DonnaError`-stijl. Details: `docs/donna-subscriptions-gateway.md`.

## Facturen

- **PDF = printpagina door Chromium**, net als de offerte. `/print/invoices/[id]`
  meet elke regel en verdeelt ze over A4-pagina's met `paginateInvoice()`
  (`src/lib/invoice-layout.ts`, getest). Zet `data-invoice-ready` op `<html>` als
  hij klaar is; `/api/invoices/[id]/pdf` wacht daarop.
- **Alleen een concept is bewerkbaar.** Na "Verzonden" liggen inhoud en regels
  vast (409 in de PATCH), en verwijderen kan alleen bij een concept. Corrigeren
  gaat met een creditfactuur (nog niet gebouwd).
- **Nummers doorlopend per jaar** via `nextInvoiceNumber()`, nooit tellen of
  willekeurig. De MCP-tool `create_invoice` doet hetzelfde.
- **Jouw gegevens op de factuur** (adres, KvK, btw-id, IBAN, betaaltermijn) staan
  in `Company.settings.invoice`, via Instellingen. `readInvoiceSettings()` leest ze.
- Groepen in de specificatie komen uit `InvoiceLine.groupLabel`; opeenvolgende
  regels met hetzelfde label vormen één groep.

## Migraties
`npm run db:push` is **verboden**: schema en database zijn uit elkaar gelopen
(`QuoteTemplate` en `Quote.document` staan wel in de database, niet in het
schema). Push zou die droppen. Altijd handgeschreven SQL met
`ADD COLUMN IF NOT EXISTS`, daarna `npx prisma generate`.

Genummerde migraties staan in `scripts/migrations/`. Draaien:
`node scripts/run-migration.mjs scripts/migrations/<bestand>.sql` (draait de SQL
in één transactie tegen `DATABASE_URL`). Rollback-notities staan bovenaan elk
SQL-bestand.

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
