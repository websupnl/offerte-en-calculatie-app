import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  Font,
} from "@react-pdf/renderer";
import { readFileSync } from "node:fs";

// Register fonts if needed, but Helvetica is usually safe and clean.
// For a "better" look, we use Helvetica-Bold for titles.

type BrandKey = "websup" | "koolhaas";

type QuoteItem = {
  description: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  total: number;
};

type QuotePDFProps = {
  companyName: string;
  companySlug: string;
  companyTagline?: string;
  quoteNumber: string;
  quoteDate: string;
  validUntil?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  intro?: string;
  outro?: string;
  notes?: string;
  items: QuoteItem[];
  totalExVat: number;
  totalVat: number;
  totalIncVat: number;
  itemsHeader?: string;
  status?: string;
  acceptedAt?: string;
  flow?: { n: number; t: string; d: string }[];
  approach?: { n: string; t: string; d: string }[];
  options?: { t: string; d: string; tag: string }[];
  exclusions?: string[];
};

type BrandConfig = {
  key: BrandKey;
  name: string;
  logoPath: string;
  logoPathDark?: string;
  tagline: string;
  heroTitle: string;
  heroHighlight: string;
  introFallback: string;
  summaryFallback: string;
  planning: string[];
  remarks: string[];
  footerMeta: string[];
  footerLine: string;
  colors: {
    primary: string;
    accent: string;
    accent2: string;
    accent3: string;
    bg: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    gradient?: string[];
  };
};

