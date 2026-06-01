export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(Number(amount));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function generateQuoteNumber(companySlug: string, count: number): string {
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verstuurd",
  VIEWED: "Bekeken",
  ACCEPTED: "Geaccepteerd",
  DECLINED: "Afgewezen",
  EXPIRED: "Verlopen",
};

export const QUOTE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary",
  SENT: "default",
  VIEWED: "default",
  ACCEPTED: "default",
  DECLINED: "destructive",
  EXPIRED: "secondary",
};

export const KOOLHAAS_CATEGORIES = [
  "Thuisbatterij",
  "EMS & Energiemanagement",
  "Verdeelkast & Elektra",
  "Camera's & Advies",
  "Zonnepanelen",
  "Overig",
] as const;

export const WEBSUP_CATEGORIES = [
  "Website / Webdesign",
  "Webshop",
  "SEO & Marketing",
  "Hosting & Onderhoud",
  "Maatwerk Module",
  "Overig",
] as const;
