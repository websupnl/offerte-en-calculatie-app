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
  title?: string;
  category?: string;
  tagline?: string;
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

const logoDataUri = (fileName: string) => {
  try {
    const buffer = readFileSync(`${process.cwd()}/public/logos/${fileName}`);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
};

type BrandConfig = {
  key: BrandKey;
  name: string;
  logoPath: string;
  logoPathDark?: string;
  website: string;
  email: string;
  phone: string;
  role: string;
  defaultCategory: string;
  defaultTitle: string;
  defaultTagline: string;
  phaseLabel: string;
  summaryGoal: string;
  delivery: string;
  itemsHeader: string;
  processEyebrow: string;
  processTitle: string;
  approachEyebrow: string;
  approachTitle: string;
  investmentTitle: string;
  investmentLabel: string;
  investmentDescription: string;
  optionsEyebrow: string;
  optionsTitle: string;
  exclusionsEyebrow: string;
  exclusionsTitle: string;
  closingTitle: string;
  contractor: string;
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
  };
  flow: { n: number; t: string; d: string }[];
  approach: { n: string; t: string; d: string }[];
  options: { t: string; d: string; tag: string }[];
  exclusions: string[];
};

const BRANDS: Record<BrandKey, BrandConfig> = {
  websup: {
    key: "websup",
    name: "WebsUp.nl",
    logoPath: logoDataUri("websup-white.png"),
    website: "webs-up.nl",
    email: "hallo@websup.nl",
    phone: "+31 6 82 20 21 48",
    role: "Eigenaar WebsUp.nl",
    defaultCategory: "Maatwerk project",
    defaultTitle: "Persoonlijk voorstel op maat",
    defaultTagline: "Ontwerp - Bouw - Plaatsing",
    phaseLabel: "Fase 1",
    summaryGoal: "Complete, gestructureerde aanvragen - minder navraag achteraf",
    delivery: "Indicatie 4-6 weken na akkoord",
    itemsHeader: "Onderdelen binnen fase 1.",
    processEyebrow: "Het proces",
    processTitle: "In duidelijke stappen.",
    approachEyebrow: "De werkwijze",
    approachTitle: "Van intake tot oplevering.",
    investmentTitle: "Een heldere prijs, geen verrassingen.",
    investmentLabel: "Totale investering - Fase 1",
    investmentDescription: "Investering voor het project zoals beschreven in de voorgaande pagina's.",
    optionsEyebrow: "Optionele uitbreidingen",
    optionsTitle: "Klaar om mee te groeien.",
    exclusionsEyebrow: "Goed om te weten",
    exclusionsTitle: "Niet standaard inbegrepen.",
    closingTitle: "Zetten we de stap?",
    contractor: "WebsUp.nl - Daan Koolhaas",
    footerLine: "WebsUp.nl - Daan Koolhaas - Friesland",
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
    },
    flow: [
      { n: 1, t: "Intake", d: "Wensen, randvoorwaarden en inhoud scherp krijgen." },
      { n: 2, t: "Ontwerp", d: "Structuur, schermen en technische aanpak uitwerken." },
      { n: 3, t: "Bouw", d: "Realisatie van de afgesproken onderdelen." },
      { n: 4, t: "Test", d: "Controle op werking, inhoud en gebruiksgemak." },
      { n: 5, t: "Oplevering", d: "Livegang met korte overdracht." },
    ],
    approach: [
      { n: "01", t: "Scherp starten", d: "We leggen doelen, inhoud en prioriteiten vast voordat de bouw begint." },
      { n: "02", t: "Gefaseerd bouwen", d: "De belangrijkste onderdelen worden eerst uitgewerkt en getest." },
      { n: "03", t: "Netjes opleveren", d: "Na controle volgt overdracht en ruimte voor kleine finetuning." },
    ],
    options: [
      { t: "Extra koppeling", d: "Een aanvullende koppeling met een extern systeem of formulier.", tag: "Op aanvraag" },
      { t: "Doorontwikkeling", d: "Nieuwe functies na oplevering op basis van praktijkgebruik.", tag: "Los voorstel" },
    ],
    exclusions: [
      "Werk buiten de beschreven scope",
      "Licenties of externe abonnementen",
      "Teksten, fotografie of contentproductie",
      "Koppelingen die niet vooraf zijn besproken",
    ],
  },
  koolhaas: {
    key: "koolhaas",
    name: "Koolhaas Installaties",
    logoPath: logoDataUri("koolhaas-logo-tight.png"),
    logoPathDark: logoDataUri("koolhaas-logo-tight.png"),
    website: "koolhaasinstallaties.nl",
    email: "daan@koolhaasinstallaties.nl",
    phone: "+31 6 82 20 21 48",
    role: "Koolhaas Installaties",
    defaultCategory: "Installatie - Energieopslag",
    defaultTitle: "Thuisbatterij installatie",
    defaultTagline: "Advies - Installatie - Inbedrijfstelling",
    phaseLabel: "Installatie",
    summaryGoal: "Eigen zonnestroom opslaan en slim verbruiken",
    delivery: "Installatie in 1 dag - ca. 2-3 weken na akkoord",
    itemsHeader: "Wat wordt er geinstalleerd",
    processEyebrow: "Planning",
    processTitle: "Van akkoord tot werkende installatie.",
    approachEyebrow: "Werkwijze",
    approachTitle: "Netjes voorbereid en veilig uitgevoerd.",
    investmentTitle: "Eenmalige investering, helder opgebouwd.",
    investmentLabel: "Totale investering",
    investmentDescription: "Een eenmalige investering voor materialen, montage, aansluiting, controle en oplevering zoals beschreven in deze offerte.",
    optionsEyebrow: "Optioneel meerwerk",
    optionsTitle: "Alleen waar het technisch logisch is.",
    exclusionsEyebrow: "Niet inbegrepen",
    exclusionsTitle: "Duidelijke grenzen aan de scope.",
    closingTitle: "Akkoord voor uitvoering",
    contractor: "Koolhaas Installaties - Daan Koolhaas",
    footerLine: "Koolhaas Installaties - Daan Koolhaas - Friesland",
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
    },
    flow: [
      { n: 1, t: "Akkoord", d: "Offerte akkoord en bevestiging van de uitgangspunten." },
      { n: 2, t: "Technische check", d: "Laatste controle van meterkast, bekabeling en opstelplek." },
      { n: 3, t: "Planning", d: "Installatiemoment afstemmen en materialen reserveren." },
      { n: 4, t: "Installatie", d: "Plaatsing, aansluiting en nette afwerking op locatie." },
      { n: 5, t: "Inbedrijfstelling", d: "Testen, instellen en opleveren van de thuisbatterij." },
    ],
    approach: [
      { n: "01", t: "Voorbereiding", d: "We controleren de situatie en nemen de technische aandachtspunten door." },
      { n: "02", t: "Veilige montage", d: "Bekabeling, beveiliging en aansluiting worden volgens geldende normen uitgevoerd." },
      { n: "03", t: "Werkend opleveren", d: "De installatie wordt getest, ingesteld en duidelijk overgedragen." },
    ],
    options: [
      { t: "Extra energiemeting", d: "Aanvullende meetpunten wanneer dit technisch nodig is.", tag: "In overleg" },
      { t: "Groepenkast aanpassing", d: "Meerwerk als de bestaande kast niet geschikt blijkt.", tag: "In overleg" },
    ],
    exclusions: [
      "Hak- en breekwerk buiten normale montage",
      "Verzwaring of wijziging van de netaansluiting",
      "Aanpassingen aan dak, gevel of constructie",
      "Meerwerk door onvoorziene bestaande gebreken",
    ],
  },
};

