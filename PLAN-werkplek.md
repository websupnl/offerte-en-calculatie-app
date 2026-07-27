# Plan — Werkplek: taken, notities, agenda, contracten & klantomgeving

Vervolg op `PLAN-uitbreiding-koolhaas.md` (fase 1–4: Project → werkbon → factuur → inkoop).
Dat plan maakte de app een ERP voor Koolhaas. Dit plan maakt er **mijn werkplek** van —
voor WebsUp én Koolhaas én privé — met een klantomgeving die WhatsApp/mail/mondelinge
feedback vervangt.

---

## 1. Waarom in dit project en niet los

Wat er al staat en anders dubbel gebouwd zou moeten worden:

| Bestaand | Hergebruik voor dit plan |
|---|---|
| NextAuth v5 + JWT + `activeCompanyId` | Inloggen, multi-tenant scoping |
| `Company` / `CompanyUser` | Zakelijke scheiding websup/koolhaas |
| `Customer`, `Project` | Waar taken/notities/feedback aan hangen |
| `QuoteShare` token-portaal (`/q/[token]`) | Patroon voor klanttoegang zonder wachtwoord |
| `src/lib/storage.ts` (MinIO, presigned) | Uploads: screenshots, bijlagen, contracten |
| `src/lib/notifications.ts` (Telegram) | Directe ping bij nieuwe klantfeedback |
| `src/lib/email.ts` (Resend) | Digest-mails, magic links |
| Handtekening-flow uit werkbonnen (fase 2) | Contract ondertekenen |
| `src/components/layout/global-search.tsx` | Zoeken over taken/notities uitbreiden |

Los bouwen betekent: tweede auth, tweede klantendatabase, tweede storage-laag, en twee
plekken waar je moet kijken. Dat is de investering niet waard.

---

## 2. Kernidee

Eén takenlaag met **meerdere ingangen** en **twee assen**:

```
                       ┌─ ingangen ─────────────────────┐
  klant pint op site ──┤                                │
  ik upload screenshot ┤                                │
  ik typ het zelf ─────┤──►   Task / Note   ──►  agenda, digest, klantportaal
  klant stuurt bericht ┤                                │
  terugkerende taak ───┤                                │
  AI vat gesprek samen ┘                                │
                       └────────────────────────────────┘

  as 1 — scope:       BUSINESS (companyId) | PRIVATE (ownerId, geen company)
  as 2 — zichtbaar:   INTERNAL | SHARED (klant ziet 't in het portaal)
```

De review-tool is dus **niet het systeem** — het is één van de ingangen.

**Belangrijke eigenschap van dit ontwerp:** privé-items hebben `companyId = null`.
Alle bestaande queries filteren op `companyId`, dus privédata kan per constructie niet in
een zakelijk overzicht lekken. En bedrijf wisselen verandert je privé-lijst niet.

---

## 3. Datamodel

Stijl volgt de bestaande fase 1–4 modellen: `String` statussen met comment i.p.v. Prisma
enums (scheelt `ALTER TYPE`-gedoe bij Postgres-migraties, en statussen groeien altijd).

### 3.1 Taken

