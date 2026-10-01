# Nieuwe werkplek, 1 oktober 2026

Doel: één samenhangende, compacte interface voor calculeren, offertes beoordelen en dagelijks werk. Doelgroep: Daan, als dagelijkse gebruiker die vaak samen met ChatGPT offertes maakt. Primaire actie: een calculatie uitwerken en de bijbehorende conceptofferte beoordelen of actualiseren.

Aannames: calculaties blijven de prijsbron; bestaande gegevens en koppelingen blijven bruikbaar; de werkplek ondersteunt beide bedrijven en lichte en donkere modus. De zijbalk blijft op desktop zichtbaar. Alleen op mobiel opent navigatie als lade. Publieke offertes blijven leesbare documenten.

## Basis

De bestaande shadcn/Base UI-componenten krijgen een nieuwe gezamenlijke stijl. Motion verzorgt korte overgangen en feedback, met respect voor minder beweging. Geen nieuwe parallelle componentbibliotheek.

## WebsUp Design DNA

- `kleur/zwart-wit-signaalkleur`: neutrale oppervlakken, één configureerbaar bedrijfsaccent voor selectie en primaire acties. Statuskleuren houden hun betekenis.
- `motion/mask-reveal`: korte onthulling van de schermtitel. Aangepast van marketing naar een werkplek: circa 240 ms, geen woordstagger of herhaalde scrollanimaties.
- Merkvoorbeelden: WebsUp en Koolhaas uit de bestaande toepassing in de DNA-library. Geen marketinghero, scroll hijacking, achtergrondglow of decoratieve grafieken.

Bronbestanden die voor dit ontwerp zijn gelezen:

- `C:/Users/Daan Koolhaas/Documents/GitHub/websup-design-dna/library/applications/offerte-en-calculatie-app.md`
- `C:/Users/Daan Koolhaas/Documents/GitHub/websup-design-dna/library/patterns/kleur/zwart-wit-signaalkleur/pattern.md`
- `C:/Users/Daan Koolhaas/Documents/GitHub/websup-design-dna/library/patterns/motion/mask-reveal/pattern.md`

## Uitgewerkt

Nieuwe vaste navigatie en bovenbalk, gedeelde schermkoppen en bediening, korte Motion-overgangen, semantische kleurrollen in de interne views, leesbare velden en consistente tabbladen/dialogs/tabellen. De startpagina toont het pad van calculatie naar conceptreview en opvolging. De calculatie heeft een cijferstrook en een forkactie onder de tabel. De offerte heeft een vast paneel van 340 px naast het papier en toegankelijke tabbladen. Op kleinere schermen komt het paneel onder het document. De login volgt dezelfde vormtaal.

De mobiele navigatie gebruikt de Base UI-dialog via Sheet, met focusbeheer en Escape. Desktopnavigatie heeft geen inklapstand. Een visueel ontwerpvoorbeeld staat alleen in development onder `/login/ontwerp`; de inhoud daarvan is fictief en schrijft niet naar de database.

## Interfacebesluiten

- Vaste zijbalk, zichtbare groepen, één actuele navigatieselectie. Bedrijfswissel blijft bovenaan.
- Een rustige bovenbalk voor zoeken, thema en snel aanmaken. Schermacties staan bij de schermtitel.
- Dezelfde velden, tabbladen, tabellen, dialogs, oppervlakken en lege toestanden in alle views.
- Bodytekst 16 px, labels 14 px, kleine radii en duidelijke randen. Compact door minder decoratie, niet door onleesbaar kleine tekst.
- Calculatie: rustige cijferstrook, direct zicht op conceptkoppeling, forkactie onder de tabel. Een alternatieve fork moet echt een keuze zijn en geen dubbele prijs veroorzaken.
- Offerte: document centraal, vaste bewerkzijbalk naast het document, helder benoemde onderdelen en rustige prijsweergave.

## Oplevercontrole

Controleer typen en lint van gewijzigde bestanden. Controleer desktop en mobiel, toetsenbordfocus, lichte/donkere modus, minder beweging, kleurcontrast, tekstoverloop en documentkleuren. Meld eerlijk welke controles door ontbrekende toegang niet uitgevoerd konden worden.

## Uitgevoerde kwaliteitscontrole

- Doel, doelgroep, primaire actie en aannames zijn vastgelegd. De prijsbron en conceptreview bepalen de volgorde van de nieuwe navigatie en aanmaakroute.
- De gedeelde vormtaal is bekeken op desktop en op 390 × 844 px, in lichte en donkere modus. De mobiele documentweergave had geen horizontale paginaoverloop. De mobiele Sheet plaatste de focus binnen de navigatie en schermde de achtergrond af.
- Schermkoppen, witruimte, kleine radii, tabeluitlijning en een vast offertebewerkpaneel zijn visueel beoordeeld in het ontwerpvoorbeeld. Labels zijn minstens 14 px; standaard invoer en lopende tekst zijn 16 px.
- Animatie respecteert de gebruikersvoorkeur voor minder beweging. Bewegingsgedrag bij die specifieke OS-instelling is niet afzonderlijk in de browser beoordeeld.
- TypeScript, lint en productiecompilatie zijn uitgevoerd. Er zijn geen automatische functionele tests of mutaties op klantgegevens uitgevoerd.
- Volledige views met echte gegevens, opslag, daadwerkelijke forks en klantportaalinteracties blijven onbeoordeeld in deze sessie doordat de lokale app geen geldige sessie had. Het ontwerpvoorbeeld demonstreert gedeelde componenten en bevat expliciet fictieve bedragen.
