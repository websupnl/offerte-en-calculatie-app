import { Document, Page, StyleSheet, Text, View, Font } from "@react-pdf/renderer";
import path from "node:path";

// ─── Fonts ───────────────────────────────────────────────────────────────────

try {
  const fontDir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(fontDir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(fontDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(fontDir, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
} catch {
  // fonts not available, falls back to Helvetica
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BRAND = {
  websup: {
    accent: "#f04f8f",
    accentDark: "#30323a",
    accent2: "#f04f8f",
    accent3: "#9b78f2",
    warm: "#ff6a1a",
    light: "#f8fafc",
    surface: "#f8fafc",
    text: "#0f172a",
    muted: "#64748b",
    name: "WebsUp.nl",
    descriptor: "Digitale voorwaarden bij jouw voorstel",
  },
  koolhaas: {
    accent: "#1f9ba3",
    accentDark: "#0e7490",
    accent2: "#1f7295",
    accent3: "#5bbfb0",
    warm: "#1f9ba3",
    light: "#ecfeff",
    surface: "#f4f8f8",
    text: "#0e2344",
    muted: "#51637a",
    name: "Koolhaas Installaties",
    descriptor: "Heldere afspraken voor installatie en service",
  },
} as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#1e293b",
    backgroundColor: "#ffffff",
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 44,
    lineHeight: 1.5,
  },
  hero: {
    padding: 20,
    borderRadius: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroStripe: {
    flexDirection: "row",
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  brandName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  eyebrow: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  docTitle: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 7, lineHeight: 1.05 },
  docSubtitle: { fontSize: 9.5, color: "#64748b", lineHeight: 1.55, maxWidth: 360 },
  metaRow: { flexDirection: "row", gap: 7, marginTop: 14, flexWrap: "wrap" },
  versionBadge: {
    fontSize: 7.5,
    color: "#334155",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  contentCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  section: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f172a", marginTop: 12, marginBottom: 7 },
  h2: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 5 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#334155", marginTop: 9, marginBottom: 4 },
  p: { fontSize: 9.2, color: "#374151", marginBottom: 6, lineHeight: 1.55 },
  li: { fontSize: 9.2, color: "#374151", marginBottom: 3, lineHeight: 1.45, paddingLeft: 12 },
  liBullet: { position: "absolute", left: 0, top: 0, color: "#94a3b8" },
  separator: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 12 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: "#94a3b8" },
  pageNum: { fontSize: 7.5, color: "#94a3b8" },
});

// ─── Markdown-achtige parser → PDF-elementen ──────────────────────────────────

function parseContent(content: string, accentColor: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (trimmed.startsWith("# ")) {
      elements.push(<Text key={i} style={styles.h1}>{trimmed.slice(2)}</Text>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <View key={i} style={styles.section}>
          <Text style={[styles.h2, { color: "#0f172a" }]}>{trimmed.slice(3)}</Text>
          <View style={{ width: 28, height: 2, borderRadius: 2, backgroundColor: accentColor, marginBottom: 8 }} />
        </View>
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(<Text key={i} style={styles.h3}>{trimmed.slice(4)}</Text>);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <View key={i} style={{ position: "relative", paddingLeft: 12, marginBottom: 3 }}>
          <Text style={[styles.liBullet, { color: accentColor }]}>•</Text>
          <Text style={styles.li}>{trimmed.slice(2)}</Text>
        </View>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        elements.push(
          <View key={i} style={{ position: "relative", paddingLeft: 16, marginBottom: 3 }}>
            <Text style={[styles.liBullet, { color: accentColor }]}>{numMatch[1]}.</Text>
            <Text style={styles.li}>{numMatch[2]}</Text>
          </View>
        );
      }
    } else if (trimmed === "---") {
      elements.push(<View key={i} style={styles.separator} />);
    } else {
      elements.push(<Text key={i} style={styles.p}>{trimmed}</Text>);
    }

    i++;
  }

  return elements;
}

// ─── Component ───────────────────────────────────────────────────────────────

export type LegalDocumentType = "terms" | "privacy";

interface LegalPDFProps {
  companySlug: string;
  companyName: string;
  companyEmail: string;
  companyWebsite: string;
  companyAddress?: string;
  type: LegalDocumentType;
  content: string;
  version?: string;
  date?: string;
}

export function LegalPDF({
  companySlug,
  companyName,
  companyEmail,
  companyWebsite,
  type,
  content,
  version,
  date,
}: LegalPDFProps) {
  const brand = companySlug === "koolhaas" ? BRAND.koolhaas : BRAND.websup;
  const docTitle = type === "terms" ? "Algemene Voorwaarden" : "Privacybeleid";
  const docKind = type === "terms" ? "Voorwaarden" : "Privacy";
  const parsed = parseContent(content, brand.accent);

  return (
    <Document
      title={`${docTitle} - ${companyName}`}
      author={companyName}
      language="nl"
    >
      <Page size="A4" style={styles.page}>
        <View style={[styles.hero, { backgroundColor: brand.light, borderColor: brand.accent }]}>
          <View style={styles.heroStripe}>
            <View style={{ flex: 1, backgroundColor: brand.warm }} />
            <View style={{ flex: 1, backgroundColor: brand.accent2 }} />
            <View style={{ flex: 1, backgroundColor: brand.accent3 }} />
          </View>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.brandName, { color: brand.text }]}>{companyName}</Text>
              <Text style={{ fontSize: 8.5, color: brand.muted, marginTop: 2 }}>{companyWebsite}</Text>
            </View>
            <Text style={[styles.versionBadge, { color: brand.accentDark, borderColor: brand.accent }]}>
              {docKind}
            </Text>
          </View>
          <Text style={[styles.eyebrow, { color: brand.accentDark }]}>{brand.descriptor}</Text>
          <Text style={[styles.docTitle, { color: brand.text }]}>{docTitle}</Text>
          <Text style={[styles.docSubtitle, { color: brand.muted }]}>
            Heldere afspraken, compact vastgelegd voor offertes, opdrachten en communicatie via het offerteportaal.
          </Text>
          <View style={styles.metaRow}>
            {version && <Text style={styles.versionBadge}>Versie {version}</Text>}
            {date && <Text style={styles.versionBadge}>Bijgewerkt {date}</Text>}
            <Text style={styles.versionBadge}>{companyEmail}</Text>
          </View>
        </View>

        <View style={[styles.contentCard, { backgroundColor: brand.surface }]}>
          {parsed}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{companyName} - {companyEmail} - {companyWebsite}</Text>
          <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ─── Default content ──────────────────────────────────────────────────────────

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

WebsUp.nl · hallo@websup.nl · websup.nl`,

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

Koolhaas Installaties · daan@koolhaasinstallaties.nl · koolhaasinstallaties.nl`,
};