```prisma
model TaskList {
  id        String   @id @default(cuid())
  companyId String?  // null = privé
  ownerId   String
  name      String
  kind      String   @default("LIST") // LIST | SHOPPING | BOARD
  icon      String?  // lucide-icoonnaam
  color     String?
  sortOrder Int      @default(0)
  archivedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company? @relation(fields: [companyId], references: [id], onDelete: Cascade)
  owner   User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  tasks   Task[]

  @@index([companyId])
  @@index([ownerId])
}

model Task {
  id        String  @id @default(cuid())
  companyId String? // null = privé
  ownerId   String
  listId    String?

  // koppelingen (allemaal optioneel — een taak mag los bestaan)
  projectId     String?
  customerId    String?
  quoteId       String?
  reviewBoardId String?

  title       String
  description String? @db.Text
  status      String  @default("OPEN") // OPEN | DOING | WAITING | DONE | CANCELLED
  priority    Int     @default(0)      // 0 normaal | 1 hoog | 2 urgent

  // agenda
  startAt   DateTime?
  endAt     DateTime?
  allDay    Boolean   @default(false)
  dueAt     DateTime?
  remindAt  DateTime?

  // herhaling
  recurRule    String? // subset RRULE: FREQ=YEARLY;INTERVAL=1
  recurUntil   DateTime?
  parentTaskId String? // uit welke herhaling gegenereerd

  // externe agenda
  calendarEventId  String?
  calendarSyncedAt DateTime?

  // review-pin (alleen gevuld bij source PORTAL_PIN / SCREENSHOT_PIN)
  pin Json? // { url, selector, xPct, yPct, scrollY, viewport, thumbKey, deployId }

  source     String  @default("MANUAL")   // MANUAL | PORTAL_PIN | PORTAL_MESSAGE | EMAIL | AI | RECURRING
  visibility String  @default("INTERNAL") // INTERNAL | SHARED
  assignedToId String? // toekomst: personeel/onderaannemer

  sortOrder   Int       @default(0)
  completedAt DateTime?
  deletedAt   DateTime? // prullenbak
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  company     Company?     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  owner       User         @relation("TaskOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  assignedTo  User?        @relation("TaskAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  list        TaskList?    @relation(fields: [listId], references: [id], onDelete: SetNull)
  project     Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)
  customer    Customer?    @relation(fields: [customerId], references: [id], onDelete: SetNull)
  quote       Quote?       @relation(fields: [quoteId], references: [id], onDelete: SetNull)
  reviewBoard ReviewBoard? @relation(fields: [reviewBoardId], references: [id], onDelete: Cascade)
  comments    Comment[]
  attachments Attachment[]
  timeEntries TimeEntry[]
  tags        TagOnTask[]

  @@index([companyId, status])
  @@index([ownerId, status])
  @@index([projectId])
  @@index([dueAt])
}
```

Waarom één `Task` voor todo's, afspraken, boodschappen én klantfeedback: het zijn allemaal
"iets dat open staat en dicht moet". Een boodschappenlijst is een `TaskList` met
`kind = SHOPPING`; een afspraak is een taak met `startAt`. Drie losse modellen zou drie
losse overzichten, drie zoekfuncties en drie sync-implementaties betekenen.

### 3.2 Notities

```prisma
model Note {
  id         String  @id @default(cuid())
  companyId  String? // null = privé
  ownerId    String
  projectId  String?
  customerId String?

  title  String?
  body   String  @db.Text // markdown
  pinned Boolean @default(false)
  visibility String @default("INTERNAL") // INTERNAL | SHARED

  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company     Company?     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  owner       User         @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  project     Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)
  customer    Customer?    @relation(fields: [customerId], references: [id], onDelete: SetNull)
  attachments Attachment[]
  tags        TagOnNote[]

  @@index([companyId, updatedAt(sort: Desc)])
  @@index([ownerId, updatedAt(sort: Desc)])
}
```

### 3.3 Gesprek (herbruikt voor taken én klantfeedback)

```prisma
model Comment {
  id     String @id @default(cuid())
  taskId String

  authorUserId   String? // ik
  authorPortalId String? // klant, via PortalAccess
  authorName     String  // gedenormaliseerd voor weergave

  body       String  @db.Text
  visibility String  @default("INTERNAL") // INTERNAL | SHARED

  createdAt DateTime @default(now())

  task         Task          @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorUser   User?         @relation(fields: [authorUserId], references: [id], onDelete: SetNull)
  authorPortal PortalAccess? @relation(fields: [authorPortalId], references: [id], onDelete: SetNull)
  attachments  Attachment[]

  @@index([taskId, createdAt])
}
```

Let op: een `Comment` met `visibility = INTERNAL` op een gedeelde taak is mijn eigen
kladblok bij dat feedbackpunt — klant ziet 'm niet. Dat wil je, anders ga je alsnog
buiten het systeem om praten.

### 3.4 Bijlagen (generiek)

