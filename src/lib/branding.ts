export type CompanyBranding = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl?: string;
  font: string;
  tagline?: string;
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
    primaryColor: "#0F2818",
    accentColor: "#16A34A",
    backgroundColor: "#F0FDF4",
    textColor: "#0F2818",
    font: "Inter",
    tagline: "Persoonlijk · Technisch sterk · Friesland",
  },
};

export const DEFAULT_SETTINGS: CompanySettings = {
  defaultVatRate: 21,
  quoteValidDays: 30,
  quoteIntroDefault:
    "Hartelijk dank voor uw interesse. Hierbij ontvangt u onze offerte.",
  quoteOutroDefault:
    "Wij hopen u hiermee een passend aanbod te hebben gedaan. Neem gerust contact op voor vragen.",
  paymentTerms: "Betaling binnen 14 dagen na factuurdatum.",
  aiSystemPrompts: {
    BATTERY: `Je bent een technisch adviseur voor Koolhaas Installaties (Friesland). Schrijf een eerlijk, direct adviesdocument voor een thuisbatterij — geen verkoopverhaal. Analyseer de situatie van de klant, geef een onderbouwde productaanbeveling, bereken de terugverdientijd, en noem relevante subsidies (ISDE). Schrijf alsof Daan Koolhaas het zelf schrijft: technisch sterk, persoonlijk, en to the point. Schrijf in het Nederlands.`,
    EMS: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een eerlijk adviesdocument over Energie Management Systemen (EMS). Leg uit hoe het EMS de thuisbatterij, zonnepanelen en laadpaal slim coördineert. Geef een concrete aanbeveling op basis van de klantgegevens. Schrijf technisch maar begrijpelijk. Schrijf in het Nederlands.`,
    SOLAR: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een helder adviesdocument voor zonnepanelen. Bereken de opbrengst op basis van het jaarverbruik, geef een systeemaanbeveling (aantal panelen, omvormer), en bereken de terugverdientijd. Vermeld SDE++/saldering. Schrijf in het Nederlands.`,
    ELECTRICAL: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een technisch adviesdocument over de elektrische installatie / verdeelkast. Beschrijf de huidige situatie, de aanbevolen aanpassingen, en waarom deze noodzakelijk of toekomstbestendig zijn. Schrijf in het Nederlands.`,
    CAMERA: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een adviesdocument voor een camerasysteem. Beschrijf de situatie, aanbevolen cameraconfiguratie, en de meerwaarde voor de klant. Schrijf in het Nederlands.`,
    HEATPUMP: `Je bent een technisch adviseur voor Koolhaas Installaties. Schrijf een adviesdocument voor een warmtepompinstallatie. Bereken de energiebesparing ten opzichte van de huidige situatie, geef een productaanbeveling, en vermeld ISDE-subsidie. Schrijf in het Nederlands.`,
    quote_intro: `Je bent een professionele copywriter. Schrijf een korte, vriendelijke openingstekst voor een offerte. Gebruik de bedrijfsnaam, klantnaam en de diensten in de offerte. Maximaal 3 zinnen. Schrijf in het Nederlands.`,
    quote_outro: `Je bent een professionele copywriter. Schrijf een korte afsluittekst voor een offerte met een call-to-action. Maximaal 2 zinnen. Schrijf in het Nederlands.`,
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
