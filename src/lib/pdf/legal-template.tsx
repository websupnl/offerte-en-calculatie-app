/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image is geen DOM-afbeelding en ondersteunt geen alt-attribuut */
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { getBrand, type BrandConfig } from "@/lib/pdf/quote-template";

// Zelfde letterhead, kleuren en typografie als de offerte-PDF (quote-template.tsx),
// zodat een juridisch document niet als los bijlage-document aanvoelt.

const PAD = 38;

function PageHeader({ brand, tag }: { brand: BrandConfig; tag: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }} fixed>
      {brand.key === "websup" && brand.logoColor ? (
        <Image src={brand.logoColor} style={{ height: 32, width: 148, objectFit: "contain", objectPositionX: "0%" }} />
      ) : brand.key === "websup" ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: brand.colors.primary }}>Webs</Text>
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>Up.</Text>
        </View>
      ) : (
        <Image src={brand.logoColor} style={{ height: 18, width: 64, objectFit: "contain", objectPositionX: "0%" }} />
      )}
      <Text style={{ fontSize: 8, color: brand.colors.muted }}>{tag} &nbsp;&middot;&nbsp; {brand.name}</Text>
    </View>
  );
}

function PageFooter({ tag, brand }: { tag: string; brand: BrandConfig }) {
  return (
    <>
      <Text
        fixed
        style={{ position: "absolute", bottom: 22, left: PAD, fontSize: 7.5, color: "#94A3B8", fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}
      >
        {tag} &nbsp;&middot;&nbsp; {brand.email}
      </Text>
      <Text
        fixed
        render={({ pageNumber, totalPages }) => `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`}
        style={{ position: "absolute", bottom: 22, right: PAD, fontSize: 7.5, color: "#94A3B8", fontFamily: "Helvetica-Bold" }}
      />
    </>
  );
}

function Eyebrow({ text, color }: { text: string; color: string }) {
  return (
    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, color, marginBottom: 4 }}>
      {text}
    </Text>
  );
}

// ─── Markdown-achtige parser → PDF-elementen (in offerte-huisstijl) ──────────

function parseContent(content: string, brand: BrandConfig) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <View key={i} style={{ marginTop: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 12.5, fontFamily: "Helvetica-Bold", color: brand.colors.text, marginBottom: 4 }}>
            {trimmed.slice(3)}
          </Text>
          <View style={{ width: 24, height: 2, borderRadius: 2, backgroundColor: brand.colors.accent }} />
        </View>
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <Text key={i} style={{ fontSize: 9.8, fontFamily: "Helvetica-Bold", color: brand.colors.text, marginTop: 8, marginBottom: 4 }}>
          {trimmed.slice(4)}
        </Text>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
          <Text style={{ fontSize: 9.5, color: brand.colors.accent }}>•</Text>
          <Text style={{ fontSize: 9.5, color: "#334155", lineHeight: 1.5, flex: 1 }}>{renderBold(trimmed.slice(2))}</Text>
        </View>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        elements.push(
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: brand.colors.accent, width: 16 }}>{numMatch[1]}.</Text>
            <Text style={{ fontSize: 9.5, color: "#334155", lineHeight: 1.5, flex: 1 }}>{renderBold(numMatch[2])}</Text>
          </View>
        );
      }
    } else if (trimmed === "---") {
      elements.push(<View key={i} style={{ height: 1, backgroundColor: "#F1F5F9", marginVertical: 16 }} />);
    } else {
      elements.push(
        <Text key={i} style={{ fontSize: 9.5, color: "#334155", lineHeight: 1.5, marginBottom: 6 }}>
          {renderBold(trimmed)}
        </Text>
      );
    }

    i++;
  }

  return elements;
}

// Ondersteunt **vet** binnen een regel, zonder een volledige markdown-parser nodig te hebben.
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>{part.slice(2, -2)}</Text>
    ) : (
      <Text key={i}>{part}</Text>
    )
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export type LegalDocumentType = "terms" | "privacy";

interface LegalPDFProps {
  companySlug: string;
  type: LegalDocumentType;
  content: string;
}