```prisma
model Attachment {
  id        String  @id @default(cuid())
  companyId String?

  // precies één van deze is gevuld
  taskId     String?
  noteId     String?
  commentId  String?
  contractId String?

  objectKey String @db.Text // MinIO
  fileName  String
  mimeType  String
  size      Int
  width     Int?
  height    Int?

  uploadedByUserId   String?
  uploadedByPortalId String?
  createdAt          DateTime @default(now())

  task     Task?     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  note     Note?     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  comment  Comment?  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  contract Contract? @relation(fields: [contractId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@index([noteId])
}
```

Nullable FK's i.p.v. polymorfie — zelfde patroon als `SalesInvoice.quoteId?/workOrderId?`.

### 3.5 Contracten

```prisma
model Contract {
  id         String  @id @default(cuid())
  companyId  String
  customerId String
  projectId  String?
  quoteId    String? // ontstaan uit een geaccepteerde offerte

  number String  // WS-2026-C001
  title  String
  body   String? @db.Text // markdown, of leeg als het een geüploade PDF is
  status String  @default("CONCEPT") // CONCEPT | VERZONDEN | GETEKEND | ACTIEF | OPGEZEGD | VERLOPEN

  startDate    DateTime?
  endDate      DateTime?
  noticePeriodDays Int?     // opzegtermijn
  autoRenew    Boolean  @default(false)
  renewalNoticeAt DateTime? // wanneer moet ik erover nadenken → wordt automatisch een Task

  // terugkerende waarde (onderhoudscontract, hosting)
  recurringAmount Decimal? @db.Decimal(10, 2)
  recurringPeriod String?  // MONTH | QUARTER | YEAR

  // ondertekening — hergebruikt de werkbon-handtekeningflow
  signatureKey String?
  signedAt     DateTime?
  signedBy     String?
  shareToken   String?  @unique @default(uuid())

  pdfKey    String? @db.Text
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company     Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  customer    Customer     @relation(fields: [customerId], references: [id])
  project     Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)
  quote       Quote?       @relation(fields: [quoteId], references: [id], onDelete: SetNull)
  attachments Attachment[]
  events      ContractEvent[]

  @@index([companyId, status])
}

model ContractEvent {
  id         String   @id @default(cuid())
  contractId String
  type       String   // CREATED | SENT | VIEWED | SIGNED | RENEWED | TERMINATED | NOTE
  detail     String?  @db.Text
  actor      String?
  createdAt  DateTime @default(now())

  contract Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)

  @@index([contractId, createdAt])
}
```

`ContractEvent` = audit-spoor. Bij een contract wil je later kunnen aantonen wanneer wat
gebeurde; bij een taak boeit dat niet.

### 3.6 Klanttoegang

```prisma
model PortalAccess {
  id         String  @id @default(cuid())
  companyId  String
  customerId String
  projectId  String? // null = alle projecten van deze klant

  token String  @unique @default(uuid())
  email String?
  name  String?
  label String? // "Jan (marketing)"

  canComment Boolean @default(true)
  canUpload  Boolean @default(true)

  lastSeenAt DateTime?
  expiresAt  DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  company  Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  customer Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  project  Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  comments Comment[]

  @@index([customerId])
}
```

Geen wachtwoorden. Magic link per mail, token in een httpOnly-cookie na eerste bezoek,
zodat de klant niet elke keer de mail hoeft op te zoeken. Zelfde geest als `QuoteShare`,
maar op klant/project-niveau in plaats van per offerte.

### 3.7 Review-boards

```prisma
model ReviewBoard {
  id        String  @id @default(cuid())
  companyId String
  projectId String

  name String  // "Homepage", "Checkout stap 2"
  kind String  @default("LIVE") // LIVE | IMAGE
  url  String? // LIVE
  imageKey    String? @db.Text // IMAGE (full-page screenshot in MinIO)
  imageWidth  Int?
  imageHeight Int?

  status    String   @default("OPEN") // OPEN | RESOLVED | ARCHIVED
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pins    Task[]

  @@index([projectId])
}
```

### 3.8 Tags & tijd

