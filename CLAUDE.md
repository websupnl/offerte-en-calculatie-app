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

Login: `daan@websup.nl` / `Admin123!`

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