const logoDataUri = (fileName: string) => {
  try {
    const buffer = readFileSync(`${process.cwd()}/public/logos/${fileName}`);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (e) {
    return "";
  }
};

const BRANDS: Record<BrandKey, BrandConfig> = {
  websup: {
    key: "websup",
    name: "WebsUp.nl",
    logoPath: logoDataUri("websup-white.png"),
    tagline: "Websites, apps & systemen die groeien",
    heroTitle: "Digitale oplossing",
    heroHighlight: "op maat",
    introFallback: "Bedankt voor je aanvraag. In deze offerte vind je een helder overzicht van de voorgestelde werkzaamheden, de investering en de belangrijkste uitgangspunten.",
    summaryFallback: "WebsUp.nl ontwerpt en bouwt een professionele oplossing met maatwerk modules.",
    planning: ["Start na akkoord.", "Doorlooptijd: 2 - 4 weken.", "Oplevering in overleg."],
    remarks: ["Excl. btw.", "14 dagen geldig."],
    footerMeta: ["WebsUp.nl", "Daan Koolhaas", "info@webs-up.nl", "06 82 20 21 48", "KVK 95524061"],
    footerLine: "Websites, webshops en maatwerk systemen.",
    colors: {
      primary: "#06040c",
      accent: "#f97316",
      accent2: "#ec4899",
      accent3: "#a78bfa",
      bg: "#FFFFFF",
      surface: "#f8fafc",
      text: "#0F172A",
      muted: "#64748B",
      border: "#E2E8F0",
      gradient: ["#f97316", "#ec4899", "#a78bfa"],
    },
  },
  koolhaas: {
    key: "koolhaas",
    name: "Koolhaas Installaties",
    logoPath: logoDataUri("koolhaas-white.png"),
    logoPathDark: logoDataUri("koolhaas-logo.png"),
    tagline: "Techniek die eerst goed doordacht wordt en daarna netjes wordt uitgevoerd.",
    heroTitle: "Thuisbatterij & EMS",
    heroHighlight: "installatie",
    introFallback: "Bedankt voor uw aanvraag. In deze offerte vindt u een duidelijke uitsplitsing van de werkzaamheden, materialen en kosten.",
    summaryFallback: "Betrouwbare installatie met aandacht voor veiligheid en afwerking.",
    planning: ["Start na akkoord.", "Installatie in 1 dag.", "Oplevering met test."],
    remarks: ["Btw 21%.", "14 dagen geldig."],
    footerMeta: ["Koolhaas Installaties", "Daan Koolhaas", "daan@koolhaasinstallaties.nl", "06 82 20 21 48"],
    footerLine: "Persoonlijk installatiewerk en technisch advies.",
    colors: {
      primary: "#0c1f3d",
      accent: "#1f9ba3",
      accent2: "#1f7295",
      accent3: "#5bbfa0",
      bg: "#FFFFFF",
      surface: "#f4f8f8",
      text: "#0e2344",
      muted: "#51637a",
      border: "#e2eaee",
      gradient: ["#153369", "#1f7295", "#1f9ba3", "#5bbfb0"],
    },
  },
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  // COMMON COMPONENTS
  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  pageNumber: {
    position: "absolute",
    bottom: 25,
    right: 40,
    fontSize: 8,
    color: "#94A3B8",
    fontFamily: "Helvetica-Bold",
  },
  pageTag: {
    position: "absolute",
    bottom: 25,
    left: 40,
    fontSize: 8,
    color: "#94A3B8",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },

  // WEBSUP COVER
  wsCover: {
    height: "100%",
    width: "100%",
    padding: 40,
    backgroundColor: "#06040c",
    color: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  wsCoverTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  wsCoverLogo: {
    width: 120,
    height: 40,
    objectFit: "contain",
  },
  wsCoverMeta: {
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.15)",
    paddingLeft: 12,
  },
  wsMetaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  wsMetaLabel: {
    width: 80,
    fontSize: 8,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Helvetica-Bold",
  },
  wsMetaValue: {
    fontSize: 8,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },

  // KOOLHAAS COVER
  khCover: {
    height: "100%",
    width: "100%",
    backgroundColor: "#0c1f3d",
    display: "flex",
    flexDirection: "column",
  },
  khCoverTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 30,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  khLogoPlate: {
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 8,
  },
  khCoverLogo: {
    height: 25,
    width: 80,
    objectFit: "contain",
  },
  khCoverBody: {
    flex: 1,
    flexDirection: "row",
  },
  khCoverText: {
    flex: 1,
    padding: 40,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.07)",
  },
  khCoverImage: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    alignItems: "center",
  },

  // STAMPS
  stampWrapper: {
    position: "absolute",
    zIndex: 100,
  },
  stampCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  stampText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textTransform: "uppercase",
  },
  stampSub: {
    fontSize: 6,
    textAlign: "center",
    marginTop: 2,
  },

  // CONTENT
  innerPage: {
    padding: 45,
  },
  h2: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  para: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#334155",
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 20,
  },

  // TABLES
  summaryGrid: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  summaryKey: {
    width: "35%",
    backgroundColor: "#F8FAFC",
    padding: 10,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
  },
  summaryVal: {
    flex: 1,
    padding: 10,
    fontSize: 9,
  },

  // SIGNATURES
  signGrid: {
    flexDirection: "row",
    gap: 20,
    marginTop: 20,
  },
  signBox: {
    flex: 1,
    padding: 15,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 12,
    position: "relative",
  },
  signLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#94A3B8",
    marginBottom: 5,
  },
  signTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 15,
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    height: 1,
    marginTop: 15,
    marginBottom: 5,
  },
});