```prisma
model Tag {
  id        String  @id @default(cuid())
  companyId String?
  ownerId   String
  name      String
  color     String?

  tasks TagOnTask[]
  notes TagOnNote[]

  @@unique([companyId, ownerId, name])
}

model TagOnTask { tagId String; taskId String; /* @@id([tagId, taskId]) */ }
model TagOnNote { tagId String; noteId String; /* @@id([tagId, noteId]) */ }

model TimeEntry {
  id        String   @id @default(cuid())
  companyId String
  userId    String
  taskId    String?
  projectId String?
  startedAt DateTime
  endedAt   DateTime?
  minutes   Int?
  note      String?
  billable  Boolean  @default(true)
  invoicedOnId String? // SalesInvoice waarin dit is meegenomen
  createdAt DateTime @default(now())

  @@index([companyId, startedAt])
  @@index([taskId])
}
```

### 3.9 Integraties & push

```prisma
model UserIntegration {
  id       String @id @default(cuid())
  userId   String
  provider String // GOOGLE_CALENDAR

  accessToken  String   @db.Text
  refreshToken String   @db.Text
  expiresAt    DateTime?
  calendarId   String?
  syncToken    String?  @db.Text // incrementele pull
  lastSyncAt   DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique @db.Text
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 3.10 Uitbreidingen op bestaande modellen

```prisma
model Project {
  // ...
  previewUrl   String?   // waar staat de site die de klant mag reviewen
  reviewBoards ReviewBoard[]
  tasks        Task[]
  notes        Note[]
  contracts    Contract[]
  portalAccess PortalAccess[]
}

model Customer {
  // ...
  tasks        Task[]
  notes        Note[]
  contracts    Contract[]
  portalAccess PortalAccess[]
}

model User {
  // ...
  ownedTasks    Task[] @relation("TaskOwner")
  assignedTasks Task[] @relation("TaskAssignee")
  taskLists     TaskList[]
  notes         Note[]
  comments      Comment[]
  integrations  UserIntegration[]
  pushSubs      PushSubscription[]
}
```

---

## 4. Statistieken: concepten tellen niet mee

**Probleem nu:**

- `src/app/(dashboard)/dashboard/page.tsx:54-56` — "Open offertewaarde" telt `DRAFT` mee in
  het bedrag. Een half afgemaakt concept van €30.000 staat dus in je pijplijn.
- `src/app/(dashboard)/admin/dashboard/page.tsx:36` — `stats.open` bevat `DRAFT`, dus de
  "potentiële marge" bevat concepten. `stats.total` telt concepten ook mee.

Conversie klopt op beide plekken al wel (concepten zijn daar al uit de noemer gehaald).

**Oplossing:** één gedeelde bron van waarheid, zodat een volgende statistiek dit niet
opnieuw fout kan doen.

```ts
// src/lib/stats.ts
export const DRAFT_STATUSES = {
  quote: "DRAFT",
  invoice: "CONCEPT",
  workOrder: "CONCEPT",
  calculation: "DRAFT",
} as const;

/** Offertestatussen die meetellen in omzet/pijplijn/marge. */
export const COUNTED_QUOTE_STATUSES = ["SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"];

/** Where-fragment: sluit concepten uit. */
export const excludeDraftQuotes = { status: { not: "DRAFT" } };
```

Regel: **een concept is werkvoorraad, geen cijfer.** Concepten mogen wel geteld worden als
"aantal concepten" (werkvoorraad-blok), maar nooit in een bedrag, marge of conversie.
Zelfde regel geldt voor `CONCEPT`-facturen en `CONCEPT`-werkbonnen zodra die in cijfers
opduiken.

---

## 5. AI: lokale CLI via relay in plaats van OpenAI-API

### Waarom dit werkt
De Vercel-app kan geen CLI starten (geen `claude`-binary in een serverless functie). Maar
hij kan wél een HTTP-verzoek doen naar mijn laptop, als die laptop bereikbaar is. De CLI
draait dan op mijn machine, op mijn Claude-abonnement — geen API-kosten per token.

```
Vercel app  ──HTTPS──►  Cloudflare Tunnel  ──►  ai-relay op laptop  ──►  claude / codex CLI
   (knop)                 (vast adres)            (poort 8787)            (subprocess)
