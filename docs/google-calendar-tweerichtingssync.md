# Google Calendar: betrouwbare tweerichtingssync

## Gewenst gedrag

De agenda in de webapp combineert twee soorten gegevens zonder ze door elkaar te halen:

1. **Websup-taken** blijven taken. Ze worden als Google-event gepubliceerd en wijzigingen
   aan zo'n event mogen terugvloeien naar de bijbehorende taak.
2. **Gewone Google-events** (afspraken, vakantie, verjaardagen) worden als read-only
   agendablokken in de webapp getoond. Ze worden niet automatisch taken.

Zo verschijnt een vakantieweek van de telefoon wel in het weekoverzicht, zonder dat er
zeven taken of ongewenste zakelijke records ontstaan.

## Fase 1: app naar Google

- Elke taakmutatie wacht op de Google-call voordat de route antwoordt.
- De taak blijft opgeslagen als Google tijdelijk faalt; de UI toont dan een aparte
  waarschuwing.
- Bestaande open taken kunnen via **Nu synchroniseren** worden teruggevuld.
- App-events krijgen `extendedProperties.private.websupTaskId`. Dit is de stabiele
  koppeling voor latere terugwaartse synchronisatie en voorkomt duplicaten.

## Fase 2: Google naar de webapp

Gebruik Google Calendar incremental sync:

1. Doe per gevolgde kalender één initiële `events.list`.
2. Sla `nextSyncToken` per kalender op.
3. Gebruik daarna steeds dat token om alleen wijzigingen en verwijderingen op te halen.
4. Bij HTTP 410 is het token ongeldig: wis alleen de lokale spiegel van die kalender en
   voer opnieuw een volledige sync uit.

Sla gewone Google-events op in een apart model, bijvoorbeeld:

```prisma
model ExternalCalendarEvent {
  id            String   @id @default(cuid())
  integrationId String
  calendarId    String
  eventId       String
  etag          String?
  title         String
  description   String?  @db.Text
  location      String?
  startAt       DateTime
  endAt         DateTime
  allDay        Boolean  @default(false)
  status        String
  htmlLink      String?
  updatedAt     DateTime

  @@unique([integrationId, calendarId, eventId])
  @@index([integrationId, startAt])
}
```

Gebruik daarnaast een record per gevolgde kalender. Het bestaande enkele
`UserIntegration.syncToken` is niet voldoende zodra zowel `primary` als
`Werkplek — Privé` gevolgd worden:

```prisma
model GoogleCalendarSyncState {
  id              String   @id @default(cuid())
  integrationId   String
  calendarId      String
  syncToken       String?  @db.Text
  channelId       String?
  channelToken    String?  @db.Text
  resourceId      String?
  channelExpiresAt DateTime?
  lastSyncAt      DateTime?

  @@unique([integrationId, calendarId])
}
```

## Fase 3: bijna realtime via webhooks

Registreer voor iedere gevolgde kalender een Google `events.watch`-channel naar:

```text
POST https://offerte.websup.nl/api/integrations/google/webhook
```

Een Google-notificatie bevat niet het gewijzigde event. De webhook:

1. verifieert `X-Goog-Channel-ID`, `X-Goog-Resource-ID` en
   `X-Goog-Channel-Token`;
2. antwoordt snel met 200;
3. start incremental sync voor die kalender;
4. verwerkt alle pagina's en bewaart pas daarna het nieuwe `nextSyncToken`.

Watch-channels verlopen en worden niet automatisch vernieuwd. Een dagelijkse cronjob
moet channels die binnen 24 uur verlopen vervangen. Een periodieke fallback-sync blijft
nodig voor gemiste notificaties.

## Conflictregels

- Google-event met `websupTaskId`: wijzig de gekoppelde taak.
- Google-event zonder `websupTaskId`: toon als read-only extern agendablok.
- App-event verwijderd in Google: verwijder de taak niet automatisch; haal de datum van
  de taak en toon dat de planning vanuit Google is verwijderd.
- Taak verwijderd in de app: verwijder het gekoppelde Google-event.
- Gebruik Google `etag` en `updated` plus `calendarSyncedAt` om echo-loops en oude
  updates te negeren.
- Terugkerende Google-events worden als losse instanties in het agenda-overzicht
  gespiegeld; de webapp maakt daar niet automatisch terugkerende taken van.

## Aanbevolen volgorde

1. Uitgaande sync en handmatige backfill betrouwbaar uitrollen.
2. Externe Google-events read-only importeren en in het weekoverzicht tonen.
3. Handmatige knop ook inkomende incremental sync laten uitvoeren.
4. Webhook + channelvernieuwing toevoegen.
5. Pas daarna wijzigingen aan app-eigen events vanuit Google naar taken terugschrijven.

Bronnen:

- https://developers.google.com/workspace/calendar/api/guides/sync
- https://developers.google.com/workspace/calendar/api/guides/push
- https://developers.google.com/workspace/calendar/api/guides/extended-properties