export function LegalPDF({ companySlug, type, content }: LegalPDFProps) {
  const brand = getBrand(companySlug);
  const docTitle = type === "terms" ? "Algemene Voorwaarden" : "Privacybeleid";
  const tag = type === "terms" ? "Voorwaarden" : "Privacy";
  const parsed = parseContent(content, brand);

  return (
    <Document title={`${docTitle} - ${brand.name}`} author={brand.name} language="nl">
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF", padding: PAD, paddingTop: 30, paddingBottom: 50 }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.colors.accent }} fixed />
        <PageHeader brand={brand} tag={tag} />

        <Eyebrow text="Juridisch document" color={brand.colors.accent} />
        <Text style={{ fontSize: 26, fontFamily: "Helvetica-Bold", color: brand.colors.text, marginBottom: 8, lineHeight: 1.08 }}>
          {docTitle}
        </Text>
        <Text style={{ fontSize: 9.5, color: brand.colors.muted, lineHeight: 1.5, maxWidth: 400, marginBottom: 16 }}>
          Van toepassing op offertes, opdrachten en overeenkomsten van {brand.name}.
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 18,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: brand.colors.border,
          }}
        >
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>{brand.email}</Text>
          <Text style={{ fontSize: 8, color: brand.colors.muted, marginLeft: 8 }}>{brand.website}</Text>
        </View>

        {parsed}

        <PageFooter tag={tag} brand={brand} />
      </Page>
    </Document>
  );
}

// ─── Standaardtekst per bedrijf (gebruikt zolang er geen eigen tekst is vastgelegd) ──

export const DEFAULT_TERMS: Record<string, string> = {
  websup: `## Artikel 1 — Definities

**Opdrachtnemer:** WebsUp.nl, ingeschreven bij de Kamer van Koophandel, gevestigd in Friesland, Nederland.

**Opdrachtgever:** De natuurlijke of rechtspersoon die een overeenkomst aangaat met WebsUp.nl.

**Overeenkomst:** Elke overeenkomst tussen WebsUp.nl en de opdrachtgever.

## Artikel 2 — Toepasselijkheid

Deze algemene voorwaarden zijn van toepassing op alle offertes, opdrachten en overeenkomsten van WebsUp.nl.

Afwijkingen zijn uitsluitend geldig indien schriftelijk bevestigd door WebsUp.nl.

## Artikel 3 — Offertes en totstandkoming

Alle offertes zijn vrijblijvend en 30 dagen geldig, tenzij anders vermeld.

Een overeenkomst komt tot stand na schriftelijke of digitale aanvaarding van de offerte door de opdrachtgever.

## Artikel 4 — Uitvoering van de opdracht

WebsUp.nl zal de opdracht naar beste inzicht en vermogen uitvoeren.

De opdrachtgever draagt zorg voor tijdige aanlevering van alle benodigde informatie, materialen en medewerking.

## Artikel 5 — Wijzigingen en meerwerk

Wijzigingen in de opdracht kunnen leiden tot verhoging van de prijs en/of verlenging van de levertijd.

Meerwerk wordt separaat geoffreerd en na schriftelijke akkoord uitgevoerd.

## Artikel 6 — Prijzen en betaling

Alle prijzen zijn exclusief btw, tenzij uitdrukkelijk anders vermeld.

Facturen dienen binnen 14 dagen na factuurdatum te worden voldaan.

Bij niet-tijdige betaling is de opdrachtgever van rechtswege in verzuim en is wettelijke handelsrente verschuldigd.

## Artikel 7 — Intellectueel eigendom

Na volledige betaling draagt WebsUp.nl de auteursrechten op het geleverde werk over aan de opdrachtgever, tenzij schriftelijk anders overeengekomen.

WebsUp.nl behoudt het recht het werk te gebruiken als referentie in haar portfolio.

## Artikel 8 — Aansprakelijkheid

De aansprakelijkheid van WebsUp.nl is beperkt tot het bedrag dat in het desbetreffende geval door haar aansprakelijkheidsverzekering wordt uitbetaald.

WebsUp.nl is niet aansprakelijk voor indirecte schade, gevolgschade of gederfde winst.

## Artikel 9 — Overmacht

In geval van overmacht is WebsUp.nl gerechtigd de uitvoering van de opdracht op te schorten.

## Artikel 10 — Geheimhouding

Beide partijen verplichten zich tot geheimhouding van vertrouwelijke informatie.

## Artikel 11 — Toepasselijk recht en geschillen

Op alle overeenkomsten is Nederlands recht van toepassing.

Geschillen worden bij voorkeur in onderling overleg opgelost. Indien dat niet lukt, is de rechtbank in Leeuwarden bevoegd.

---

WebsUp.nl - info@websup.nl - websup.nl - KVK 95524061`,

  koolhaas: `## Artikel 1 — Definities

**Opdrachtnemer:** Koolhaas Installaties, ingeschreven bij de Kamer van Koophandel, gevestigd in Friesland, Nederland.

**Opdrachtgever:** De natuurlijke of rechtspersoon die een overeenkomst aangaat met Koolhaas Installaties.

## Artikel 2 — Toepasselijkheid

Deze algemene voorwaarden zijn van toepassing op alle offertes, installaties en overeenkomsten van Koolhaas Installaties.

## Artikel 3 — Offertes

Offertes zijn 30 dagen geldig. Een overeenkomst komt tot stand na schriftelijk of digitaal akkoord van de opdrachtgever.

## Artikel 4 — Uitvoering

Koolhaas Installaties voert de werkzaamheden vakkundig uit conform de geldende normen en veiligheidseisen.

De opdrachtgever zorgt voor vrije toegang tot de installatielocatie en de benodigde stroomvoorziening.

## Artikel 5 — Materialen en garantie

Op materialen gelden de fabrieksgaranties. Op arbeidskosten geldt een garantietermijn van 12 maanden na oplevering.

## Artikel 6 — Prijzen en betaling

Alle prijzen zijn exclusief btw, tenzij uitdrukkelijk anders vermeld.

Facturen dienen binnen 14 dagen na factuurdatum te worden voldaan.

## Artikel 7 — Aansprakelijkheid

De aansprakelijkheid van Koolhaas Installaties is beperkt tot het gefactureerde bedrag. Indirecte schade valt buiten de aansprakelijkheid.

## Artikel 8 — Toepasselijk recht

Op alle overeenkomsten is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de rechtbank in Leeuwarden.

---

Koolhaas Installaties - info@koolhaasinstallaties.nl - koolhaasinstallaties.nl - KVK 95524061`,
};