```

### Onderdelen

**1. `scripts/ai-relay.mjs`** — losstaand Node-servertje, draait naast de dev-omgeving:
- `POST /job` met `{ type, input }`, auth via `Authorization: Bearer $AI_RELAY_KEY`
- `GET /health` → `{ ok: true, cli: "claude", version: "..." }`
- Spawnt `claude -p <prompt> --output-format json` als **subprocess met argv**, nooit via
  een shell — geen injectie-risico via prompttekst
- Draait met tools uit (`--allowedTools ""`): pure tekstgeneratie, kan niets op de schijf
- Max 2 gelijktijdige jobs, harde timeout (120s), joblog naar stdout
- Alleen **bekende job-types** (`quote-text`, `advice`, `summarize-feedback`,
  `task-from-text`), elk met een eigen systeemprompt in de relay — de webapp stuurt data,
  geen vrije systeemprompt

**2. Tunnel** — Cloudflare Tunnel (named tunnel = vast hostname, gratis) of Tailscale
Funnel. `npm run ai:relay` start relay + tunnel samen via `concurrently` (zit al in devDeps).

**3. `src/lib/ai/provider.ts`** — abstractielaag boven het huidige `src/lib/openai.ts`:

```ts
type AiProvider = "local-cli" | "openai" | "none";

export async function aiGenerate(job: AiJob): Promise<AiResult>
export async function aiStatus(): Promise<{ provider: AiProvider; online: boolean }>
```

Keuze op basis van env: `AI_RELAY_URL` gezet en `/health` binnen 3s ok → `local-cli`.
Anders `OPENAI_API_KEY` aanwezig → `openai`. Anders `none`.

**4. UI-gedrag** — een klein statusbolletje in de header: *AI beschikbaar* / *AI offline
(laptop uit)*. AI-knoppen zijn disabled met die uitleg in plaats van een spinner die
vastloopt. Health-status 30s gecachet zodat niet elke paginaload de tunnel aantikt.

**5. Bestaande routes** (`/api/ai/quote-text`, `/api/ai/advice`) gaan via de nieuwe laag.
`src/lib/openai.ts` blijft bestaan als fallback-provider; als ik de OpenAI-key uit Vercel
haal, is de app gewoon local-only.

### Consequentie die ik moet accepteren
Laptop dicht = geen AI, ook niet vanaf de telefoon. Voor offertetekst genereren (bureauwerk)
prima. Voor "AI vat deze klantfeedback samen" onderweg: dan wacht dat tot ik thuis ben.

---

## 6. Agenda

**Stap 1 — ICS-feed (snel, geen OAuth).**
`GET /api/calendar/[feedToken].ics` levert alle taken met `startAt`/`dueAt` als VEVENT.
Abonneren in Google/Apple Agenda. Werkt binnen een uur, read-only, en Google ververst
traag (soms uren) — daarom niet het eindstation.

**Stap 2 — Google Calendar OAuth, push (app → Google).**
`UserIntegration` met refresh token. Taak met `startAt` → event aanmaken/bijwerken,
`calendarEventId` opslaan. Verwijderde/afgeronde taak → event weg. Direct zichtbaar op de
telefoon.

**Stap 3 — pull (Google → app).**
Incrementele sync via `syncToken`. Afspraken uit mijn gewone agenda verschijnen in het
dagoverzicht van de app, zodat ik één plek heb om te kijken. Conflictregel: wie het laatst
wijzigde wint, en events die de app niet zelf heeft aangemaakt zijn read-only in de app.

Privé-taken syncen standaard naar een aparte Google-agenda ("Privé") — niet naar dezelfde
als zakelijke afspraken.

---

## 7. Klantomgeving

### 7.1 Van "offerte accepteren" naar echte omgeving

`/q/[token]` blijft bestaan zoals het is (offerte accepteren). Daarnaast komt
`/portal/[token]` — de klantomgeving:

```
/portal/[token]
  ├── Overzicht      status project, wat gebeurt er nu, wat verwacht ik van jou
  ├── Feedback       lijst met punten + status + reageren + nieuw punt toevoegen
  ├── Review         live site / screenshots met pins
  ├── Documenten     offertes, contracten, opgeleverde bestanden
  └── Contracten     tekenen
