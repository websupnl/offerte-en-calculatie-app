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

type QuoteAttachment = {
  title?: string;
  imageUrl: string;
  caption?: string;
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
  attachments?: QuoteAttachment[];
};

const logoDataUri = (fileName: string): string => {
  try {
    const buffer = readFileSync(`${process.cwd()}/public/logos/${fileName}`);
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
};

const publicImageDataUri = (imageUrl: string): string => {
  if (!imageUrl.startsWith("/")) return imageUrl;

  try {
    const buffer = readFileSync(`${process.cwd()}/public${imageUrl}`);
    const ext = imageUrl.split(".").pop()?.toLowerCase();
    const mime =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "webp" ? "image/webp" :
      ext === "gif" ? "image/gif" :
      "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return imageUrl;
  }
};

// Profile photo — used on cover and signature avatar
const PROFILE_PHOTO = logoDataUri("daan-koolhaas.jpg");
const SIGNATURE_IMAGE = publicImageDataUri("/signatures/daan-koolhaas-signature.png");

type BrandConfig = {
  key: BrandKey;
  name: string;
  logoWhite: string;
  logoColor: string;
  logoIcon: string;
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
  itemsEyebrow: string;
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
    logoWhite: logoDataUri("websup-white.png"),
    logoColor: logoDataUri("websup-color.png"),
    logoIcon: logoDataUri("websup-icon.png"),
    website: "webs-up.nl",
    email: "hallo@websup.nl",
    phone: "+31 6 82 20 21 48",
    role: "Eigenaar WebsUp.nl",
    defaultCategory: "Maatwerk project",
    defaultTitle: "Persoonlijk voorstel op maat",
    defaultTagline: "Ontwerp - Bouw - Oplevering",
    phaseLabel: "Fase 1",
    summaryGoal: "Complete, gestructureerde aanvragen - minder navraag achteraf",
    delivery: "Indicatie 4-6 weken na akkoord",
    itemsHeader: "Prijsopbouw",
    itemsEyebrow: "Inbegrepen",
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
    logoWhite: logoDataUri("koolhaas-logo-tight.png"),
    logoColor: logoDataUri("koolhaas-logo-tight.png"),
    logoIcon: logoDataUri("koolhaas-icon.png"),
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
    itemsHeader: "Wat wordt er geinstalleerd.",
    itemsEyebrow: "Inbegrepen",
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

// ─── Shared page header ───────────────────────────────────────────────────────

function PageHeader({ brand, quoteNumber, customerName }: { brand: BrandConfig; quoteNumber: string; customerName: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      {brand.key === "websup" && brand.logoColor ? (
        <Image src={brand.logoColor} style={{ height: 22, width: 102, objectFit: "contain", objectPositionX: "0%" }} />
      ) : brand.key === "websup" ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: brand.colors.primary }}>Webs</Text>
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>Up.</Text>
        </View>
      ) : (
        <Image src={brand.logoColor} style={{ height: 18, width: 64, objectFit: "contain", objectPositionX: "0%" }} />
      )}
      <Text style={{ fontSize: 8, color: brand.colors.muted }}>{quoteNumber} &nbsp;&middot;&nbsp; {customerName}</Text>
    </View>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider({ color }: { color: string }) {
  return <View style={{ height: 1, backgroundColor: "#F1F5F9", marginVertical: 16 }} />;
}

// ─── Eyebrow + H2 ─────────────────────────────────────────────────────────────

function Eyebrow({ text, color }: { text: string; color: string }) {
  return (
    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, color, marginBottom: 4 }}>
      {text}
    </Text>
  );
}

function H2({ text, color = "#0F172A" }: { text: string; color?: string }) {
  return (
    <Text style={{ fontSize: 17, fontFamily: "Helvetica-Bold", color, marginBottom: 12, lineHeight: 1.2 }}>
      {text}
    </Text>
  );
}

// ─── Page footer ──────────────────────────────────────────────────────────────

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

