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

## Klantportaal en projectaanmaak, vervolg op 1 oktober 2026

Doel: klanten rustig een offerte laten lezen, downloaden en goedkeuren. Aanname: de schermweergave moet hetzelfde A4-document tonen als de PDF. Daan wees de lichte portaalomgeving af en vroeg om vaste paginahoogte, beter geplaatste foto's en minder navigatie.

- Donkere marine omgeving rond wit documentpapier. Bedrijfskleuren en logo komen uit dezelfde brandinginstellingen in editor, portaal en PDF. De links Voorstel, Bijlagen en Jouw reactie zijn uit de bovenbalk verwijderd.
- Documentpagina's behouden 210 × 297 mm, ook op mobiel. Alleen de zoom verandert. De zijbalk toont één investering, de PDF-download, beschikbare bijlagen en het akkoordformulier. Op mobiel staan deze onder het document met een compacte actiebalk.
- Foto's op de eigen voorbeeldpagina vullen hun frame met een gecentreerde uitsnede, zonder grijze stroken. De bronafbeelding blijft behouden. De standaardlogo's gebruiken hun strak uitgesneden of witte variant, afhankelijk van het oppervlak.
- De interne preview had ontbrekende documentkleurvariabelen, waardoor een WebsUp-fallback Koolhaas oranje kleurde. Iedere preview heeft nu expliciete bedrijfsbranding. PDF-cachepaden bevatten branding en opmaakversie; oude bestanden worden niet als actuele PDF hergebruikt. Een brandingwijziging wist interne en publieke PDF-cacheverwijzingen.
- Nieuwe calculaties en offertes maken automatisch een project als een klant maar geen project wordt gekozen. Project, document en modules worden samen opgeslagen. De klant en het bedrijf begrenzen de projectkeuze. Handmatige en automatische projectaanmaak delen de nummering, gebaseerd op het hoogste bestaande volgnummer en een transactieslot. Imports en calculatie-naar-offerte volgen dezelfde regel.

Kwaliteitscontrole: de echte openbare offerte is lokaal bekeken op desktop (1440 × 1000) en mobiel (390 × 844). Alle zeven pagina's behouden de A4-verhouding en hebben geen inhoudsoverloop; mobiel heeft geen horizontale paginaoverloop. De gegenereerde PDF heeft zeven A4-pagina's. Logo, kleur, fotopagina en tekst zijn visueel beoordeeld. Velden hebben zichtbare labels, de akkoordknop blijft uit tot naam en toestemming aanwezig zijn, downloaden toont een foutmelding bij mislukken, paginanavigatie en focus zijn zichtbaar. Bodytekst is 16 px, ondersteunende labels 14 px. Reduced motion wordt in de code gerespecteerd. Er zijn geen automatische tests of nieuwe klant-/projectgegevens aangemaakt; daadwerkelijke projectaanmaak en akkoord/afwijzen zijn niet uitgevoerd.

TypeScript, lint van de gewijzigde bronbestanden en de productiecompilatie zijn geslaagd. De DNA-librarycontrole is geslaagd. De lokale ontwikkelserver is weer beschikbaar op poort 3001.

## Merkpaletten en instelbare gradients

De beide opgeslagen bedrijfspaletten zijn afgestemd op de websitecaptures van 1 oktober 2026:

| Bedrijf | Primaire kleur | Actiekleur | Gradient |
|---|---|---|---|
| WebsUp | `#0b1526` | `#f97316` | 135°, `#f97316` op 0%, `#ec4899` op 50%, `#a78bfa` op 100% |
| Koolhaas | `#102d59` | `#247eb2` | 120°, `#102d59` op 0%, `#247eb2` op 48%, `#6edbcf` op 100% |

