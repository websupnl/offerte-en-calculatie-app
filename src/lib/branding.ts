export type CompanyBranding = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl?: string;
  font: string;
  tagline?: string;
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
};

export const DEFAULT_BRANDING: Record<string, CompanyBranding> = {
  websup: {
    primaryColor: "#0F172A",
    accentColor: "#6366F1",
    backgroundColor: "#F8FAFC",
    textColor: "#0F172A",
    font: "Inter",
    tagline: "Websites, apps & systemen die groeien",
  },
  koolhaas: {
    primaryColor: "#0E2344",
    accentColor: "#1F9BA3",
    backgroundColor: "#F4F8F8",
    textColor: "#0E2344",
    logoUrl: "/logos/koolhaas-logo.png",
    font: "Sora",
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
  return { ...base, ...stored };
}

export function cssVarsFromBranding(branding: CompanyBranding): Record<string, string> {
  return {
    "--color-primary": branding.primaryColor,
    "--color-accent": branding.accentColor,
    "--color-background": branding.backgroundColor,
    "--color-text": branding.textColor,
  };
}
