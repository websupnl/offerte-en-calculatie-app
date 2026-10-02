export type BrandGradient = {
  from: string;
  via: string;
  to: string;
  angle: number;
  viaPosition: number;
};

export type CompanyBranding = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl: string;
  faviconUrl: string;
  font: string;
  gradient: BrandGradient;
  tagline?: string;
  personalName?: string;
  personalMessage?: string;
  personalWhatsapp?: string;
};

export type TravelPricingTier = {
  maxKm: number | null;
  price: number;
};

export type CompanySettings = {
  defaultVatRate: number;
  quoteValidDays: number;
  quoteIntroDefault: string;
  quoteOutroDefault: string;
  paymentTerms: string;
  emailFrom?: string;
  openaiApiKey?: string;
  aiSystemPrompts: Record<string, string>;
  homeBaseZipCode: string;
  travelPricingTiers: TravelPricingTier[];
  invoice?: InvoiceSettings;
};

/** Bedrijfs- en betaalgegevens voor facturen. IBAN is een betaaloptie, geen algemene factuureis. */
export type InvoiceSettings = {
  address: string;
  kvk: string;
  vatNumber: string;
  iban: string;
  accountHolder: string;
  paymentDays: number;
  footer: string;
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  address: "",
  kvk: "95524061",
  vatNumber: "",
  iban: "",
  accountHolder: "",
  paymentDays: 14,
  footer: "",
};

export function getInvoiceSettings(settings: unknown): InvoiceSettings {
  const stored = ((settings ?? {}) as { invoice?: Partial<InvoiceSettings> }).invoice ?? {};
  return { ...DEFAULT_INVOICE_SETTINGS, ...stored };
}

export const DEFAULT_BRANDING: Record<string, CompanyBranding> = {
  websup: {
    primaryColor: "#0b1526",
    accentColor: "#f97316",
    backgroundColor: "#f8f9fc",
    textColor: "#0b1526",
    logoUrl: "/logos/websup-wordmark-black.png",
    faviconUrl: "/icons/icon-192.png",
    font: "Inter",
    gradient: { from: "#f97316", via: "#ec4899", to: "#a78bfa", angle: 135, viaPosition: 50 },
    tagline: "Websites, apps & systemen die groeien",
  },
  koolhaas: {
    primaryColor: "#102D59",
    accentColor: "#247EB2",
    backgroundColor: "#fbfcfd",
    textColor: "#102D59",
    logoUrl: "/logos/koolhaas-logo.png",
    faviconUrl: "/logos/koolhaas-icon.png",
    font: "Sora",
    gradient: { from: "#102d59", via: "#247eb2", to: "#6edbcf", angle: 120, viaPosition: 48 },
    tagline: "Techniek die eerst goed doordacht wordt en daarna netjes wordt uitgevoerd.",
  },
};

