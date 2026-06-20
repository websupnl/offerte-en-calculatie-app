# Custom GPT — canoniek offertecontract

Gebruik in de Custom GPT exact onderstaande instructie. Het actuele schema is altijd beschikbaar via `GET /api/integrations/quote-contract` op dezelfde deployment als de offerte-app. De plakimport en MCP gebruiken dezelfde veldbetekenis.

## Instructie voor de Custom GPT

```text
Je maakt Nederlandse offertes voor de offerte-app. Lever uitsluitend één geldig JSON-object op, zonder markdown of uitleg.

Gebruik altijd het actuele schema van GET /api/integrations/quote-contract. Houd je aan deze scheiding:
- items: alleen de vaste basis die bij iedere samenstelling hoort.
- configurations: volledige onderling exclusieve systemen. Maak alleen een groep als de klant echt moet kiezen uit minimaal twee concrete alternatieven. Iedere configuratie bevat haar eigen geprijsde hoofdregel en inbegrepen regels. Dupliceer deze prijzen nooit in items.
- optionalWork: losse uitbreidingen die de klant naast de basis/configuratie kan aanvinken. Iedere uitbreiding heeft een unieke id, korte titel, samenvatting van maximaal twee zinnen, expliciete prijs exclusief btw, btw-percentage en optionele details.

Maak nooit placeholders zoals "Kies uw optie", "Optie 1", "Optie 2" of "Hoofdregel". Verzin geen prijzen, productspecificaties, garanties, hoeveelheden of technische claims. Zet lange specificaties in details en niet in de samenvatting. Retourneer geen totalen; de app berekent die. Als broninformatie ontbreekt, laat de module leeg en zet het punt in technicalNotes of assumptions.
```

## Voorbeeld-JSON

```json
{
  "quoteType": "BATTERY",
  "title": "Thuisbatterij met keuze uit twee systemen",
  "category": "Installatie · Energieopslag",
  "tagline": "Advies · Installatie · Inbedrijfstelling",
  "intro": "Beste klant,\n\nBedankt voor uw aanvraag. Hieronder vindt u de vaste werkzaamheden en twee passende systeemconfiguraties.",
  "itemsHeader": "Vaste werkzaamheden",
  "items": [
    {
      "description": "Technische opname, montagevoorbereiding en oplevering",
      "qty": 1,
      "unitPrice": 450,
      "vatRate": 21,
      "indent": 0
    }
  ],
  "configurations": [
    {
      "id": "batterijsysteem",
      "title": "Kies uw batterijsysteem",
      "type": "SINGLE_SELECT",
      "description": "Kies één complete configuratie. De definitieve investering wordt direct bijgewerkt.",
      "recommendedChoiceId": "sigenergy-backup",
      "choices": [
        {
          "id": "solaredge-home-battery",
          "label": "Voordelig",
          "title": "SolarEdge Home Battery",
          "summary": "Uitbreiding binnen het bestaande SolarEdge-ecosysteem zonder noodstroomfunctie.",
          "items": [
            {
              "description": "Compleet SolarEdge batterijpakket",
              "qty": 1,
              "unitPrice": 7479.77,
              "vatRate": 21,
              "indent": 0
            },
            {
              "description": "Montage, aansluiting en inbedrijfstelling inbegrepen",
              "qty": 1,
              "unitPrice": 0,
              "vatRate": 21,
              "indent": 1
            }
          ]
        },
        {
          "id": "sigenergy-backup",
          "label": "Aanbevolen",
          "title": "Sigenergy met back-up",
          "summary": "AC-gekoppeld systeem met 11,68 kWh bruikbare opslag en back-up voor essentiële groepen.",
          "items": [
            {
              "description": "Compleet Sigenergy-systeem met back-up",
              "qty": 1,
              "unitPrice": 8364.09,
              "vatRate": 21,
              "indent": 0
            },
            {
              "description": "SigenStor EC 8.0 TP, twee BAT 6.0-modules en Gateway HomePro TP",
              "qty": 1,
              "unitPrice": 0,
              "vatRate": 21,
              "indent": 1
            }
          ]
        }
      ]
    }
  ],
  "optionalWork": [
    {
      "id": "extra-kabelroute",
      "t": "Extra kabelroute",
      "d": "Aanvullende kabelmeters wanneer de definitieve route langer blijkt dan opgenomen.",
      "tag": "Na opname",
      "price": 250,
      "vatRate": 21,
      "details": ["Inclusief kabel en normale montage"],
      "technicalCondition": "Alleen van toepassing na controle van de werkelijke kabelroute."
    }
  ],
  "exclusions": [],
  "assumptions": [],
  "technicalNotes": [],
  "customerResponsibilities": [],
  "planning": {},
  "commercial": { "validDays": 30 },
  "batteryAdvice": {},
  "flow": [],
  "approach": [],
  "attachments": [],
  "outro": "Heeft u vragen over de twee configuraties, dan licht ik de verschillen graag toe.",
  "notes": "",
  "internalAdvice": ""
}
```
