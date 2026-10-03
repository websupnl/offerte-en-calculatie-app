# Maak een offerte

Jij maakt een complete, importklare offerte voor de offerte-app van Daan Koolhaas en importeert deze direct via de CLI.

## Werkplek en calculatie-alternatieven

- Meerdere bestaande calculaties samen toevoegen: vink ze aan in het calculatieoverzicht en kies **Toevoegen aan offerte**. Kies een bestaande conceptofferte of maak een nieuwe. Zet inbegrepen onderdelen op `BASE`, en minimaal twee volledige alternatieven op `VARIANT`.
- MCP: gebruik `link_calculations_to_quote` met `company_slug`, `calculations: [{id, role}]` en `quote_id` (bestaand), of `customer_id` en `title` (nieuw). Dit is één transactie en behoudt andere gekoppelde calculaties. `copy_items` is vervallen. Verplaats geen calculatie die bij een andere offerte hoort: maak eerst een losse kopie.
- Gebruik `get_app_capabilities` voor de actuele appfuncties en invoervelden, daarna `app_read` of `app_write`. De nieuwe werkplek, abonnementen, portaal, contracten, facturen en instellingen lopen via dezelfde appregels. Bij `PUT` lees je eerst de huidige gegevens om onbedoeld vervangen van regels te voorkomen.

- Calculaties zijn de prijsbron. Open de bijbehorende calculatie om materialen, uren, tekstregels en optionele extra's te wijzigen.
- Controleer bij een bestaande calculatie eerst `quoteId`. Hergebruik de gekoppelde offerte; omzetting naar offerte verplaatst een bestaande actieve koppeling niet meer. Alleen een losse calculatie krijgt een nieuwe conceptofferte. Voor een afzonderlijke revisie kopieer je de offerte inclusief calculaties, zodat de eerdere offerte haar bron behoudt.
- PDF-downloads hergebruiken een opgeslagen bestand alleen wanneer de inhoudsfingerprint overeenkomt met offerte, calculaties, media, klantgegevens, branding en documentopmaak. MinIO is de primaire opslag, Vercel Blob de reserve. Offerte- en calculatie-opslag genereren de actuele PDF op de achtergrond. Een ontbrekend bestand wordt bij downloaden opnieuw gerenderd.
- `hiddenOnQuote` verbergt de detailregel, niet het bedrag van inbegrepen werk. Verborgen vaste regels tellen mee via een neutrale prijsregel per btw-tarief en facturatieperiode; inkoop, leveranciers en interne omschrijvingen blijven buiten klantgegevens.
- Een gekoppelde conceptofferte actualiseer je met **Concept actualiseren**. Maak hiervoor geen nieuwe offerte en ken geen nummer toe tijdens de review.
- **Maak alternatief** onder de calculatietabel kopieert de actuele, opgeslagen uitvoering naar dezelfde conceptofferte. De oorspronkelijke uitvoering en de kopie worden beide `VARIANT`; de klant kiest er één. Een losse calculatie krijgt hierbij eerst een conceptofferte zonder nummer.
- Optionele extra's worden bij deze fork één gezamenlijke basiscalculatie, zodat ze bij beide uitvoeringen selecteerbaar blijven. Reken volledige alternatieven niet als twee inbegrepen onderdelen.
- Het bestaande endpoint `POST /api/calculations/[id]/duplicate` ondersteunt `{ "asAlternative": true }` voor deze fork. Zonder deze vlag maak je een losse kopie. De fork werkt alleen op conceptoffertes.
- Gebruik **Onderdeel toevoegen** in de prijszijbalk voor een extra inbegrepen onderdeel, bijvoorbeeld een tweede laadpunt dat de klant samen met het eerste koopt. Gebruik optionele calculatieregels voor losse keuzes.
- Media en documenten staan in het vaste offertebewerkpaneel. Een afbeelding kan bij een onderdeel of op een eigen voorbeeldpagina staan. Kies een eerder geüpload bestand wanneer dat bruikbaar is.
- Bij een nieuwe calculatie of offerte wordt zonder projectkeuze automatisch een project van de gekozen klant aangemaakt. Titel en klantadres worden overgenomen. Dit geldt ook bij omzetting van een calculatie naar een offerte en bij een alternatief dat een nieuwe conceptofferte nodig heeft. Een calculatie mag zonder klant als concept beginnen.
- `POST /api/cli/import-quote` ondersteunt een optioneel `projectId` naast `companySlug`, `customer` en `quote`. Geef het bestaande klantproject mee wanneer je daar een nieuwe offerte voor maakt; zonder dit veld ontstaat een nieuw project. `POST /api/quotes` en `POST /api/calculations` ondersteunen dezelfde projectkeuze. Een project moet binnen hetzelfde bedrijf bij dezelfde klant horen.


## Stap 0 — Onderzoek producten en prijzen (web-first)

Ga **altijd** eerst onderzoeken wat je nodig hebt vóór je prijzen opzoekt. Volgorde:

**0a. Web research → bepaal de exacte stuklijst (BOM).**
Gebruik WebSearch/WebFetch om per product vast te stellen:
- Het exacte modelnummer / typeaanduiding (bijv. `BAT-05K48`, `BI-NEUNU3P-01`, `SE7K-RWS48BEN4`)
- **EAN/artikelnummer** en de officiële specs (capaciteit, vermogen, garantie, compatibiliteit)
- Compatibiliteit met de bestaande installatie (omvormer, fase, koppeling) — bevestig dit, gok niet
- Lopende fabrikantsacties/cashback en de exacte voorwaarden (lees de officiële T&C, niet alleen de samenvatting)
- Een **online richtprijs** per artikel (1–2 webshops) om straks mee te vergelijken

Verzin geen modelnummers of EAN's — alleen wat je in de bron terugziet.

**0b. Oosterberg-prijzen ophalen → zoek gericht op model/EAN/artikelnummer.**
Brave moet open zijn met CDP op poort 9222 en ingelogd op `webshop.oosterberg.nl`:
```bash
npm run brave   # of de één-regel-start uit memory/cli-workflow.md
```
Zoek per artikel zo specifiek mogelijk (modelnummer of EAN werkt beter dan een merknaam):
```bash
node scripts/scrape-oosterberg.mjs "BAT-05K48"          # preview JSON, niet opslaan
node scripts/scrape-oosterberg.mjs "solaredge home battery" --save --company koolhaas
```
Een te brede term (bijv. alleen `solaredge`) geeft honderden treffers en parse-ruis — zoek per onderdeel.

**0c. Vergelijk en kies de inkoopprijs.**
Zet Oosterberg-netto naast de online richtprijzen uit 0a. Wijkt Oosterberg sterk af (niet op voorraad, oude prijs, andere variant), gebruik dan de best onderbouwde prijs en noteer de bron in `internalAdvice`. Reken een fabrikantscashback alleen mee als de voorwaarden uit 0a dat hard ondersteunen.

Als de gebruiker expliciet zegt geen prijzen te willen refreshen, gebruik dan de meest recent bekende prijzen (zie `memory/cli-workflow.md` of de Inkoopprijzen-tab in de admin).

## Stap 1 — Verzamel informatie

Controleer of de volgende informatie al in het gesprek beschikbaar is. Vraag alleen naar ontbrekende verplichte info.

**Verplicht:**
- Bedrijf: `koolhaas` of `websup`
- Klant: naam (voor- en achternaam of bedrijfsnaam)
- Situatie: beschrijving van wat de klant wil, wat Daan heeft gezien of besproken

**Optioneel (vraag alleen als relevant):**
- E-mailadres klant
- Adres, postcode, woonplaats
- Specifieke producten, prijzen of technische details

## Stap 2 — Haal het actuele schema op

```bash
curl -s http://localhost:3001/api/integrations/quote-contract | python3 -m json.tool
```

Lees de `jsonSchema` en de `systemPrompt` uit de response. Houd je strikt aan het schema.

## Stap 3 — Schrijfstijl en persoonlijkheid

Lees `docs/daan-profiel-en-stijl.md` in de projectroot voor de volledige schrijfstijl van Daan.

Kernregels:
- Schrijf in de ik-vorm (nooit "wij" tenzij echt meerdere mensen)
- Gebruik je/jouw als aanspreekvorm (u/uw alleen bij aantoonbaar formele klanten)
- Leg altijd uit waarom iets wordt geadviseerd, niet alleen wat
- Korte zinnen, actieve werkwoorden, normale mensentaal
- Nooit: ontzorgen, totaaloplossing, toekomstbestendig, naadloze integratie, state-of-the-art
- Geen lege claims — alleen concreet onderbouwde uitspraken
- Enthousiasme blijkt uit meedenken, niet uit uitroeptekens
- Outro altijd opgebouwd als: `Tot slot\n[alinea]\n\nVolgende stap\n[alinea]`

## Stap 4 — Genereer de offerte JSON

Lees ook `docs/custom-gpt-quote-import.md` voor de volledige promptinstructies (32 secties + veldreferentie + voorbeeld).

Genereer één geldig JSON-object. Strikte regels:
- Alle prijzen exclusief btw
- Geen `id`-velden, geen `recommendedChoiceId`
- Geen totalen berekenen — de app doet dat zelf
- Aanbevolen configuratie: `"label": "Aanbevolen"` op de betreffende `choice`
- Bij een nieuwe offerte: zie stap 4b, prijzen gaan via een calculatie
- Configurations pas gebruiken bij echte keuze uit minimaal twee alternatieven
- `optionalWork` alleen voor los selecteerbaar meerwerk
- `internalAdvice` nooit klantzichtbaar
- Verzin niets: geen prijzen, specs of garanties die niet in de bron staan
- Klantadres hoort in `assumptions` of `customerResponsibilities`, niet in `intro`