function getBrand(slug: string): BrandConfig {
  return slug === "koolhaas" ? BRANDS.koolhaas : BRANDS.websup;
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

function formatAmt(amount: number): string {
  return new Intl.NumberFormat("nl-NL").format(amount);
}

// ─── Shared page header (inner pages) ────────────────────────────────────────

function PageHeader({ brand, quoteNumber, customerName }: { brand: BrandConfig; quoteNumber: string; customerName: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      {brand.key === "websup" ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
          <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: brand.colors.primary }}>Webs</Text>
          <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>Up.</Text>
        </View>
      ) : (
        <Image src={brand.logoPathDark || brand.logoPath} style={{ height: 18, width: 60, objectFit: "contain" }} />
      )}
      <Text style={{ fontSize: 8, color: brand.colors.muted }}>{quoteNumber} &nbsp;&middot;&nbsp; {customerName}</Text>
    </View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider({ color }: { color: string }) {
  return <View style={{ height: 1, backgroundColor: "#F1F5F9", marginVertical: 18 }} />;
}

// ─── Eyebrow + H2 ────────────────────────────────────────────────────────────

function Eyebrow({ text, color }: { text: string; color: string }) {
  return (
    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, color, marginBottom: 4 }}>
      {text}
    </Text>
  );
}

