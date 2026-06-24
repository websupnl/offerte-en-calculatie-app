import { NextResponse } from "next/server";
import {
  QUOTE_IMPORT_AI_SYSTEM_PROMPT,
  QUOTE_IMPORT_CONTRACT_VERSION,
  quoteImportJsonSchema,
} from "@/lib/quote-import";

export function GET() {
  return NextResponse.json({
    version: QUOTE_IMPORT_CONTRACT_VERSION,
    systemPrompt: QUOTE_IMPORT_AI_SYSTEM_PROMPT,
    jsonSchema: quoteImportJsonSchema,
    rules: {
      // Kop & introductie
      quoteType: "Type offerte, bijv. 'installatie' of 'webdevelopment'. Bepaalt accenten in de weergave.",
      title: "Titel van de offerte zoals de klant die ziet.",
      category: "Korte categorie/branche, bijv. 'Thuisbatterij' of 'Webdevelopment'.",
      tagline: "Korte ondertitel onder de titel, bijv. 'Ontwerp - Bouw - Plaatsing'.",
      intro: "Persoonlijke openingsalinea aan de klant. Korte, warme toon; geen technische specs.",
      itemsHeader: "Kop boven de prijstabel, bijv. 'Prijsopbouw' of 'Onderdelen'.",
      // Regels & prijzen
      items: "Vaste basis van de offerte; mag leeg zijn wanneer de offerte alleen configuraties bevat. Nooit alternatieve systemen of optioneel meerwerk. Eén regel per product/dienst, prijs excl. btw. indent:1 = subregel. unitPrice 0 = inbegrepen.",
      configurations: "Volledige onderling exclusieve systemen; klant kiest exact één per groep bij akkoord. Markeer de aanbevolen keuze met label 'Aanbevolen'. Geen id's emitten.",
      optionalWork: "Los selecteerbaar meerwerk met prijs excl. btw (of null = 'Op aanvraag'). Prijs nooit in het tag-veld zetten.",
      exclusions: "Wat expliciet NIET in de offerte zit. Array van korte zinnen.",
      // Onderbouwing & uitvoering
      assumptions: "Aannames/uitgangspunten waarop de prijs is gebaseerd. Array van zinnen.",
      technicalNotes: "Technische uitgangspunten (aansluiting, kabelroute, capaciteit). Array van zinnen.",
      customerResponsibilities: "Wat de klant zelf moet regelen/aanleveren. Array van zinnen.",
      flow: "Processtappen richting de klant: array van {n, t, d} (nummer, titel, omschrijving).",
      approach: "Werkwijze/aanpak: array van {n, t, d}.",
      planning: "Object {leadTime, executionDuration, preferredDate} — levertijd, uitvoeringsduur, voorkeursdatum.",
      commercial: "Object {validDays, paymentTerms, warranty} — geldigheid in dagen, betaalvoorwaarden, garantie.",
      batteryAdvice: "Alleen voor accu/zonne-offertes: {nominalCapacityKwh, usableCapacityKwh, backupReservePercent, chargePowerKw, recommendedScenario}.",
      attachments: "Bijlagen: array van {title, imageUrl of liveUrl, caption}. Minimaal imageUrl of liveUrl vereist.",
      // Tekst & afsluiting
      outro: "Afsluitende alinea aan de klant.",
      notes: "Vrije notities/voorwaarden onderaan de offerte (klantzichtbaar).",
      internalAdvice: "Interne notitie/advies — NIET klantzichtbaar.",
      validDays: "Geldigheidsduur van de offerte in dagen (geheel getal).",
      // Algemeen
      vat: "Alle prijzen ALTIJD exclusief btw. De app rekent btw en toont totalen incl./excl.",
      ids: "Nooit id- of recommendedChoiceId-velden emitten; de app kent zelf identifiers toe.",
      totals: "Nooit door AI aanleveren; de app berekent alle totalen.",
      storage: "Import maakt offerteregels als bewerkbare snapshots. De import maakt niet automatisch centrale catalogusartikelen aan; die kunnen bewust vanuit de editor worden opgeslagen.",
    },
  });
}
