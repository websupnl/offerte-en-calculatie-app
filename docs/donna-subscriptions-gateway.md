# Donna-gateway — abonnementen, facturatie & akkoorden

Uitbreiding op `https://offerte.websup.nl/api/donna/v1`. Zelfde conventies als de
bestaande gateway:

- **Auth:** `Authorization: Bearer <DONNA_GATEWAY_TOKEN>` op elk endpoint.
- **JSON in/uit.** Elk antwoord bevat `schemaVersion`. Fouten:
  `{ "error": { "code": "<CODE>", "message": "<tekst>" } }` met bijpassende
  HTTP-status. Geen redirects.
- **Bedragen: altijd hele centen als integer** (`priceCents`, `amountCents`,
  `totalIncVatCents`), nooit euro's of floats. Aan de leeskant `Number()`, dus
  `134` = € 1,34.
- **Datums:** `startDate` / `nextBillingDate` als `YYYY-MM-DD`. Tijdstempels
  (`lastInvoicedAt`, `occurredAt`, `acceptedAt`) als ISO 8601.
- **`companyKey`:** `koolhaas-installaties` of `websup`.
- **`billingCycle`:** `MONTHLY` | `QUARTERLY` | `YEARLY`.
- **`status` (abonnement):** `ACTIVE` | `PAUSED` | `CANCELLED`.

`GET /health` geeft nu een `features`-array terug met o.a. `subscriptions`,
`billing-due`, `agreement-gaps`.

---

## Datatype: `Subscription`

```json
{
  "id": "cmsub...",
  "companyKey": "websup",
  "clientRef": "cmcus..." ,          // customerId, of null bij een legacy-abonnement
  "clientName": "Klant BV",
  "serviceName": "Hosting & Beheer",
  "priceCents": 12000,               // per periode, EX btw
  "vatRate": 21,
  "currency": "EUR",
  "billingCycle": "YEARLY",
  "startDate": "2026-09-10",
  "nextBillingDate": "2027-09-10",
  "lastInvoicedAt": null,            // ISO 8601 of null
  "status": "ACTIVE",
  "sourceQuoteId": "cmquo..." ,       // of null
  "migrationPending": false,
  "notes": null,
  "createdAt": "2026-09-10T12:00:00.000Z",
  "updatedAt": "2026-09-10T12:00:00.000Z"
}
```

`GET /subscriptions/:id` voegt `history` toe: een array van
`{ type, detail, amountCents, periodStart, periodEnd, actor, occurredAt }`
(`type` = `CREATED | INVOICED | PRICE_CHANGED | PAUSED | RESUMED | CANCELLED | NOTE`).

---

## Lezen

### `GET /subscriptions`

Query (alle optioneel): `companyKey`, `clientRef`, `status`,
`dueBefore=YYYY-MM-DD` (filtert op `nextBillingDate <= dueBefore`), `limit`
(1–500, standaard 100).

```json
{ "schemaVersion": "1.0.0", "subscriptions": [ /* Subscription[] */ ] }
```

### `GET /subscriptions/:id`

```json
{ "schemaVersion": "1.0.0", "subscription": { /* Subscription + history */ } }
```

`404 SUBSCRIPTION_NOT_FOUND` bij een onbekend id.

### `GET /billing/due`

De "te factureren"-lijst: actieve abonnementen waarvan `nextBillingDate` binnen
`withinDays` dagen valt en die voor die periode nog niet gefactureerd zijn.
Query: `withinDays` (0–365, standaard 30), `companyKey` (optioneel).

```json
{ "schemaVersion": "1.0.0", "withinDays": 30, "due": [ /* Subscription[] */ ] }
```

### `GET /agreements/gaps`

Geaccepteerde offertes zonder rij in het akkoord-log — het signaal
"N projecten zonder formeel akkoord".

```json
{
  "schemaVersion": "1.0.0",
  "gaps": [
    {
      "quoteRef": "cmquo...",
      "quoteNumber": "WU-2026-0031",
      "title": "Website + hosting",
      "companyKey": "websup",
      "clientRef": "cmcus...",
      "clientName": "Klant BV",
      "totalIncVatCents": 484000,
      "acceptedAt": "2026-09-01T10:00:00.000Z"
    }
  ]
}
```

---

## Schrijven

### `POST /subscriptions`

Handmatig een abonnement aanmaken (legacy-klant).

```json
{
  "companyKey": "websup",              // verplicht
  "clientRef": "cmcus...",             // of clientName
  "clientName": "Oude Hostingklant",   // gebruikt als clientRef ontbreekt
  "serviceName": "Hosting webshop",    // verplicht
  "priceCents": 9000,                  // verplicht, EX btw
  "currency": "EUR",                   // optioneel, default EUR
  "vatRate": 21,                       // optioneel, default 21
  "billingCycle": "YEARLY",            // verplicht
  "startDate": "2026-01-01",           // verplicht
  "nextBillingDate": "2027-01-01",     // optioneel; leeg = startDate + 1 cyclus
  "notes": "Overgezet van Hostinger",  // optioneel
  "migrationPending": true             // optioneel, fase 5
}
```

`201` → `{ "subscription": { ... } }`.
Fouten: `400` met `code` = `<veld>_required` of `VALIDATION_ERROR` (met
`details`), `404 CUSTOMER_NOT_FOUND` als `clientRef` niet bij `companyKey` hoort.

### `PATCH /subscriptions/:id`

Body (alle optioneel): `priceCents`, `nextBillingDate` (`YYYY-MM-DD`), `status`,
`serviceName`, `notes`, `migrationPending`. Elke wijziging schrijft een
history-event (`PRICE_CHANGED`, `PAUSED`/`RESUMED`/`CANCELLED`).

`200` → `{ "subscription": { ... } }`. `404 NOT_FOUND` bij onbekend id.

### `POST /subscriptions/:id/invoiced`

Markeer de lopende periode als gefactureerd: `lastInvoicedAt = now()` en
`nextBillingDate` schuift één cyclus vooruit.

```json
{ "invoicedAt": "2026-09-25T09:00:00.000Z", "periodsAdvanced": 1 }
```

Beide velden optioneel (`invoicedAt` default nu, `periodsAdvanced` default 1,
1–60). **Idempotent:** een tweede aanroep binnen dezelfde cyclus doet niets.

```json
{
  "schemaVersion": "1.0.0",
  "result": "invoiced",          // of "already_invoiced" bij een dubbele call
  "periodsAdvanced": 1,          // 0 bij already_invoiced
  "subscription": { ... }
}
```

`404 NOT_FOUND`, `409 SUBSCRIPTION_CANCELLED` (een opgezegd abonnement kan niet
gefactureerd worden).

---

## Waar abonnementen vandaan komen

Bij een akkoord op een offerte (portaal of handmatig-mondeling) wordt elke
**terugkerende calculatieregel** die de klant accepteert (basis, gekozen variant,
of aangevinkte extra) automatisch een `Subscription` met
`sourceQuoteId` + `sourceCalculationItemId` als ontdubbelsleutel. Dezelfde offerte
twee keer accepteren maakt geen dubbele abonnementen.

`startDate` = akkoorddatum, `nextBillingDate` = akkoorddatum + één cyclus.