export const DEFAULT_SETTINGS: CompanySettings = {
  defaultVatRate: 21,
  quoteValidDays: 30,
  quoteIntroDefault: "",
  quoteOutroDefault: "",
  paymentTerms: "30% bij akkoord voor materiaalreservering, restant na installatie en oplevering.",
  homeBaseZipCode: "",
  travelPricingTiers: [
    { maxKm: 20, price: 35 },
    { maxKm: null, price: 65 },
  ],
  aiSystemPrompts: {
    BATTERY: `Je bent een technisch adviseur voor Koolhaas Installaties (Friesland). Schrijf een eerlijk, direct adviesdocument voor een thuisbatterij — geen verkoopverhaal. Analyseer de situatie van de klant, geef een onderbouwde productaanbeveling, bereken de terugverdientijd, en noem relevante subsidies (ISDE). Schrijf alsof Daan Koolhaas het zelf schrijft: technisch sterk, persoonlijk, en to the point. Schrijf in het Nederlands.`,
    EMS: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een eerlijk adviesdocument over Energie Management Systemen (EMS). Leg uit hoe het EMS de thuisbatterij, zonnepanelen en laadpaal slim coördineert. Geef een concrete aanbeveling op basis van de klantgegevens. Schrijf technisch maar begrijpelijk. Schrijf in het Nederlands.`,
    SOLAR: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een helder adviesdocument voor zonnepanelen. Bereken de opbrengst op basis van het jaarverbruik, geef een systeemaanbeveling (aantal panelen, omvormer), en bereken de terugverdientijd. Vermeld SDE++/saldering. Schrijf in het Nederlands.`,
    ELECTRICAL: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een technisch adviesdocument over de elektrische installatie / verdeelkast. Beschrijf de huidige situatie, de aanbevolen aanpassingen, en waarom deze noodzakelijk of toekomstbestendig zijn. Schrijf in het Nederlands.`,
    CAMERA: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een adviesdocument voor een camerasysteem. Beschrijf de situatie, aanbevolen cameraconfiguratie, en de meerwaarde voor de klant. Schrijf in het Nederlands.`,
    HEATPUMP: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een adviesdocument voor een warmtepompinstallatie. Bereken de energiebesparing ten opzichte van de huidige situatie, geef een productaanbeveling, en vermeld ISDE-subsidie. Schrijf in het Nederlands.`,
    quote_intro: `Schrijf namens Daan een korte, persoonlijke offerte-opening in het Nederlands. Sluit aan op de concrete situatie en aangeboden werkzaamheden. Schrijf nuchter, direct en zonder verkooppraat. Gebruik geen lange streeptekens of middelpunttekens.`,
    quote_outro: `Schrijf namens Daan een compacte afsluiting met exact de koppen Tot slot en Volgende stap. Herhaal het advies niet. Benoem alleen de concrete vervolgstap. Gebruik geen lange streeptekens of middelpunttekens.`,
  },
};

export function getBranding(slug: string, stored?: Partial<CompanyBranding>): CompanyBranding {
  const base = DEFAULT_BRANDING[slug] ?? DEFAULT_BRANDING.websup;
  const candidate = { ...base, ...stored };
  const color = (value: string, fallback: string) => /^#[\da-f]{6}$/i.test(value) ? value : fallback;
  const gradient = { ...base.gradient, ...stored?.gradient };
  const fonts = new Set(["Inter", "Nunito", "Sora", "Bricolage Grotesque", "Arial"]);
  const safeAsset = (value: string | undefined, fallback: string, folders: string[]) =>
    value && (value.startsWith("s3://") || folders.some((folder) => value.startsWith(folder))) ? value : fallback;
  const accentColor = color(candidate.accentColor, base.accentColor);
  const faviconUrl = slug === "koolhaas" && candidate.faviconUrl === "/icons/icon-192.png"
    ? base.faviconUrl
    : safeAsset(candidate.faviconUrl, base.faviconUrl, ["/icons/", "/logos/"]);
  return {
    ...candidate,
    primaryColor: color(candidate.primaryColor, base.primaryColor),
    // De WebsUp-standaardkleur is geen veilige fallback voor Koolhaas.
    accentColor: slug === "koolhaas" && accentColor.toLowerCase() === "#f97316"
      ? base.accentColor
      : accentColor,
    backgroundColor: color(candidate.backgroundColor, base.backgroundColor),
    textColor: color(candidate.textColor, base.textColor),
    font: fonts.has(candidate.font) ? candidate.font : base.font,
    gradient: {
      from: color(gradient.from, base.gradient.from),
      via: color(gradient.via, base.gradient.via),
      to: color(gradient.to, base.gradient.to),
      angle: Number.isFinite(gradient.angle) && gradient.angle >= 0 && gradient.angle <= 360 ? gradient.angle : base.gradient.angle,
      viaPosition: Number.isFinite(gradient.viaPosition) && gradient.viaPosition >= 1 && gradient.viaPosition <= 99 ? gradient.viaPosition : base.gradient.viaPosition,
    },
    logoUrl: safeAsset(candidate.logoUrl, base.logoUrl, ["/logos/"]),
    faviconUrl,
    tagline: typeof candidate.tagline === "string" ? candidate.tagline : base.tagline,
    personalName: typeof candidate.personalName === "string" ? candidate.personalName.slice(0, 100) : undefined,
    personalMessage: typeof candidate.personalMessage === "string" ? candidate.personalMessage.slice(0, 400) : undefined,
    personalWhatsapp: typeof candidate.personalWhatsapp === "string" ? candidate.personalWhatsapp.slice(0, 30) : undefined,
  };
}

export function cssVarsFromBranding(branding: CompanyBranding): Record<string, string> {
  return {
    "--color-primary": branding.primaryColor,
    "--color-accent": branding.accentColor,
    "--color-background": branding.backgroundColor,
    "--color-text": branding.textColor,
    "--brand-primary": branding.primaryColor,
    "--brand-accent": branding.accentColor,
    "--brand-background": branding.backgroundColor,
    "--brand-text": branding.textColor,
    "--brand-font": branding.font,
    "--brand-gradient": gradientCssFromBranding(branding),
  };
}

export function cssFontFromBranding(font: string): string {
  const family: Record<string, string> = {
    Inter: "var(--font-sans)",
    Nunito: "var(--font-body)",
    Sora: "var(--font-sora)",
    "Bricolage Grotesque": "var(--font-heading)",
    Arial: "Arial",
  };
  return `${family[font] ?? family.Inter}, system-ui, sans-serif`;
}

export function gradientCssFromBranding(branding: CompanyBranding): string {
  const { from, via, to, angle, viaPosition } = branding.gradient;
  return `linear-gradient(${angle}deg, ${from} 0%, ${via} ${viaPosition}%, ${to} 100%)`;
}

/** Iedere upload krijgt een unieke key, zodat de browser het nieuwe bestand laadt. */
export function brandAssetUrl(companyId: string, asset: "logo" | "favicon", value: string): string {
  if (!value.startsWith("s3://")) return value;
  const version = encodeURIComponent(value.split("/").at(-1) ?? "");
  return `/api/brand-assets/${companyId}/${asset}?v=${version}`;
}

/** De tekstkleur met het hoogste contrast voor een effen actieknop. */
export function readableBrandText(hex: string): string {
  const match = /^#([\da-f]{6})$/i.exec(hex);
  if (!match) return "#ffffff";
  const channels = [0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16) / 255);
  const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

/** Documenten krijgen hun eigen merkwaarden, los van de actieve werkplekthema's. */
export function portalVarsFromBranding(branding: CompanyBranding): Record<string, string> {
  return {
    "--portal-primary": branding.primaryColor,
    "--portal-accent": branding.accentColor,
    "--portal-background": branding.backgroundColor,
    "--portal-text": branding.textColor,
    "--portal-gradient": gradientCssFromBranding(branding),
    "--portal-accent-text": readableBrandText(branding.accentColor),
    "--brand-font": cssFontFromBranding(branding.font),
  };
}