// ─── MAIN DOCUMENT ────────────────────────────────────────────────────────────

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
  attachments = [],
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
  const attachmentPages = Math.ceil(attachments.length / 2);
  const attachmentPairs = Array.from({ length: attachmentPages }, (_, index) =>
    attachments.slice(index * 2, index * 2 + 2)
  );
  const totalPages = 4 + attachmentPages;
  const pageLabel = (page: number) =>
    `${String(page).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
  // Cover uses dark left panel for WebsUp, light for Koolhaas
  const coverDark = !isKoolhaas;
  const coverText = coverDark ? "#FFFFFF" : brand.colors.text;
  const coverMuted = coverDark ? "rgba(255,255,255,0.50)" : brand.colors.muted;
  const coverSoft = coverDark ? "rgba(255,255,255,0.09)" : brand.colors.surface;
  const coverBorder = coverDark ? "rgba(255,255,255,0.13)" : brand.colors.border;

  return (
    <Document>

      {/* ════════════════════════════════════════════════════════
          PAGE 1: COVER
      ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", height: "100%" }}>

          {/* LEFT: dark/light panel */}
          <View style={{
            flex: 1.15,
            backgroundColor: coverDark ? brand.colors.primary : "#FFFFFF",
            padding: PAD,
            flexDirection: "column",
          }}>

            {/* Top: logo */}
            <View style={{ marginBottom: 44 }}>
              {brand.key === "websup" ? (
                brand.logoWhite ? (
                  <Image src={brand.logoWhite} style={{ height: 34, width: 148, objectFit: "contain", objectPositionX: "0%" }} />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                    <Text style={{ fontSize: 30, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>Webs</Text>
                    <Text style={{ fontSize: 30, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>Up.</Text>
                  </View>
                )
              ) : (
                <Image src={brand.logoWhite} style={{ height: 44, width: 160, objectFit: "contain", objectPositionX: "0%" }} />
              )}
            </View>

            {/* Mid: main content */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.3, color: brand.colors.accent, marginBottom: 10 }}>
                {category}
              </Text>
              <Text style={{ fontSize: 52, fontFamily: "Helvetica-Bold", color: coverText, lineHeight: 1, marginBottom: 14 }}>
                Offerte
              </Text>
              <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: coverText, lineHeight: 1.25, marginBottom: 24, maxWidth: 235 }}>
                {title}
              </Text>

              <View style={{ borderLeftWidth: 2, borderLeftColor: brand.colors.accent, paddingLeft: 10, marginBottom: 28 }}>
                <Text style={{ fontSize: 8, color: coverMuted, marginBottom: 3 }}>Opgesteld voor</Text>
                <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: coverText }}>{customerName}</Text>
              </View>

              {/* Meta */}
              <View style={{ gap: 5, borderTopWidth: 1, borderTopColor: coverBorder, paddingTop: 14 }}>
                {[
                  { l: "Offertenummer", v: quoteNumber },
                  { l: "Datum", v: quoteDate },
                  ...(validUntil ? [{ l: "Geldig tot", v: validUntil }] : []),
                ].map((row) => (
                  <View key={row.l} style={{ flexDirection: "row", gap: 6 }}>
                    <Text style={{ width: 82, fontSize: 7.5, color: coverMuted }}>{row.l}</Text>
                    <Text style={{ fontSize: 7.5, color: coverText, fontFamily: "Helvetica-Bold" }}>{row.v}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Contact footer */}
            <View style={{ borderTopWidth: 1, borderTopColor: coverBorder, paddingTop: 12, gap: 3, marginTop: 24 }}>
              <Text style={{ fontSize: 8, color: coverMuted }}>{brand.website}</Text>
              <Text style={{ fontSize: 8, color: coverMuted }}>{brand.email}</Text>
              <Text style={{ fontSize: 8, color: coverMuted }}>{brand.phone}</Text>
            </View>
          </View>

          {/* RIGHT: profile photo */}
          <View style={{ flex: 0.85, overflow: "hidden", backgroundColor: brand.colors.surface }}>
            {PROFILE_PHOTO ? (
              <Image
                src={PROFILE_PHOTO}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPositionX: "50%", objectPositionY: "24%" }}
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: coverDark ? "#0e0b16" : brand.colors.surface }} />
            )}
          </View>

        </View>
      </Page>

      {/* ════════════════════════════════════════════════════════
          PAGE 2: INTRO + DELIVERABLES
      ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF", ...innerPage }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.colors.accent }} />
        <PageHeader brand={brand} quoteNumber={quoteNumber} customerName={customerName} />

        {/* Intro */}
        <Eyebrow text="Persoonlijke toelichting" color={brand.colors.accent} />
        <H2 text={`Beste ${customerName.split(" ")[0]},`} />
        <Text style={{ fontSize: 9.5, lineHeight: 1.65, color: "#334155", marginBottom: 16 }}>
          {intro || brand.summaryGoal}
        </Text>

        {/* Signature */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, overflow: "hidden" }}>
            {PROFILE_PHOTO ? (
              <Image src={PROFILE_PHOTO} style={{ width: 32, height: 32, margin: 1, borderRadius: 16, objectFit: "cover", objectPositionY: "24%" }} />
            ) : (
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: brand.colors.accent, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>DK</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold" }}>Daan Koolhaas</Text>
            <Text style={{ fontSize: 7.5, color: brand.colors.muted }}>{brand.role}</Text>
          </View>
        </View>

        <PageFooter tag="Offerte" page={pageLabel(2)} customerName={customerName} />
      </Page>

      {false && (
      <>

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

        <View style={{ gap: 7, marginBottom: 4 }}>
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

        <PageFooter tag="Offerte" page={pageLabel(3)} customerName={customerName} />
      </Page>

      </>
      )}

      {attachmentPairs.map((pair, pageIndex) => (
        <Page key={pageIndex} size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF", ...innerPage }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.colors.accent }} />
          <PageHeader brand={brand} quoteNumber={quoteNumber} customerName={customerName} />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
            <View>
              <Eyebrow text="Ontwerp & uitwerking" color={brand.colors.accent} />
              <H2 text={isKoolhaas ? "Technische indruk en plaatsing." : "Zo ziet de richting eruit."} />
            </View>
            <View style={{ backgroundColor: brand.colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
              <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: brand.colors.muted }}>{pageIndex + 1} / {attachmentPages}</Text>
            </View>
          </View>

          <View style={{ flex: 1, flexDirection: "column", borderWidth: 1, borderColor: brand.colors.border, borderRadius: 8, overflow: "hidden" }}>
            {pair.map((attachment, i) => (
              <View key={i} style={{ flex: 1, minHeight: 0, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: brand.colors.border }}>
                <View style={{ flex: 1, overflow: "hidden", backgroundColor: "#FFFFFF" }}>
                  <Image src={publicImageDataUri(attachment.imageUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </View>
                {(attachment.title || attachment.caption) && (
                  <View style={{ marginTop: 8, minHeight: 34 }}>
                    {attachment.title && <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: brand.colors.text }}>{attachment.title}</Text>}
                    {attachment.caption && <Text style={{ fontSize: 8, color: brand.colors.muted, lineHeight: 1.35, marginTop: 3 }}>{attachment.caption}</Text>}
                  </View>
                )}
              </View>
            ))}
          </View>

          <PageFooter tag="Offerte" page={pageLabel(3 + pageIndex)} customerName={customerName} />
        </Page>
      ))}

      {/* ════════════════════════════════════════════════════════
          PAGE 4: INVESTMENT + OPTIONS
      ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9, backgroundColor: "#FFFFFF", ...innerPage }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.colors.accent }} />
        <PageHeader brand={brand} quoteNumber={quoteNumber} customerName={customerName} />

        <Eyebrow text="De investering" color={brand.colors.accent} />
        <H2 text={brand.investmentTitle} />

        <View style={{ borderWidth: 1, borderColor: brand.colors.border, borderRadius: 10, overflow: "hidden", marginTop: 10, marginBottom: 14 }}>
          <View style={{ flexDirection: "row", backgroundColor: brand.colors.surface, borderBottomWidth: 1, borderBottomColor: brand.colors.border }}>
            <Text style={{ flex: 1, padding: 9, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: brand.colors.muted, textTransform: "uppercase" }}>Omschrijving</Text>
            <Text style={{ width: 58, padding: 9, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: brand.colors.muted, textAlign: "right", textTransform: "uppercase" }}>Aantal</Text>
            <Text style={{ width: 78, padding: 9, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: brand.colors.muted, textAlign: "right", textTransform: "uppercase" }}>Prijs</Text>
            <Text style={{ width: 78, padding: 9, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: brand.colors.muted, textAlign: "right", textTransform: "uppercase" }}>Totaal</Text>
          </View>
          {items.map((item, i) => {
            const isIncludedSubItem = Number((item as { indent?: number }).indent ?? 0) > 0 || (Number(item.unitPrice) === 0 && Number(item.total) === 0);

            if (isIncludedSubItem) {
              return (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: brand.colors.surface, borderBottomWidth: 1, borderBottomColor: brand.colors.border }}>
                  <View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: brand.colors.accent, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>v</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 10, color: "#334155", lineHeight: 1.35 }}>{item.description}</Text>
                </View>
              );
            }

            return (
              <View key={i} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: brand.colors.border }}>
                <Text style={{ flex: 1, padding: 9, fontSize: 8.5, color: "#334155", lineHeight: 1.35 }}>{item.description}</Text>
                <Text style={{ width: 58, padding: 9, fontSize: 8.5, color: "#334155", textAlign: "right" }}>{formatAmt(item.qty)}</Text>
                <Text style={{ width: 78, padding: 9, fontSize: 8.5, color: "#334155", textAlign: "right" }}>{formatEur(item.unitPrice)}</Text>
                <Text style={{ width: 78, padding: 9, fontSize: 8.5, color: "#334155", textAlign: "right" }}>{formatEur(item.total)}</Text>
              </View>
            );
          })}
          {[
            ["Totaal excl. btw", formatEur(totalExVat), false],
            ["Btw", formatEur(totalVat), false],
            ["Totaal incl. btw", formatEur(totalIncVat), true],
          ].map(([label, value, strong]) => (
            <View key={String(label)} style={{ flexDirection: "row", justifyContent: "flex-end", backgroundColor: strong ? brand.colors.surface : "#FFFFFF" }}>
              <Text style={{ width: 180, padding: 8, fontSize: strong ? 10 : 8.5, fontFamily: strong ? "Helvetica-Bold" : "Helvetica", color: strong ? brand.colors.text : brand.colors.muted, textAlign: "right" }}>{label}</Text>
              <Text style={{ width: 96, padding: 8, fontSize: strong ? 10 : 8.5, fontFamily: strong ? "Helvetica-Bold" : "Helvetica", color: brand.colors.text, textAlign: "right" }}>{value}</Text>
            </View>
          ))}
        </View>

        {false && (
        <>
        {/* Price card */}
        <View style={{ backgroundColor: brand.colors.primary, borderRadius: 14, padding: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>
            {brand.investmentLabel}
          </Text>
          <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", marginBottom: 10, lineHeight: 1.5 }}>
            {brand.investmentDescription}
          </Text>

          {/* Amount */}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: brand.colors.accent }}>€</Text>
            <Text style={{ fontSize: 34, fontFamily: "Helvetica-Bold", color: "#FFFFFF", lineHeight: 1 }}>
              {formatAmt(totalIncVat)}
            </Text>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.8)" }}>incl. btw</Text>
              <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.4)" }}>eenmalig</Text>
            </View>
          </View>

          {/* Items in price card */}
          <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 8, gap: 4 }}>
            {items.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", flex: 1 }}>{item.description}</Text>
                <Text style={{ fontSize: 7.5, color: brand.colors.accent, fontFamily: "Helvetica-Bold", marginLeft: 8 }}>inbegrepen</Text>
              </View>
            ))}
          </View>

          {/* Subtotals */}
          <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 8, marginTop: 6, gap: 3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>Subtotaal excl. btw</Text>
              <Text style={{ fontSize: 8, color: "#FFFFFF" }}>{formatEur(totalExVat)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>Btw (21%)</Text>
              <Text style={{ fontSize: 8, color: "#FFFFFF" }}>{formatEur(totalVat)}</Text>
            </View>
          </View>
        </View>

        </>
        )}

        <Divider color={brand.colors.border} />

        {/* Options */}
        <Eyebrow text={brand.optionsEyebrow} color={brand.colors.accent} />
        <H2 text={brand.optionsTitle} />

        <View style={{ gap: 7 }}>
          {options.map((o, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: brand.colors.surface, padding: 10, borderRadius: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: brand.colors.border, justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
                <Text style={{ fontSize: 11, color: brand.colors.accent }}>+</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{o.t}</Text>
                <Text style={{ fontSize: 8, color: brand.colors.muted, lineHeight: 1.4 }}>{o.d}</Text>
                <View style={{ marginTop: 4, backgroundColor: brand.colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start" }}>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: brand.colors.muted }}>{o.tag}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <PageFooter tag="Offerte" page={pageLabel(3 + attachmentPages)} customerName={customerName} />
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
                <Text style={{ fontSize: 7, color: "#ef4444", fontFamily: "Helvetica-Bold" }}>x</Text>
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
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{brand.contractor}</Text>
            {SIGNATURE_IMAGE ? (
              <Image src={SIGNATURE_IMAGE} style={{ height: 90, width: "auto", maxWidth: 260, objectFit: "contain", marginBottom: 4 }} />
            ) : (
              <View style={{ height: 90, marginBottom: 4 }} />
            )}
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

        {/* Doc footer — contact only, no logo */}
        <View style={{ borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12, flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-end", marginTop: "auto" }}>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 7.5, color: "#94A3B8" }}>{brand.name} &nbsp;&middot;&nbsp; Daan Koolhaas &nbsp;&middot;&nbsp; Friesland</Text>
            <Text style={{ fontSize: 7.5, color: "#94A3B8", marginTop: 2 }}>{brand.website} &nbsp;&middot;&nbsp; {brand.email}</Text>
            <Text style={{ fontSize: 7.5, color: "#94A3B8", marginTop: 2 }}>Offerte geldig tot {validUntil || "—"}</Text>
          </View>
        </View>

        <PageFooter tag="Offerte" page={pageLabel(4 + attachmentPages)} customerName={customerName} />
      </Page>

    </Document>
  );
}