export const DEFAULT_PRIVACY: Record<string, string> = {
  websup: `## 1. Wie is verantwoordelijk?

WebsUp.nl (hierna: "wij") is verantwoordelijk voor de verwerking van persoonsgegevens zoals beschreven in dit privacybeleid. Vragen? Mail naar info@websup.nl.

## 2. Welke gegevens verzamelen wij?

Via het offerteportaal verwerken wij de volgende persoonsgegevens:

- Naam
- E-mailadres
- Bedrijfsnaam (indien van toepassing)
- Inhoud van berichten of opmerkingen bij akkoord

## 3. Waarvoor gebruiken wij uw gegevens?

- Opstellen en afhandelen van offertes
- Communicatie over de opdracht
- Nakomen van wettelijke verplichtingen (boekhouding, fiscaal)

## 4. Grondslag

De verwerking is gebaseerd op:

- Uitvoering van een overeenkomst (offerte en opdracht)
- Wettelijke verplichting (belastingwetgeving)
- Gerechtvaardigd belang (klantcommunicatie)

## 5. Bewaartermijn

Persoonsgegevens worden bewaard zolang noodzakelijk voor het doel waarvoor ze zijn verzameld. Boekhoudkundige gegevens worden 7 jaar bewaard conform de wet.

## 6. Delen met derden

Wij delen persoonsgegevens uitsluitend met:

- Hostingproviders (verwerkers, met verwerkersovereenkomst)
- Boekhoudprogramma's en administratiesoftware

Wij verkopen uw gegevens nooit aan derden.

## 7. Beveiliging

Wij nemen passende technische en organisatorische maatregelen om persoonsgegevens te beveiligen tegen verlies en ongeautoriseerde toegang.

## 8. Uw rechten

U heeft het recht op inzage, correctie, verwijdering en overdracht van uw persoonsgegevens. Neem hiervoor contact op via info@websup.nl.

## 9. Klachten

U heeft het recht een klacht in te dienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).

## 10. Wijzigingen

Dit privacybeleid kan worden gewijzigd. De meest actuele versie is beschikbaar via het offerteportaal of op verzoek.

---

WebsUp.nl - info@websup.nl - websup.nl - KVK 95524061`,

  koolhaas: `## 1. Verantwoordelijke

Koolhaas Installaties verwerkt persoonsgegevens in het kader van het uitbrengen en afhandelen van offertes. Vragen? Mail naar info@koolhaasinstallaties.nl.

## 2. Welke gegevens?

- Naam en contactgegevens (adres, e-mail, telefoon)
- Technische gegevens over uw woning of installatie (indien relevant voor de offerte)
- Inhoud van berichten en opmerkingen

## 3. Doel van verwerking

- Opstellen en afhandelen van offertes
- Inplannen en uitvoeren van installaties
- Wettelijke administratieverplichtingen

## 4. Grondslag

- Uitvoering van een overeenkomst
- Wettelijke verplichting (belastingwetgeving)

## 5. Bewaartermijn

Gegevens worden bewaard zolang noodzakelijk voor de opdracht en de wettelijke bewaarplicht van 7 jaar voor financiële administratie.

## 6. Derden

Gegevens worden uitsluitend gedeeld met verwerkers die noodzakelijk zijn voor de bedrijfsvoering (boekhouding, planning). Er worden geen gegevens verkocht.

## 7. Uw rechten

U heeft recht op inzage, correctie en verwijdering. Neem contact op via info@koolhaasinstallaties.nl.

## 8. Klachten

U kunt een klacht indienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).

---

Koolhaas Installaties - info@koolhaasinstallaties.nl - koolhaasinstallaties.nl - KVK 95524061`,
};
