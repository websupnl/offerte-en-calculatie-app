# Maak een offerte

Jij maakt een complete, importklare offerte voor de offerte-app van Daan Koolhaas en importeert deze direct via de CLI.

## Stap 0 — Check inkoopprijzen

Vraag de gebruiker vóór je verder gaat:

> "Wil je de inkoopprijzen van Oosterberg eerst refreshen? (ja/nee)"

Als het antwoord **ja** is, voer dan uit:
```bash
npm run scrape:oosterberg
```
Wacht op de output en verwerk de nieuwe prijzen in de offerte.

Als het antwoord **nee** is, gebruik dan de meest recent bekende prijzen (zie `memory/cli-workflow.md` of de Inkoopprijzen-tab in de admin).

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
- Configurations pas gebruiken bij echte keuze uit minimaal twee alternatieven
- `optionalWork` alleen voor los selecteerbaar meerwerk
- `internalAdvice` nooit klantzichtbaar
- Verzin niets: geen prijzen, specs of garanties die niet in de bron staan
- Klantadres hoort in `assumptions` of `customerResponsibilities`, niet in `intro`

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
