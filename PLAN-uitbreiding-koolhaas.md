# Uitbreiding Koolhaas Installaties — ERP/FSM

## Doel
De offerte-app uitbreiden naar een volledige workflow-app voor Koolhaas Installaties,
vergelijkbaar met Syntes (huidige werkgever Bouma). Alles gefaseerd, zonder de bestaande
offerte-functionaliteit te breken.

## Architectuur — Project als spil

```
Relatie (klant/leverancier)
  └── Project
        ├── Offerte(s)        ← al gebouwd
        ├── Werkbon(nen)      ← fase 2
        ├── Verkoop factuur   ← fase 3 (genereer vanuit offerte)
        ├── Inkoop facturen   ← fase 4 (upload bonnetjes)
        └── Bestanden         ← file storage (MinIO op VPS)
```

## Fase 1 — Project + Relatie upgrade

**Prisma: nieuwe/gewijzigde modellen**

```prisma
model Project {
  id          String   @id @default(cuid())
  companyId   String
  customerId  String
  number      String   // bijv. KI-2026-P001
  title       String
  description String?
  status      String   @default("OPEN") // OPEN | IN_PROGRESS | DONE | ARCHIVED
  address     String?
  city        String?
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company     Company    @relation(...)
  customer    Customer   @relation(...)
  quotes      Quote[]
  workOrders  WorkOrder[]
  invoices    SalesInvoice[]
  purchaseInvoices PurchaseInvoice[]
  files       ProjectFile[]
}
```

**Customer uitbreiden:**
- `kvk` String?
- `vatNumber` String?
- `iban` String?
- `type` String? (KLANT | LEVERANCIER | BEIDE)
- `contactPersons` → aparte ContactPerson tabel

**Quote uitbreiden:**
- `projectId` String? (optionele koppeling)

**UI:**
- Nieuwe sectie "Projecten" in de sidebar
- Projectdetail-pagina met tabs: Overzicht / Offertes / Werkbonnen / Facturen / Bestanden

---

## Fase 2 — Werkbonnen

```prisma
model WorkOrder {
  id          String   @id @default(cuid())
  companyId   String
  projectId   String
  number      String   // KI-2026-W001
  title       String
  description String?
  status      String   @default("CONCEPT") // CONCEPT | GEPLAND | UITGEVOERD | GEFACTUREERD
  scheduledAt DateTime?
  executedAt  DateTime?
  technicianName String?
  
  // Regels (materiaal + uren)
  lines       WorkOrderLine[]
  
  // Handtekening klant
  signatureUrl String?
  signedAt     DateTime?
  signedBy     String?
  
  // Koppeling
  project     Project @relation(...)
  salesInvoice SalesInvoice? // als gefactureerd
}

model WorkOrderLine {
  id          String  @id @default(cuid())
  workOrderId String
  type        String  // MATERIAAL | ARBEID
  description String
  qty         Decimal
  unit        String? // stuk, m, uur
  unitPrice   Decimal
  costPrice   Decimal?
}
```

**Features:**
- Mobiel-vriendelijk (je vult bon in op de telefoon)
- Klant kan digitaal tekenen (touch signature)
- PDF genereren van werkbon
- Koppelen aan bestaande offerte (materiaal pre-invullen vanuit offerte)

---

## Fase 3 — Verkoop facturen

```prisma
model SalesInvoice {
  id          String   @id @default(cuid())
  companyId   String
  customerId  String
  projectId   String?
  quoteId     String?   // gegenereerd vanuit offerte
  workOrderId String?   // of vanuit werkbon
  number      String    // KI-2026-F001
  status      String    @default("CONCEPT") // CONCEPT | VERZONDEN | BETAALD | VERVALLEN
  invoiceDate DateTime  @default(now())
  dueDate     DateTime?
  
  lines       InvoiceLine[]
  
  totalExVat  Decimal
  totalVat    Decimal
  totalIncVat Decimal
}
```

**Features:**
- Genereer factuur vanuit geaccepteerde offerte (1-klik)
- Genereer factuur vanuit werkbon
- PDF factuur (uitbreiden bestaand PDF-systeem)
- Status bijhouden (concept → verzonden → betaald)
- UBL/e-factuur export (later, fase 5)

---

## Fase 4 — Inkoop facturen

```prisma
model PurchaseInvoice {
  id           String   @id @default(cuid())
  companyId    String
  projectId    String?
  supplierName String
  invoiceNumber String?
  invoiceDate  DateTime?
  amount       Decimal
  vatAmount    Decimal?
  status       String   @default("ONTVANGEN") // ONTVANGEN | GEBOEKT | BETAALD
  fileUrl      String?  // scan/foto van de bon
  notes        String?
}
```

**Features:**
- Foto van bon uploaden (telefoon)
- Koppelen aan project
- Overzicht inkoop per project (voor calculatie/marge)

---

## Fase 5 — Voorraad (later)

Pas relevant als je een magazijn/bus hebt met vaste voorraad.
Modellen: `StockItem`, `StockMovement`, `StockLocation`.
Buiten scope voor nu.

---

## File storage — MinIO op VPS

**Keuze: MinIO** (S3-compatible, draait op eigen VPS naast Coolify)

**Setup:**
```yaml
# docker-compose toevoeging op VPS
minio:
  image: minio/minio
  ports:
    - "9000:9000"   # API
    - "9001:9001"   # Console (browser)
  volumes:
    - /data/minio:/data
  environment:
    MINIO_ROOT_USER: admin
    MINIO_ROOT_PASSWORD: [sterk wachtwoord]
  command: server /data --console-address ":9001"
```

**Buckets:**
- `koolhaas-bestanden` — projectbestanden, werkbonnen, facturen
- `koolhaas-uploads` — tijdelijke uploads

**In de app:**
- Package: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- Upload via presigned URL (direct van browser naar MinIO)
- Of via Next.js API route (voor kleinere bestanden)

**Env vars:**
```
MINIO_ENDPOINT=https://minio.koolhaasinstallaties.nl
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=koolhaas-bestanden
```

**ProjectFile model:**
```prisma
model ProjectFile {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  url         String   // MinIO object key
  mimeType    String?
  size        Int?
  uploadedAt  DateTime @default(now())
  category    String?  // OFFERTE | WERKBON | FACTUUR | FOTO | OVERIG
}
```

---

## Volgorde van uitvoering

1. **MinIO opzetten op VPS** — los van de app, geen risico
2. **Fase 1: Project + Relatie upgrade** — Prisma migratie + UI
3. **Fase 2: Werkbonnen** — meest waardevolle voor dagelijks gebruik
4. **Fase 3: Verkoop facturen** — logisch na werkbonnen
5. **Fase 4: Inkoop facturen** — voor margeinzicht per project

## Risico's

- **Schema-migraties**: altijd additief werken (geen kolommen verwijderen of verplicht maken zonder default)
- **Bestaande routes**: offerte-flow wordt niet aangeraakt
- **Multi-tenant**: alle nieuwe modellen krijgen `companyId` — zelfde patroon als nu
- **WebsUp**: die hoeft geen projecten/werkbonnen. Company-switcher bepaalt wat zichtbaar is.

## Sidebar navigatie na uitbreiding (koolhaas)

```
Dashboard
Relaties
Projecten
  └── [project] → Offertes / Werkbonnen / Facturen / Bestanden
Offertes (standalone, zonder project)
Werkbonnen
Facturen
  ├── Verkoop
  └── Inkoop
Producten / Inkoopprijzen
Instellingen
```