```

De klant ziet **alleen** wat `visibility = SHARED` heeft. Standaard staat alles op
`INTERNAL` — delen is een bewuste actie, geen ongelukje.

### 7.2 Feedbackstatus

`OPEN → DOING → DONE → (klant bevestigt) GESLOTEN`. De klant ziet dus zonder te appen of
ik het al heb opgepakt. Dat is het halve punt van dit hele systeem.

### 7.3 Notificaties zonder spam

- **Naar mij:** Telegram (bestaat al) direct bij nieuwe feedback — dat is wat ik wil weten.
- **Naar de klant:** géén mail per statuswissel. Eén digest-mail per dag ("3 punten
  afgerond, 1 vraag voor je") via Resend, plus direct mail alleen bij een echte vraag aan
  hen. Anders is het portaal de nieuwe WhatsApp-ruis.

---

## 8. Review-tool — de technische kern

### 8.1 Waarom een iframe alleen niet werkt

Een cross-origin iframe is dicht: vanuit mijn app kan ik **niet** in de site klikken,
de DOM lezen, of de scrollpositie opvragen. Same-origin policy. Een transparante
klik-overlay eroverheen lijkt een oplossing, maar de pin drijft weg zodra de klant scrollt
(ik weet die scrollpositie niet) en de klant kan dan niet meer door de site navigeren.
Doodlopende weg — niet aan beginnen.

### 8.2 Wat wél werkt: een review-widget op de site zelf

Omdat ik die sites zelf bouw, kan ik er een scriptje op zetten:

```html
<script defer src="https://app.websup.nl/review.js" data-project="PROJECT_ID"></script>
```

Het script activeert zich alleen als de URL `?review=TOKEN` bevat (of er een review-cookie
staat), dus gewone bezoekers merken er niets van en het laadt niets zwaars.

Wat je dan krijgt, wat met een iframe niet kan:
- klant browst gewoon de echte site, klikt in "pin-modus" op een element
- ik leg **CSS-selector + percentage-positie binnen dat element** vast, niet losse x/y —
  de pin blijft dus staan als de layout schuift
- viewportbreedte + scrollpositie erbij → ik zie of het een mobiel- of desktopklacht is
- het widget maakt zelf een crop-screenshot van dat gebied mee
- werkt op de telefoon (tap = pin, geen hover nodig)

De app toont die site daarnaast in een iframe met het widget erin; die praten via
`postMessage` — dan kan ik als eigenaar ook pinnen vanuit het dashboard.

### 8.3 Universele fallback: screenshot-boards

Voor sites die ik niet host (of als het gewoon sneller is): full-page screenshot uploaden
— door mij via een browserextensie, of door de klant. Wordt een `ReviewBoard` met
`kind = IMAGE`. Pinnen gebeurt op percentage-coördinaten van de afbeelding, dus
resolutie-onafhankelijk.

`playwright-core` + `@sparticuz/chromium-min` zitten al in de dependencies (van de
scrapers), dus later automatisch screenshots maken vanuit de app kan ook zonder nieuwe
infra.

### 8.4 Elke pin is gewoon een taak

Een pin schrijft een `Task` weg met `source = PORTAL_PIN`, `reviewBoardId`, `pin`-JSON en
`visibility = SHARED`. Daarmee zit klantfeedback automatisch in dezelfde takenlijst als de
rest van mijn werk. Geen overtypen, geen tweede lijst.

### 8.5 Koppeling aan deploys

Bij een pin sla ik op welke deploy actief was (Vercel-deploy-id via een meta-tag of header).
Bij het bekijken van oude feedback zie ik dan: *"dit ging over de versie van 3 dagen
geleden, er is sindsdien 2x gedeployed"* — scheelt discussies over al opgeloste punten.

---

## 9. Mobiel: PWA, geen native app

Native (React Native/Expo) betekent een tweede codebase, een tweede auth-implementatie, een
sync-laag en appstore-releases. Dat is niet in verhouding tot wat ik nodig heb: snel een
notitie, boodschap of foto toevoegen, en mijn dag zien.

**PWA op dezelfde app:**
- `src/app/manifest.ts` (Next 16 metadata-route) — `display: standalone`, icons, theme color
- `public/sw.js` — app-shell cache-first, data network-first
- Web Push via VAPID + `PushSubscription` — werkt op iOS 16.4+ als de app op het beginscherm
  staat. Vervangt Telegram-pings op termijn, en werkt ook voor de klant.
- Offline: boodschappenlijstjes en snelle notities in IndexedDB met een sync-wachtrij.
  Dit is échte complexiteit (conflictafhandeling), dus eigen fase — niet meeliften.
- Snelle invoer: `share_target` in het manifest, zodat ik vanuit elke app kan delen naar
  "nieuwe taak/notitie". Plus camera-upload direct vanaf de telefoon.

---

## 10. Dingen die ik nu vastleg zodat ze later niet pijn doen

| Onderwerp | Beslissing nu |
|---|---|
| Personeel/onderaannemers | `assignedToId` staat er vanaf dag 1 in, UI komt later — scheelt migratie |
| Zoeken over alles | `global-search.tsx` uitbreiden met taken/notities/contracten; op termijn Postgres full-text index |
| Snelle invoer | Quick-add met natuurlijke taal ("morgen 10:00 Arjan bellen") + `Cmd+K` command palette |
| Prullenbak | `deletedAt` op Task/Note/Contract i.p.v. hard delete |
| Audit | Alleen op contracten (`ContractEvent`) — bij taken overkill |
| Mail naar taak | Resend inbound of forward-adres → `source = EMAIL`. Fase later, model ondersteunt het al |
| Backup | Neon point-in-time + wekelijkse JSON-export naar MinIO zodra dit bedrijfskritisch wordt |
| Privé-lekkage | `companyId = null` bij privé; helper `scopeWhere(session, scope)` verplicht in elke query |
| Facturatie van tijd | `TimeEntry.invoicedOnId` → uren kunnen later een factuurregel worden |
| Contractverlenging | `renewalNoticeAt` genereert automatisch een taak — anders vergeet ik het toch |

---

## 11. Fasering

Elke fase is losstaand bruikbaar en breekt niets van fase 1–4.

**Stand juli 2026: fase 0 t/m 7 gebouwd.** Fase 8 (offline-first, tijdregistratie,
zoeken over alles) staat nog open. `TimeEntry` staat al in het schema zodat dat
later geen migratie kost.

| Fase | Wat | Omvang |
|---|---|---|
| **0** ✅ | Statistiekfix concepten + `src/lib/stats.ts` | klein |
| **1** ✅ | Datamodel Task/TaskList/Note/Comment/Attachment/Tag + `/tasks` en `/notes` UI, privé + zakelijk, quick-add | groot |
| **2** ✅ | AI-relay: `scripts/ai-relay.mjs`, tunnel, `src/lib/ai/provider.ts`, statusindicator, bestaande AI-routes omzetten | middel |
| **3** ✅ | Agenda: ICS-feed → Google OAuth push → pull. Herhalende taken. | middel |
| **4** ✅ | Contracten + ondertekenen (hergebruik handtekeningflow) + verlengingsherinneringen | middel |
| **5** ✅ | Klantportaal `/portal/[token]`: PortalAccess, magic link, feedbacklijst, reacties, uploads, digest-mail | groot |
| **6** ✅ | Review-tool: screenshot-boards eerst, daarna `review.js`-widget + live pinnen + deploy-koppeling | groot |
| **7** ✅ | PWA: manifest, service worker, web push, share target | middel |
| **8** ⬜ | Offline-first (IndexedDB + syncwachtrij), tijdregistratie, zoeken over alles | later |

**Projecten voor WebsUp aanzetten** hoort bij fase 1: de `koolhaasOnly`-vlag op
`/projects` (`src/components/layout/sidebar.tsx:65`) moet eraf, want WebsUp-projecten zijn
de drager van klantfeedback. Werkbonnen en facturen blijven koolhaas-only.

---

## 12. Volgorde-argument

Fase 1 en 2 leveren direct dagelijks nut op zonder dat er ook maar één klant iets hoeft te
doen. Fase 5 en 6 (het "geniale" klantstuk) bouwen daar bovenop en zijn onmogelijk goed te
maken zonder dat de takenlaag eronder al klopt — anders bouw ik een feedback-tool die z'n
resultaten nergens kwijt kan.
