import { createHash } from "node:crypto";
import { getBranding, type CompanyBranding } from "@/lib/branding";

// Verhoog bij wijzigingen in het document: oude bestanden mogen niet blijven
// terugkomen wanneer de preview al een nieuw ontwerp of nieuwe branding toont.
const PDF_LAYOUT_VERSION = "v3-branding-photos";

export function quotePdfCachePath(
  kind: "offerte" | "portal",
  id: string,
  company: { slug: string; branding: unknown },
  revision: string,
) {
  const brand = getBranding(company.slug, company.branding as Partial<CompanyBranding>);
  const fingerprint = createHash("sha256").update(JSON.stringify(brand)).digest("hex").slice(0, 12);
  return `pdfs/${kind}-${id}-${PDF_LAYOUT_VERSION}-${fingerprint}-${revision}.pdf`;
}

export function isCurrentPdfCache(url: string | null, path: string): url is string {
  if (!url) return false;
  if (url.startsWith("s3://")) return url === `s3://${path}`;
  try {
    return decodeURIComponent(new URL(url).pathname).endsWith(`/${path}`);
  } catch {
    return false;
  }
}
