# Nieuwe werkplek, 1 oktober 2026

Doel: één samenhangende, compacte interface voor calculeren, offertes beoordelen en dagelijks werk. Doelgroep: Daan, als dagelijkse gebruiker die vaak samen met ChatGPT offertes maakt. Primaire actie: een calculatie uitwerken en de bijbehorende conceptofferte beoordelen of actualiseren.

Aannames: calculaties blijven de prijsbron; bestaande gegevens en koppelingen blijven bruikbaar; de werkplek ondersteunt beide bedrijven en lichte en donkere modus. De zijbalk blijft op desktop zichtbaar. Alleen op mobiel opent navigatie als lade. Publieke offertes blijven leesbare documenten.

## Basis

De bestaande shadcn/Base UI-componenten krijgen een nieuwe gezamenlijke stijl. Motion verzorgt korte overgangen en feedback, met respect voor minder beweging. Geen nieuwe parallelle componentbibliotheek.

## WebsUp Design DNA

- `kleur/zwart-wit-signaalkleur`: neutrale oppervlakken, één configureerbaar bedrijfsaccent voor selectie en primaire acties. Statuskleuren houden hun betekenis.
- `motion/mask-reveal`: korte onthulling van de schermtitel. Aangepast van marketing naar een werkplek: circa 240 ms, geen woordstagger of herhaalde scrollanimaties.
- Merkvoorbeelden: WebsUp en Koolhaas uit de bestaande toepassing in de DNA-library. Geen marketinghero, scroll hijacking, achtergrondglow of decoratieve grafieken.

## Interfacebesluiten

- Vaste zijbalk, zichtbare groepen, één actuele navigatieselectie. Bedrijfswissel blijft bovenaan.
- Een rustige bovenbalk voor zoeken, thema en snel aanmaken. Schermacties staan bij de schermtitel.
- Dezelfde velden, tabbladen, tabellen, dialogs, oppervlakken en lege toestanden in alle views.
- Bodytekst 16 px, labels 14 px, kleine radii en duidelijke randen. Compact door minder decoratie, niet door onleesbaar kleine tekst.
- Calculatie: rustige cijferstrook, direct zicht op conceptkoppeling, forkactie onder de tabel. Een alternatieve fork moet echt een keuze zijn en geen dubbele prijs veroorzaken.
- Offerte: document centraal, vaste bewerkzijbalk naast het document, helder benoemde onderdelen en rustige prijsweergave.

## Oplevercontrole

Controleer typen en lint van gewijzigde bestanden. Controleer desktop en mobiel, toetsenbordfocus, lichte/donkere modus, minder beweging, kleurcontrast, tekstoverloop en documentkleuren. Meld eerlijk welke controles door ontbrekende toegang niet uitgevoerd konden worden.