function H2({ text, color = "#0F172A" }: { text: string; color?: string }) {
  return (
    <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color, marginBottom: 14, lineHeight: 1.2 }}>
      {text}
    </Text>
  );
}

// ─── Page footer ─────────────────────────────────────────────────────────────

function PageFooter({ tag, page, customerName }: { tag: string; page: string; customerName: string }) {
  return (
    <>
      <Text style={{ position: "absolute", bottom: 22, left: 38, fontSize: 7.5, color: "#94A3B8", fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}>
        {tag} &nbsp;&middot;&nbsp; {customerName}
      </Text>
      <Text style={{ position: "absolute", bottom: 22, right: 38, fontSize: 7.5, color: "#94A3B8", fontFamily: "Helvetica-Bold" }}>
        {page}
      </Text>
    </>
  );
}

// ─── MAIN DOCUMENT ───────────────────────────────────────────────────────────

export function QuotePDF({
  companySlug,
  companyTagline,
  quoteNumber,
  quoteDate,
  validUntil,
  customerName,
  title: titleProp,
  category: categoryProp,
  tagline: taglineProp,
  intro,
  outro,
  items,
  totalExVat,
  totalVat,
  totalIncVat,
  itemsHeader,
  status,
  acceptedAt,
  flow: flowProp = [],
  approach: approachProp = [],
  options: optionsProp = [],
  exclusions: exclusionsProp = [],
}: QuotePDFProps) {
  const brand = getBrand(companySlug);
  const isKoolhaas = companySlug === "koolhaas";

  const flow = flowProp.length ? flowProp : brand.flow;
  const approach = approachProp.length ? approachProp : brand.approach;
  const options = optionsProp.length ? optionsProp : brand.options;
  const exclusions = exclusionsProp.length ? exclusionsProp : brand.exclusions;

  const title = titleProp || brand.defaultTitle;
  const category = categoryProp || brand.defaultCategory;
  const tagline = taglineProp || companyTagline || brand.defaultTagline;

  const PAD = 38;
  const innerPage = { padding: PAD, paddingTop: 30, paddingBottom: 50 };
  const coverLight = isKoolhaas;
  const coverText = coverLight ? brand.colors.text : "#FFFFFF";
  const coverMuted = coverLight ? brand.colors.muted : "rgba(255,255,255,0.45)";
  const coverSoft = coverLight ? brand.colors.surface : "rgba(255,255,255,0.08)";
  const coverBorder = coverLight ? brand.colors.border : "rgba(255,255,255,0.12)";

  return (
    <Document>

      {/* ════════════════════════════════════════════════════════
          PAGE 1: COVER
      ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", height: "100%" }}>

          {/* LEFT: dark panel */}
          <View style={{ flex: 1.1, backgroundColor: coverLight ? "#FFFFFF" : brand.colors.primary, padding: PAD, flexDirection: "column" }}>

            {/* Top: logo + meta */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 50 }}>
              {brand.key === "websup" ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                  <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>Webs</Text>
                  <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>Up.</Text>
                </View>
              ) : (
                <Image src={brand.logoPath} style={{ height: 54, width: 190, objectFit: "contain" }} />
              )}

              <View style={{ borderLeftWidth: 1, borderLeftColor: coverBorder, paddingLeft: 12 }}>
                {[
                  { l: "Offertenummer", v: quoteNumber },
                  { l: "Datum", v: quoteDate },
                  { l: "Geldig tot", v: validUntil || "—" },
                  { l: "Contactpersoon", v: "Daan Koolhaas" },
                ].map((row) => (
                  <View key={row.l} style={{ flexDirection: "row", marginBottom: 3 }}>
                    <Text style={{ width: 85, fontSize: 7.5, color: coverMuted, fontFamily: "Helvetica-Bold" }}>{row.l}</Text>
                    <Text style={{ fontSize: 7.5, color: coverText, fontFamily: "Helvetica-Bold" }}>{row.v}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Mid: eyebrow + h1 + title + for */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, color: brand.colors.accent, marginBottom: 6 }}>
                {category}
              </Text>
              <Text style={{ fontSize: 48, fontFamily: "Helvetica-Bold", color: coverText, lineHeight: 1, marginBottom: 12 }}>
                Offerte
              </Text>
              <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: coverText, lineHeight: 1.3, marginBottom: 20, maxWidth: 240 }}>
                {title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 }}>
                <Text style={{ fontSize: 9, color: coverMuted }}>Voor</Text>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: coverText }}>{customerName}</Text>
              </View>

              {/* Pills */}
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <View style={{ backgroundColor: brand.colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>{brand.phaseLabel}</Text>
                </View>
                <View style={{ backgroundColor: coverSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontSize: 7.5, color: coverLight ? brand.colors.muted : "rgba(255,255,255,0.7)" }}>{tagline}</Text>
                </View>
                <View style={{ backgroundColor: coverSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontSize: 7.5, color: coverLight ? brand.colors.muted : "rgba(255,255,255,0.7)" }}>{formatEur(totalIncVat)} incl. btw</Text>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={{ borderTopWidth: 1, borderTopColor: coverLight ? brand.colors.border : "rgba(255,255,255,0.1)", paddingTop: 14, gap: 4 }}>
              <Text style={{ fontSize: 8, color: coverMuted }}>{brand.website}</Text>
              <Text style={{ fontSize: 8, color: coverMuted }}>{brand.email}</Text>
              <Text style={{ fontSize: 8, color: coverMuted }}>{brand.phone}</Text>
            </View>
          </View>

          {/* RIGHT: image placeholder */}
          <View style={{ flex: 0.9, backgroundColor: coverLight ? brand.colors.surface : "#0e0b16", justifyContent: "center", alignItems: "center" }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: coverLight ? brand.colors.border : "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 22, color: coverLight ? brand.colors.muted : "rgba(255,255,255,0.15)" }}>?</Text>
            </View>
            <Text style={{ fontSize: 8, color: coverLight ? brand.colors.muted : "rgba(255,255,255,0.15)", marginTop: 10, textAlign: "center" }}>Projectfoto</Text>
          </View>
        </View>
      </Page>

      {/* ════════════════════════════════════════════════════════
          PAGE 2: INTRO + SUMMARY + DELIVERABLES
      ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF", ...innerPage }}>
        {/* accent bar */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.colors.accent }} />
        <PageHeader brand={brand} quoteNumber={quoteNumber} customerName={customerName} />

        {/* Intro */}
        <Eyebrow text="Persoonlijke toelichting" color={brand.colors.accent} />
        <H2 text={`Beste ${customerName.split(" ")[0]},`} />
        <Text style={{ fontSize: 9.5, lineHeight: 1.65, color: "#334155", marginBottom: 14 }}>
          {intro || brand.summaryGoal}
        </Text>
        {/* Signature */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: brand.colors.accent, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>DK</Text>
          </View>
          <View>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold" }}>Daan Koolhaas</Text>
            <Text style={{ fontSize: 7.5, color: brand.colors.muted }}>{brand.role}</Text>
          </View>
        </View>

        <Divider color={brand.colors.border} />

        {/* Summary table */}
        <Eyebrow text="Het project in het kort" color={brand.colors.accent} />
        <H2 text="In één oogopslag." />
        <View style={{ borderWidth: 1, borderColor: brand.colors.border, borderRadius: 8, overflow: "hidden", marginBottom: 4 }}>
          {[
            { k: "Project", v: title },
            { k: "Type", v: category },
            { k: "Doel", v: brand.summaryGoal },
            { k: "Oplevering", v: brand.delivery },
            { k: "Investering", v: `${formatEur(totalIncVat)}  incl. btw · eenmalig`, hl: true },
            { k: "Scope", v: tagline },
          ].map((row, i, arr) => (
            <View key={row.k} style={{ flexDirection: "row", borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: brand.colors.border, backgroundColor: row.hl ? "#fff7ed" : "#FFFFFF" }}>
              <Text style={{ width: "32%", backgroundColor: brand.colors.surface, padding: 8, fontSize: 8, fontFamily: "Helvetica-Bold", borderRightWidth: 1, borderRightColor: brand.colors.border }}>
                {row.k}
              </Text>
              <Text style={{ flex: 1, padding: 8, fontSize: 8, color: row.hl ? brand.colors.accent : brand.colors.text, fontFamily: row.hl ? "Helvetica-Bold" : "Helvetica" }}>
                {row.v}
              </Text>
            </View>
          ))}
        </View>

        <Divider color={brand.colors.border} />

        {/* Deliverables */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <View>
            <Eyebrow text="Wat wordt er geleverd" color={brand.colors.accent} />
            <H2 text={itemsHeader || brand.itemsHeader} />
          </View>
          <View style={{ backgroundColor: brand.colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: brand.colors.muted }}>{items.length} onderdelen</Text>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          {items.map((item, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: brand.colors.accent, justifyContent: "center", alignItems: "center", marginTop: 1 }}>
                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>✓</Text>
              </View>
              <Text style={{ fontSize: 9, color: "#334155", flex: 1, lineHeight: 1.5 }}>{item.description}</Text>
            </View>
          ))}
        </View>

        <PageFooter tag="Offerte" page="02 / 05" customerName={customerName} />
      </Page>

      {/* ════════════════════════════════════════════════════════
          PAGE 3: FLOW + APPROACH
      ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF", ...innerPage }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.colors.accent }} />
        <PageHeader brand={brand} quoteNumber={quoteNumber} customerName={customerName} />

        {/* Flow */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <View>
            <Eyebrow text={brand.processEyebrow} color={brand.colors.accent} />
            <H2 text={brand.processTitle} />
          </View>
          <View style={{ backgroundColor: brand.colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: brand.colors.muted }}>{flow.length} stappen</Text>
          </View>
        </View>

        <View style={{ gap: 8, marginBottom: 4 }}>
          {flow.map((step, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 10, backgroundColor: brand.colors.surface, borderRadius: 8 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: brand.colors.primary, justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: brand.colors.text, marginBottom: 2 }}>{step.t}</Text>
                <Text style={{ fontSize: 8, color: brand.colors.muted, lineHeight: 1.4 }}>{step.d}</Text>
              </View>
            </View>
          ))}
        </View>

        <Divider color={brand.colors.border} />

        {/* Approach */}
        <Eyebrow text={brand.approachEyebrow} color={brand.colors.accent} />
        <H2 text={brand.approachTitle} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {approach.map((s, i) => (
            <View key={i} style={{ width: "47%", backgroundColor: brand.colors.surface, padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: brand.colors.accent }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: brand.colors.accent, marginBottom: 3 }}>{s.n}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{s.t}</Text>
              <Text style={{ fontSize: 8, color: brand.colors.muted, lineHeight: 1.4 }}>{s.d}</Text>
            </View>
          ))}
        </View>

        <PageFooter tag="Offerte" page="03 / 05" customerName={customerName} />
      </Page>

      {/* ════════════════════════════════════════════════════════
          PAGE 4: INVESTMENT + OPTIONS
      ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF", ...innerPage }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.colors.accent }} />
        <PageHeader brand={brand} quoteNumber={quoteNumber} customerName={customerName} />

        <Eyebrow text="De investering" color={brand.colors.accent} />
        <H2 text={brand.investmentTitle} />

        {/* Price card */}
        <View style={{ backgroundColor: brand.colors.primary, borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <Text style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
            {brand.investmentLabel}
          </Text>
          <Text style={{ fontSize: 8.5, color: "rgba(255,255,255,0.5)", marginBottom: 12, lineHeight: 1.5 }}>
            {brand.investmentDescription}
          </Text>

          {/* Amount */}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>€</Text>
            <Text style={{ fontSize: 38, fontFamily: "Helvetica-Bold", color: "#FFFFFF", lineHeight: 1 }}>
              {formatAmt(totalIncVat)}
            </Text>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.8)" }}>incl. btw</Text>
              <Text style={{ fontSize: 7.5, color: "rgba(255,255,255,0.4)" }}>eenmalig</Text>
            </View>
          </View>

          {/* Items in price card */}
          <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 10, gap: 5 }}>
            {items.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 8.5, color: "rgba(255,255,255,0.7)", flex: 1 }}>{item.description}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Text style={{ fontSize: 7.5, color: brand.colors.accent, fontFamily: "Helvetica-Bold" }}>✓</Text>
                  <Text style={{ fontSize: 7.5, color: "rgba(255,255,255,0.45)" }}>inbegrepen</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Subtotals */}
          <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 10, marginTop: 6, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 8.5, color: "rgba(255,255,255,0.5)" }}>Subtotaal excl. btw</Text>
              <Text style={{ fontSize: 8.5, color: "#FFFFFF" }}>{formatEur(totalExVat)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 8.5, color: "rgba(255,255,255,0.5)" }}>Btw (21%)</Text>
              <Text style={{ fontSize: 8.5, color: "#FFFFFF" }}>{formatEur(totalVat)}</Text>
            </View>
          </View>
        </View>

        <Divider color={brand.colors.border} />

        {/* Options */}
        <Eyebrow text={brand.optionsEyebrow} color={brand.colors.accent} />
        <H2 text={brand.optionsTitle} />

        <View style={{ gap: 8 }}>
          {options.map((o, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: brand.colors.surface, padding: 12, borderRadius: 8 }}>
              <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: brand.colors.border, justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
                <Text style={{ fontSize: 11, color: brand.colors.accent }}>⊕</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{o.t}</Text>
                <Text style={{ fontSize: 8, color: brand.colors.muted, lineHeight: 1.4 }}>{o.d}</Text>
                <View style={{ marginTop: 5, backgroundColor: brand.colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start" }}>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: brand.colors.muted }}>{o.tag}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <PageFooter tag="Offerte" page="04 / 05" customerName={customerName} />
      </Page>

      {/* ════════════════════════════════════════════════════════
          PAGE 5: EXCLUSIONS + OUTRO + SIGN
      ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF", ...innerPage }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.colors.accent }} />
        <PageHeader brand={brand} quoteNumber={quoteNumber} customerName={customerName} />

        {/* Exclusions */}
        <Eyebrow text={brand.exclusionsEyebrow} color={brand.colors.accent} />
        <H2 text={brand.exclusionsTitle} />
        <View style={{ gap: 5, marginBottom: 4 }}>
          {exclusions.map((item, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#fef2f2", justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 7, color: "#ef4444", fontFamily: "Helvetica-Bold" }}>✕</Text>
              </View>
              <Text style={{ fontSize: 9, color: "#334155", flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>

        <Divider color={brand.colors.border} />

        {/* Outro */}
        <Eyebrow text="Slotwoord" color={brand.colors.accent} />
        <Text style={{ fontSize: 9.5, lineHeight: 1.65, color: "#334155", marginBottom: 4 }}>
          {outro || "Heb je vragen over deze offerte of wil je iets aanpassen? Stuur een bericht via WhatsApp of e-mail. Ik loop het graag samen met je door."}
        </Text>

        <Divider color={brand.colors.border} />

        {/* Sign */}
        <Eyebrow text="Akkoord voor uitvoering" color={brand.colors.accent} />
        <H2 text={brand.closingTitle} />

        <View style={{ flexDirection: "row", gap: 16, marginBottom: 20 }}>
          {/* Client sign box */}
          <View style={{ flex: 1, borderWidth: 1, borderColor: brand.colors.border, borderRadius: 10, padding: 14, position: "relative" }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#94A3B8", marginBottom: 3 }}>Namens opdrachtgever</Text>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 20 }}>{customerName}</Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: brand.colors.border, marginBottom: 4 }} />
            <Text style={{ fontSize: 7, color: "#94A3B8" }}>Naam / Datum</Text>
            {status === "ACCEPTED" && acceptedAt && (
              <View style={{ position: "absolute", top: 8, right: 10, transform: "rotate(-12deg)" }}>
                <View style={{ width: 65, height: 65, borderRadius: 32.5, borderWidth: 2, borderStyle: "dashed", borderColor: "#22c55e", justifyContent: "center", alignItems: "center", padding: 5 }}>
                  <Text style={{ fontSize: 5.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#22c55e", textAlign: "center" }}>Digitaal akkoord</Text>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#22c55e", textAlign: "center" }}>Geaccepteerd</Text>
                  <Text style={{ fontSize: 5.5, color: "#22c55e", marginTop: 2 }}>{acceptedAt}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Contractor sign box */}
          <View style={{ flex: 1, borderWidth: 1, borderColor: brand.colors.border, borderRadius: 10, padding: 14, position: "relative" }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#94A3B8", marginBottom: 3 }}>Namens opdrachtnemer</Text>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 20 }}>{brand.contractor}</Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: brand.colors.border, marginBottom: 4 }} />
            <Text style={{ fontSize: 7, color: "#94A3B8" }}>Naam / Datum</Text>
            <View style={{ position: "absolute", top: 8, right: 10, transform: "rotate(10deg)" }}>
              <View style={{ width: 65, height: 65, borderRadius: 32.5, borderWidth: 2, borderStyle: "dashed", borderColor: brand.colors.accent, justifyContent: "center", alignItems: "center", padding: 5 }}>
                <Text style={{ fontSize: 5.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: brand.colors.accent, textAlign: "center" }}>Officieel voorstel</Text>
                <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: brand.colors.accent, textAlign: "center", lineHeight: 1.2 }}>{brand.name.toUpperCase()}</Text>
                <Text style={{ fontSize: 5.5, color: brand.colors.accent, marginTop: 2 }}>Gevalideerd</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Doc footer */}
        <View style={{ borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
          {brand.key === "websup" ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: brand.colors.primary }}>Webs</Text>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>Up.</Text>
            </View>
          ) : (
            <Image src={brand.logoPathDark || brand.logoPath} style={{ height: 18, width: 60, objectFit: "contain" }} />
          )}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 7.5, color: "#94A3B8" }}>{brand.name} &nbsp;&middot;&nbsp; Daan Koolhaas &nbsp;&middot;&nbsp; Friesland</Text>
            <Text style={{ fontSize: 7.5, color: "#94A3B8", marginTop: 2 }}>{brand.website} &nbsp;&middot;&nbsp; {brand.email}</Text>
            <Text style={{ fontSize: 7.5, color: "#94A3B8", marginTop: 2 }}>Offerte geldig tot {validUntil || "—"}</Text>
          </View>
        </View>

        <PageFooter tag="Offerte" page="05 / 05" customerName={customerName} />
      </Page>

    </Document>
  );
}
