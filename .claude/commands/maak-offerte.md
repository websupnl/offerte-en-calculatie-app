# Maak een offerte

Jij maakt een complete, importklare offerte voor de offerte-app van Daan Koolhaas en importeert deze direct via de CLI.

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
| abonnement per maand | regel met `recurringInterval: "maand"` |

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

## Technische context

- App draait op poort **3001** (niet 3000 — dat is een andere app)
- `CLI_API_KEY` staat in `.env.local`
- Klant wordt gezocht op e-mail, daarna op naam (case-insensitive contains) — geen duplicate bij bestaande klant
- `npm run brave` start Brave met CDP op poort 9222 (voor scrapen Oosterberg-prijzen)
- Inkoopprijzen Sigenergy per 22-6-2026: zie `memory/cli-workflow.md`
