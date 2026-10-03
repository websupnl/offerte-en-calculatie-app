export type LegalProfile = {
  slug: "websup" | "koolhaas";
  naam: string;
  eigenaar: string;
  adres: string;
  kvk: string;
  btw: string;
  email: string;
  telefoon: string;
  website: string;
  rechtbank: string;
};

const GEDEELD = {
  eigenaar: "Daan Koolhaas",
  adres: "Gysbert Japiksstrjitte 38, 9145 RW Ternaard",
  kvk: "95524061",
  btw: "NL005158281B35",
  telefoon: "06 82 20 21 48",
  rechtbank: "de rechtbank Noord-Nederland, locatie Leeuwarden",
} as const;

export const LEGAL_PROFILES: Record<LegalProfile["slug"], LegalProfile> = {
  websup: {
    slug: "websup",
    naam: "WebsUp.nl",
    email: "info@websup.nl",
    website: "websup.nl",
    ...GEDEELD,
  },
  koolhaas: {
    slug: "koolhaas",
    naam: "Koolhaas Installaties",
    email: "info@koolhaasinstallaties.nl",
    website: "koolhaasinstallaties.nl",
    ...GEDEELD,
  },
};

export function getLegalProfile(slug: string): LegalProfile | null {
  return slug === "websup" || slug === "koolhaas" ? LEGAL_PROFILES[slug] : null;
}
