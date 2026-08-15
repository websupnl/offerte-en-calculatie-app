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

export function formatDateLong(date: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return "onbekend";
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "vandaag";
  if (days === 1) return "gisteren";
  if (days < 14) return `${days} dagen geleden`;
  if (days < 60) return `${Math.floor(days / 7)} weken geleden`;
  return formatDate(d);
}

export function generateQuoteNumber(companySlug: string, count: number): string {
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}

export function generateProjectNumber(companySlug: string, count: number): string {
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-P${String(count).padStart(3, "0")}`;
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In uitvoering",
  DONE: "Afgerond",
  ARCHIVED: "Gearchiveerd",
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  OPEN: "secondary",
  IN_PROGRESS: "default",
  DONE: "default",
  ARCHIVED: "secondary",
};

export const PROJECT_FILE_CATEGORIES = [
  "OFFERTE",
  "WERKBON",
  "FACTUUR",
  "FOTO",
  "OVERIG",
] as const;

export function generateWorkOrderNumber(companySlug: string, count: number): string {
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-W${String(count).padStart(3, "0")}`;
}

export const WORKORDER_STATUS_LABELS: Record<string, string> = {
  CONCEPT: "Concept",
  GEPLAND: "Gepland",
  UITGEVOERD: "Uitgevoerd",
  GEFACTUREERD: "Gefactureerd",
};

export const WORKORDER_STATUS_COLORS: Record<string, string> = {
  CONCEPT: "secondary",
  GEPLAND: "default",
  UITGEVOERD: "default",
  GEFACTUREERD: "default",
};

export const WORKORDER_LINE_TYPES = ["MATERIAAL", "ARBEID"] as const;

export function generateInvoiceNumber(companySlug: string, count: number): string {
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-F${String(count).padStart(3, "0")}`;
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  CONCEPT: "Concept",
  VERZONDEN: "Verzonden",
  BETAALD: "Betaald",
  VERVALLEN: "Vervallen",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  CONCEPT: "secondary",
  VERZONDEN: "default",
  BETAALD: "default",
  VERVALLEN: "destructive",
};

export const PURCHASE_STATUS_LABELS: Record<string, string> = {
  ONTVANGEN: "Ontvangen",
  GEBOEKT: "Geboekt",
  BETAALD: "Betaald",
};

export const PURCHASE_STATUS_COLORS: Record<string, string> = {
  ONTVANGEN: "secondary",
  GEBOEKT: "default",
  BETAALD: "default",
};

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

export function generateCalculationNumber(companySlug: string, count: number): string {
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-C${String(count).padStart(3, "0")}`;
}

export const CALCULATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  COMPLETED: "Afgerond",
  QUOTED: "Omgezet naar offerte",
};

export const CALCULATION_STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary",
  COMPLETED: "default",
  QUOTED: "default",
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

export const SUPPLIERS = [
  "Oosterberg",
  "Rexel",
  "ESTG",
  "4Blue",
  "Elektramat",
  "Technim",
] as const;

export function generateContractNumber(companySlug: string, count: number): string {
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-C${String(count).padStart(3, "0")}`;
}

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  CONCEPT: "Concept",
  VERZONDEN: "Verzonden",
  GETEKEND: "Getekend",
  ACTIEF: "Actief",
  OPGEZEGD: "Opgezegd",
  VERLOPEN: "Verlopen",
};

export const CONTRACT_STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONCEPT: "secondary",
  VERZONDEN: "outline",
  GETEKEND: "default",
  ACTIEF: "default",
  OPGEZEGD: "destructive",
  VERLOPEN: "secondary",
};

export const CONTRACT_PERIOD_LABELS: Record<string, string> = {
  MONTH: "per maand",
  QUARTER: "per kwartaal",
  YEAR: "per jaar",
};
