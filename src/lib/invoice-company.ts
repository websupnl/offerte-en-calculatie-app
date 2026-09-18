/**
 * Wat er van jouw kant op een factuur moet staan: handelsnaam, adres, KvK,
 * btw-id en IBAN. Adres, btw-id en IBAN zijn wettelijk verplicht (of nodig om
 * betaald te worden) en staan in `Company.settings.invoice`, aan te passen via
 * Instellingen. De huisstijl per bedrijf staat hier vast, net als in de offerte.
 *
 * Geen server-imports: de instellingenpagina gebruikt dit ook in de browser.
 */

export type InvoiceSettings = {
  ownerName: string;
  address: string;
  zipCode: string;
  city: string;
  kvk: string;
  vatNumber: string;
  iban: string;
  accountName: string;
  paymentTermDays: number;
};

export type InvoiceBrand = {
  key: "websup" | "koolhaas";
  tradeName: string;
  logo: string;
  logoHeight: number;
  miniLogoHeight: number;
  email: string;
  phone: string;
  website: string;
  /** Aanspreekvorm: WebsUp tutoyeert, Koolhaas niet. */
  informal: boolean;
  colors: {
    strip: string;
    accentText: string;
    payBg: string;
    dot: string;
  };
  headingFont: "bricolage" | "sora";
};

const BRANDS: Record<InvoiceBrand["key"], InvoiceBrand> = {
  websup: {
    key: "websup",
    tradeName: "WebsUp.nl",
    logo: "/logos/websup-wordmark-black.png",
    logoHeight: 68,
    miniLogoHeight: 46,
    email: "info@websup.nl",
    phone: "06 82 20 21 48",
    website: "websup.nl",
    informal: true,
    colors: {
      strip: "linear-gradient(135deg, #f97316 0%, #ec4899 50%, #a78bfa 100%)",
      accentText: "#be185d",
      payBg: "#06040c",
      dot: "#f97316",
    },
    headingFont: "bricolage",
  },
  koolhaas: {
    key: "koolhaas",
    tradeName: "Koolhaas Installaties",
    logo: "/logos/koolhaas-logo-tight.png",
    logoHeight: 52,
    miniLogoHeight: 36,
    email: "info@koolhaasinstallaties.nl",
    phone: "06 82 20 21 48",
    website: "koolhaasinstallaties.nl",
    informal: false,
    colors: {
      strip: "#1f9ba3",
      accentText: "#17777d",
      payBg: "#0c1f3d",
      dot: "#5bbfa0",
    },
    headingFont: "sora",
  },
};

export function getInvoiceBrand(slug: string): InvoiceBrand {
  return slug === "koolhaas" ? BRANDS.koolhaas : BRANDS.websup;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  ownerName: "Daan Koolhaas",
  address: "",
  zipCode: "",
  city: "",
  kvk: "95524061",
  vatNumber: "",
  iban: "",
  accountName: "",
  paymentTermDays: 14,
};

/** Leest `settings.invoice` en vult ontbrekende velden aan met de standaard. */
export function readInvoiceSettings(settings: unknown): InvoiceSettings {
  const raw = (settings && typeof settings === "object" ? (settings as Record<string, unknown>).invoice : null) ?? {};
  const r = raw as Partial<Record<keyof InvoiceSettings, unknown>>;
  const str = (k: keyof InvoiceSettings) =>
    typeof r[k] === "string" ? (r[k] as string).trim() : (DEFAULT_INVOICE_SETTINGS[k] as string);
  const days = Number(r.paymentTermDays);
  return {
    ownerName: str("ownerName"),
    address: str("address"),
    zipCode: str("zipCode"),
    city: str("city"),
    kvk: str("kvk"),
    vatNumber: str("vatNumber"),
    iban: str("iban"),
    accountName: str("accountName"),
    paymentTermDays: Number.isFinite(days) && days > 0 ? Math.round(days) : DEFAULT_INVOICE_SETTINGS.paymentTermDays,
  };
}

const REQUIRED: { key: keyof InvoiceSettings; label: string }[] = [
  { key: "address", label: "adres" },
  { key: "zipCode", label: "postcode" },
  { key: "city", label: "plaats" },
  { key: "kvk", label: "KvK-nummer" },
  { key: "vatNumber", label: "btw-id" },
  { key: "iban", label: "IBAN" },
];

/** Welke verplichte gegevens nog leeg zijn, als leesbare labels. */
export function missingInvoiceSettings(s: InvoiceSettings): string[] {
  return REQUIRED.filter(({ key }) => !String(s[key] ?? "").trim()).map(({ label }) => label);
}

/** "NL91ABNA0417164300" -> "NL91 ABNA 0417 1643 00" */
export function formatIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}
