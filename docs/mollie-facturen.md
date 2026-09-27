# Mollie bij verkoopfacturen

De app beheert de officiële factuur, het nummer, de PDF en de status. Mollie
verwerkt alleen online betalingen. Maak voor dezelfde verkoop geen tweede
factuur in Mollie Invoicing.

## Configuratie

- `MOLLIE_API_KEY_WEBSUP`: key van het profiel dat WebsUp-betalingen ontvangt.
- `MOLLIE_API_KEY_KOOLHAAS`: key van het profiel dat Koolhaas-betalingen ontvangt.
- `NEXT_PUBLIC_APP_URL`: publiek bereikbaar HTTPS-adres van deze app, zodat
  Mollie de webhook kan afleveren. `localhost` werkt niet voor webhooks.

Gebruik lokaal `test_`-keys. De oude, niet aan een bedrijf gekoppelde
`MOLLIE_API_KEY` wordt bewust niet gebruikt. Zet productiekeys alleen in de
productieomgeving. Deel keys niet in chat, logs of commits.
Als beide handelsnamen bewust hetzelfde Mollie-profiel gebruiken, kunnen de
twee variabelen dezelfde key bevatten. Controleer dan wel de naam die de klant
op de betaalpagina ziet.

## Gebruik

1. Controleer de factuur en sla wijzigingen op.
2. Markeer haar als verzonden. Maak daarna de betaallink.
3. Open de PDF opnieuw en verstuur die handmatig aan de klant. De PDF bevat nu
   een klikbare betaallink en de bankoverschrijving blijft mogelijk.
4. Bij een live betaling haalt de webhook de link opnieuw bij Mollie op en
   controleert bedrag, valuta en modus. Daarna wordt de factuur betaald.
5. Een testbetaling wordt vastgelegd maar boekt de factuur niet als betaald.

Markeer je een factuur met een open link handmatig als betaald, dan archiveert
de app eerst de link bij Mollie. Controleer in Mollie of er geen betaling
onderweg is. Restituties en chargebacks vereisen nog handmatige controle.

De bestaande knop **Markeer als verzonden** verstuurt zelf geen e-mail. Maak
de link dus voordat je de uiteindelijke PDF aan de klant verzendt.