function formatEur(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function getBrand(companySlug: string): BrandConfig {
  return companySlug === "koolhaas" ? BRANDS.koolhaas : BRANDS.websup;
}

// ─── STAMP COMPONENT ─────────────────────────────────────────────────────────

function Stamp({ 
  label, 
  subLabel, 
  color, 
  rotation = -15 
}: { 
  label: string; 
  subLabel?: string; 
  color: string; 
  rotation?: number 
}) {
  return (
    <View style={[styles.stampWrapper, { transform: `rotate(${rotation}deg)` }]}>
      <View style={[styles.stampCircle, { borderColor: color }]}>
        <Text style={[styles.stampText, { color }]}>{label}</Text>
        {subLabel && <Text style={[styles.stampSub, { color }]}>{subLabel}</Text>}
      </View>
    </View>
  );
}

// ─── MAIN DOCUMENT ───────────────────────────────────────────────────────────

export function QuotePDF({
  companyName,
  companySlug,
  companyTagline,
  quoteNumber,
  quoteDate,
  validUntil,
  customerName,
  customerEmail,
  customerPhone,
  customerAddress,
  customerCity,
  intro,
  outro,
  notes,
  items,
  totalExVat,
  totalVat,
  totalIncVat,
  itemsHeader,
  status,
  acceptedAt,
  flow = [],
  approach = [],
  options = [],
  exclusions = [],
}: QuotePDFProps) {
  const brand = getBrand(companySlug);
  const isWebsUp = companySlug === "websup";
  const isKoolhaas = companySlug === "koolhaas";
  const totalPages = "05";

  return (
    <Document>
      {/* PAGE 1: COVER */}
      <Page size="A4" style={styles.page}>
        {isWebsUp ? (
          <View style={styles.wsCover}>
            <View style={styles.wsCoverTop}>
              <Image src={brand.logoPath} style={styles.wsCoverLogo} />
              <View style={styles.wsCoverMeta}>
                <View style={styles.wsMetaRow}>
                  <Text style={styles.wsMetaLabel}>Referentie</Text>
                  <Text style={styles.wsMetaValue}>{quoteNumber}</Text>
                </View>
                <View style={styles.wsMetaRow}>
                  <Text style={styles.wsMetaLabel}>Datum</Text>
                  <Text style={styles.wsMetaValue}>{quoteDate}</Text>
                </View>
              </View>
            </View>
            <View style={{ marginTop: 80 }}>
              <Text style={[styles.eyebrow, { color: brand.colors.accent, marginBottom: 15 }]}>Offerte</Text>
              <Text style={{ fontSize: 56, fontFamily: "Helvetica-Bold", lineHeight: 1, marginBottom: 20 }}>
                {brand.heroTitle} {"\n"}
                <Text style={{ color: brand.colors.accent }}>{brand.heroHighlight}</Text>
              </Text>
              <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginBottom: 40, maxWidth: 350 }}>
                {companyTagline || brand.tagline}
              </Text>
              <View style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: 20, borderRadius: 12, width: 250 }}>
                <Text style={styles.wsMetaLabel}>VOOR</Text>
                <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 5 }}>{customerName}</Text>
              </View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 20, flexDirection: "row", gap: 20 }}>
              <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{brand.footerMeta[2]}</Text>
              <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{brand.footerMeta[3]}</Text>
              <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{brand.footerMeta[4]}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.khCover}>
            <View style={styles.khCoverTop}>
              <View style={styles.khLogoPlate}>
                <Image src={brand.logoPathDark || brand.logoPath} style={styles.khCoverLogo} />
              </View>
              <View style={{ textAlign: "right" }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>Referentie</Text>
                <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Helvetica-Bold" }}>{quoteNumber}</Text>
              </View>
            </View>
            <View style={styles.khCoverBody}>
              <View style={styles.khCoverText}>
                <Text style={{ color: brand.colors.accent, fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Offerte</Text>
                <Text style={{ color: "#fff", fontSize: 32, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 15 }}>{brand.heroTitle}</Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.5, marginBottom: 40 }}>{companyTagline || brand.tagline}</Text>
                <View style={{ gap: 10 }}>
                  <View style={{ backgroundColor: "rgba(255,255,255,0.04)", padding: 12, borderRadius: 8 }}>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, textTransform: "uppercase" }}>Van</Text>
                    <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Helvetica-Bold" }}>Daan Koolhaas</Text>
                  </View>
                  <View style={{ backgroundColor: "rgba(255,255,255,0.04)", padding: 12, borderRadius: 8 }}>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, textTransform: "uppercase" }}>Aan</Text>
                    <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Helvetica-Bold" }}>{customerName}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.khCoverImage}>
                <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>[ SITUATIE FOTO ]</Text>
              </View>
            </View>
          </View>
        )}
      </Page>

      {/* PAGE 2: SUMMARY & INTRO */}
      <Page size="A4" style={[styles.page, styles.innerPage]}>
        <View style={[styles.topAccent, { backgroundColor: brand.colors.accent }]} />
        <Text style={styles.pageTag}>Offerte &nbsp;&middot;&nbsp; {customerName}</Text>
        <Text style={styles.pageNumber}>02 / {totalPages}</Text>

        <View style={{ marginBottom: 30 }}>
          <Text style={[styles.eyebrow, { color: brand.colors.accent }]}>In één oogopslag</Text>
          <Text style={styles.h2}>Project samenvatting</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Project</Text>
              <Text style={styles.summaryVal}>{brand.heroTitle} {brand.heroHighlight}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Referentie</Text>
              <Text style={styles.summaryVal}>{quoteNumber}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Investering</Text>
              <Text style={[styles.summaryVal, { fontFamily: "Helvetica-Bold", color: brand.colors.accent }]}>{formatEur(totalIncVat)} incl. btw</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryKey}>Geldig tot</Text>
              <Text style={styles.summaryVal}>{validUntil || "-"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={[styles.eyebrow, { color: brand.colors.accent }]}>Persoonlijke toelichting</Text>
        <Text style={styles.h2}>Beste {customerName.split(" ")[0]},</Text>
        <Text style={styles.para}>{intro || brand.introFallback}</Text>
        
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: brand.colors.accent, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Helvetica-Bold" }}>DK</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>Daan Koolhaas</Text>
            <Text style={{ fontSize: 8, color: brand.colors.muted }}>{brand.name}</Text>
          </View>
        </View>
      </Page>

      {/* PAGE 3: SCOPE & APPROACH */}
      <Page size="A4" style={[styles.page, styles.innerPage]}>
        <View style={[styles.topAccent, { backgroundColor: brand.colors.accent }]} />
        <Text style={styles.pageTag}>Offerte &nbsp;&middot;&nbsp; {customerName}</Text>
        <Text style={styles.pageNumber}>03 / {totalPages}</Text>

        <Text style={[styles.eyebrow, { color: brand.colors.accent }]}>Wat je krijgt</Text>
        <Text style={styles.h2}>{itemsHeader || "Wat wordt er geleverd"}</Text>
        <View style={{ gap: 8, marginBottom: 30 }}>
          {items.map((item, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: brand.colors.accent, justifyContent: "center", alignItems: "center", marginTop: 2 }}>
                <Text style={{ color: "#fff", fontSize: 7, fontFamily: "Helvetica-Bold" }}>v</Text>
              </View>
              <Text style={{ fontSize: 10, color: "#334155", flex: 1 }}>{item.description}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={[styles.eyebrow, { color: brand.colors.accent }]}>Onze werkwijze</Text>
        <Text style={styles.h2}>Stap voor stap naar resultaat</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 15 }}>
          {(approach.length > 0 ? approach : [
            { n: "01", t: "Intake", d: "Scherp krijgen van de wensen." },
            { n: "02", t: "Ontwerp", d: "Visueel en technisch voorstel." },
            { n: "03", t: "Uitvoering", d: "De daadwerkelijke realisatie." },
            { n: "04", t: "Oplevering", d: "Controle en overdracht." }
          ]).map((s, i) => (
            <View key={i} style={{ width: "47%", backgroundColor: brand.colors.surface, padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: brand.colors.accent }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: brand.colors.accent, marginBottom: 2 }}>{s.n}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3 }}>{s.t}</Text>
              <Text style={{ fontSize: 8, color: brand.colors.muted, lineHeight: 1.4 }}>{s.d}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* PAGE 4: INVESTMENT */}
      <Page size="A4" style={[styles.page, styles.innerPage]}>
        <View style={[styles.topAccent, { backgroundColor: brand.colors.accent }]} />
        <Text style={styles.pageTag}>Offerte &nbsp;&middot;&nbsp; {customerName}</Text>
        <Text style={styles.pageNumber}>04 / {totalPages}</Text>

        <Text style={[styles.eyebrow, { color: brand.colors.accent }]}>De investering</Text>
        <Text style={styles.h2}>Financieel overzicht</Text>

        <View style={{ backgroundColor: brand.colors.primary, padding: 30, borderRadius: 20, color: "#fff", marginBottom: 20 }}>
          <Text style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.5)", marginBottom: 5 }}>Totaal voorstel</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <Text style={{ fontSize: 48, fontFamily: "Helvetica-Bold", color: "#fff" }}>{formatEur(totalIncVat).replace("€", "").trim()}</Text>
            <Text style={{ fontSize: 14, color: brand.colors.accent }}>incl. btw</Text>
          </View>
          <View style={{ marginTop: 20, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 8 }}>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Subtotaal (excl. btw)</Text>
              <Text style={{ fontSize: 10, color: "#fff" }}>{formatEur(totalExVat)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Btw (21%)</Text>
              <Text style={{ fontSize: 10, color: "#fff" }}>{formatEur(totalVat)}</Text>
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: brand.colors.surface, padding: 15, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: brand.colors.accent }}>
          <Text style={{ fontSize: 10, lineHeight: 1.5, color: brand.colors.text }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Geldigheid: </Text>
            Deze offerte is geldig tot {validUntil || "14 dagen na dagtekening"}. Alle prijzen zijn inclusief alle benodigde materialen en arbeid zoals beschreven in de scope.
          </Text>
        </View>

        {options.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <Text style={[styles.eyebrow, { color: brand.colors.accent }]}>Extra mogelijkheden</Text>
            <Text style={styles.h2}>Optioneel meerwerk</Text>
            <View style={{ gap: 10 }}>
              {options.map((o, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingVertical: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{o.t}</Text>
                    <Text style={{ fontSize: 8, color: brand.colors.muted }}>{o.d}</Text>
                  </View>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>{o.tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>

      {/* PAGE 5: SIGNATURE & STAMPS */}
      <Page size="A4" style={[styles.page, styles.innerPage]}>
        <View style={[styles.topAccent, { backgroundColor: brand.colors.accent }]} />
        <Text style={styles.pageTag}>Offerte &nbsp;&middot;&nbsp; {customerName}</Text>
        <Text style={styles.pageNumber}>05 / {totalPages}</Text>

        <Text style={[styles.eyebrow, { color: brand.colors.accent }]}>Akkoord voor uitvoering</Text>
        <Text style={styles.h2}>Zetten we de volgende stap?</Text>
        <Text style={styles.para}>Door ondertekening van deze offerte ga je akkoord met de beschreven werkzaamheden en de bijbehorende investering.</Text>

        <View style={styles.signGrid}>
          {/* CLIENT SIGNATURE */}
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Opdrachtgever</Text>
            <Text style={styles.signTitle}>{customerName}</Text>
            <View style={styles.signLine} />
            <Text style={{ fontSize: 7, color: "#94A3B8" }}>Handtekening / Datum</Text>

            {status === "ACCEPTED" && acceptedAt && (
              <View style={{ position: "absolute", top: 10, right: 10 }}>
                <Stamp label="GEACCEPTEERD" subLabel={`Digitaal akkoord\n${acceptedAt}`} color="#22c55e" rotation={-12} />
              </View>
            )}
          </View>

          {/* CONTRACTOR SIGNATURE */}
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Opdrachtnemer</Text>
            <Text style={styles.signTitle}>{brand.name}</Text>
            <View style={styles.signLine} />
            <Text style={{ fontSize: 7, color: "#94A3B8" }}>Daan Koolhaas</Text>

            <View style={{ position: "absolute", top: 10, right: 10 }}>
              <Stamp label={brand.name.toUpperCase()} subLabel="Officieel voorstel" color={brand.colors.accent} rotation={10} />
            </View>
          </View>
        </View>

        <View style={{ marginTop: 40, backgroundColor: brand.colors.surface, padding: 20, borderRadius: 12 }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 5 }}>Nog vragen?</Text>
          <Text style={{ fontSize: 9, color: brand.colors.muted, lineHeight: 1.5 }}>
            Heb je vragen over deze offerte of wil je nog iets aanpassen? Stuur me een bericht via WhatsApp of e-mail. Ik loop het graag nog even samen met je door.
          </Text>
        </View>

        <View style={{ marginTop: "auto", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: brand.colors.primary }}>
              {brand.name.replace(".nl", "")}<Text style={{ color: brand.colors.accent }}>.</Text>
            </Text>
            <Text style={{ fontSize: 8, color: "#94A3B8", marginTop: 5 }}>Daan Koolhaas &middot; {brand.footerMeta[2]}</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={{ fontSize: 8, color: "#94A3B8" }}>{brand.footerMeta[3]} &middot; {brand.footerMeta[4]}</Text>
            <Text style={{ fontSize: 8, color: "#94A3B8" }}>{brand.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