Instellingen toont een live merkpreview, drie gradientkleuren, richting en middenpositie. **Gebruik websitekleuren** zet alleen het kleurenpalet terug; de algemene opslagknop bewaart de keuze. Logo, favicon, font en andere bedrijfsinstellingen blijven behouden. De werkplek gebruikt het effen actieaccent met contrasterende tekst, document en e-mail gebruiken de merkgradient. Interne preview, openbaar portaal, Chromium-PDF en de reserve-PDF krijgen dezelfde gradientconfiguratie. De settings-API valideert de kleuren en gradientwaarden en wist PDF-cacheverwijzingen in dezelfde transactie als de brandingwijziging.

De bestaande bedrijven zijn bijgewerkt met `scripts/sync-brand-palettes.ts` en daarna teruggelezen. De seed gebruikt dezelfde standaardpaletten en overschrijft geen bestaande Koolhaas-branding meer. De gedeelde kleurcomponent is visueel bekeken op desktop en 390 × 844 px; mobiel heeft geen horizontale overloop. De gegenereerde openbare Koolhaas-PDF is bekeken en bevat nog zeven A4-pagina's. Volledige Instellingen-opslag via de ingelogde UI en de reserve-PDF zijn niet functioneel uitgevoerd; er zijn geen automatische tests gestart.

TypeScript, lint van de gewijzigde bronbestanden, productiecompilatie en DNA-librarycontrole zijn geslaagd na deze aanpassing. De ontwikkelserver draait weer op poort 3001.

## Logo-upload, 2 oktober 2026

De uploadroute gebruikte een vaste afbeeldings-URL en een redirect met vijf minuten cache. Een vervangend logo kon hierdoor onzichtbaar blijven tot verversen of cacheverloop. Uploadbare logo's en favicons krijgen nu een URL met de unieke bestandskey als versie, gedeeld door Instellingen, zijbalk, documentpreview, portaal en e-mail. De redirect wordt niet gecachet. De upload bewaart alleen het gewijzigde assetveld in de lokale instellingenstate, zodat onopgeslagen kleurwijzigingen behouden blijven. Opslaan en uploaden kunnen niet tegelijk starten.

Opslag van branding en het wissen van interne en publieke PDF-cacheverwijzingen gebeuren samen. Lege bestanden krijgen een duidelijke melding; een opslagfout geeft een leesbare foutresponse. Als alleen het verversen van de werkplek mislukt na een geslaagde upload, meldt de UI dat de afbeelding wel opgeslagen is. PNG, JPG en WebP tot 4 MB zijn ondersteund, SVG blijft niet ondersteund. Er is geen nieuw bedrijfslogo geüpload voor deze diagnose.

## Wit offerteportaal, 2 oktober 2026

Nieuwe keuze van Daan: de portaalomgeving blijft strak wit, met bedrijfslogo en de ingestelde gradient van WebsUp of Koolhaas. De volledige paginawerkbalk met Ga naar pagina is verwijderd. De A4-documenten behouden 210 × 297 mm en schalen alleen mee met de beschikbare ruimte. Witte invoervelden, donkere tekst, subtiele kaders en een dunne merkgradient in bovenbalk en prijskaart houden de hiërarchie rustig.

Bij visuele controle bleek de publieke logo-route naar login te verwijzen. Alleen de leesroute /api/brand-assets/ is nu publiek toegankelijk; deze serveert uitsluitend het opgeslagen bedrijfslogo of favicon. De uploadroute blijft beschermd. Het bestaande geüploade Koolhaas-logo laadt nu zonder sessie.

Kwaliteitscontrole: desktop en 390 × 844 px lokaal bekeken, geen horizontale paginaoverloop. Alle zeven pagina's behouden 794 × 1123 CSS-pixels (A4). Paginakeuze ontbreekt, bedrijfsgradient en logo zijn zichtbaar. Bodytekst en formuliervelden blijven 16 px, labels 14 px, focus en reduced motion behouden. TypeScript en gerichte lint zijn geslaagd. Geen akkoord ingediend, geen bestanden geüpload en geen automatische tests uitgevoerd. Deze wijzigingen zijn nog niet gepusht.