## Stap 4b — Prijzen horen in een calculatie

De prijs van een offerte komt uit een gekoppelde calculatie, niet uit losse
offerteregels. Bij een nieuwe offerte dus:

1. Maak de offerte aan (teksten, werkwijze, afspraken, bronnen)
2. Maak er een calculatie bij: `POST /api/quotes/[id]/calculations`
3. Zet de artikelen in die calculatie met leverancier, artikelnummer en
   inkoopprijs, zodat de marge klopt

Vertaling van de oude begrippen:
| Vroeger | Nu |
|---|---|
| `items` | gewone regels in de basiscalculatie |
| `configurations` (keuze) | een tweede calculatie met `role: "VARIANT"` |
| `optionalWork` / modules | regel in de calculatie met `optional: true` |
| abonnement per maand | regel met `recurringInterval: "maand"` (of `"kwartaal"` / `"jaar"`) |

Een regel met `recurringInterval` gezet wordt bij een akkoord automatisch een
`Subscription` (zie het abonnementen-blok in `CLAUDE.md`). Zet dus alleen een
interval als het echt terugkerend gefactureerd wordt, niet voor een eenmalige
post die toevallig "per jaar" heet.

Zet bij een optionele regel een `quoteNote`: dat is wat de klant erbij leest.
Zonder die tekst toont de offerte alleen aantal en eenheid.

Verzin nooit een artikelnummer, leverancier of inkoopprijs. Ontbreekt er een
artikel, meld dat dan eerst in plaats van een prijs in te vullen.

## Stap 5 — Sla de JSON op in een tijdelijk bestand

```bash
cat > /tmp/offerte-draft.json << 'JSONEOF'
{ ... gegenereerde JSON ... }
JSONEOF
```

Controleer of de JSON geldig is:
```bash
python3 -m json.tool /tmp/offerte-draft.json > /dev/null && echo "JSON geldig" || echo "JSON ongeldig"
```

## Stap 6 — Importeer via de CLI

```bash
cd /home/daan-koolhaas/Documenten/GitHub/offerte-en-calculatie-app
npm run import:quote /tmp/offerte-draft.json --company [koolhaas|websup] --customer "[klantnaam]" [--email klant@email.nl]
```

De CLI geeft het offertenummer en de directe app-URL terug. Stuur die URL terug aan de gebruiker zodat hij de offerte direct kan bekijken en eventueel aanpassen.

## Stap 7 — Controleer de pagina-opmaak

Een offertepagina is een echte A4 met `overflow: hidden`. Past de tekst niet,
dan valt het overschot er stil af en ziet de klant een halve zin. Vooral de
**werkwijze** ("Zo werkt het in de praktijk") en de **bronnenlijst** lopen over
bij te veel of te lange blokken.

- De MCP-tools `get_quote` en `update_quote` geven een veld `layoutWarnings`
  terug (en zetten een `LET OP`-regel bovenaan) zodra een sectie over de pagina
  loopt. Krijg je die waarschuwing, kort dan in:
  - **Werkwijze:** 5 à 6 korte stappen per pagina. Voeg stappen over hetzelfde
    onderwerp samen in plaats van drie losse blokken.
  - **Bronnen:** maximaal ~8 per pagina, elke omschrijving één korte regel.
- De preview verdeelt beide secties zelf over meerdere pagina's, maar liever
  kort en één pagina dan uitgesmeerd.
- Schrijf niet "zoals we hebben afgestemd" als er niets is afgestemd. De klant
  heeft alleen een mail gestuurd en daar losjes op gereageerd; benoem het zo.

## Technische context

- Offerte, PDF en klantportaal bevatten automatisch **Mijn voorstel voor jou**, met Daans foto, naam, persoonlijke tekst en WhatsApp-link. Naam, tekst en WhatsApp-nummer zijn per bedrijf instelbaar onder Instellingen → Branding. Schrijf geen los contactpersoon- of functielabel voor Daan en voeg dit standaardblok niet nogmaals aan de offertetekst toe.

- Een concept krijgt zijn definitieve nummer bij verzending via de app of via **Markeer als verstuurd** (`POST /api/quotes/[id]/mark-sent`). Gebruik die laatste alleen nadat Daan de offerte buiten de app heeft gedeeld. Deze actie verstuurt geen e-mail, registreert de verzending in de historie en ververst de PDF. Alleen een klantlink ophalen of een PDF downloaden houdt de offerte op Concept.

- App draait op poort **3001** (niet 3000 — dat is een andere app)
- `CLI_API_KEY` staat in `.env.local`
- Klant wordt gezocht op e-mail, daarna op naam (case-insensitive contains) — geen duplicate bij bestaande klant
- `npm run brave` start Brave met CDP op poort 9222 (voor scrapen Oosterberg-prijzen)
- Inkoopprijzen Sigenergy per 22-6-2026: zie `memory/cli-workflow.md`