export const DEFAULT_PRIVACY: Record<string, string> = {
  websup: `## 1. Wie is verantwoordelijk?

WebsUp.nl (hierna: "wij") is verantwoordelijk voor de verwerking van persoonsgegevens zoals beschreven in dit privacybeleid. Vragen? Mail naar hallo@websup.nl.

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

U heeft het recht op inzage, correctie, verwijdering en overdracht van uw persoonsgegevens. Neem hiervoor contact op via hallo@websup.nl.

## 9. Klachten

U heeft het recht een klacht in te dienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).

## 10. Wijzigingen

Dit privacybeleid kan worden gewijzigd. De meest actuele versie is beschikbaar via het offerteportaal of op verzoek.

---

WebsUp.nl · hallo@websup.nl · websup.nl`,

  koolhaas: `## 1. Verantwoordelijke

Koolhaas Installaties verwerkt persoonsgegevens in het kader van het uitbrengen en afhandelen van offertes. Vragen? Mail naar daan@koolhaasinstallaties.nl.

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

U heeft recht op inzage, correctie en verwijdering. Neem contact op via daan@koolhaasinstallaties.nl.

## 8. Klachten

U kunt een klacht indienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).

---

Koolhaas Installaties · daan@koolhaasinstallaties.nl · koolhaasinstallaties.nl`,
};
