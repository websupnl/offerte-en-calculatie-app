import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { renderPageAsPdf } from "./render-page-as-pdf";
import { quotePdfCachePath } from "./cache";

export async function generateAndStorePdf(
  quoteId: string,
  host: string,
  cookie: string,
  renderedBuffer?: Buffer,
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[PDF] BLOB_READ_WRITE_TOKEN not set — skipping PDF pre-generation");
    return null;
  }

  const proto = host.startsWith("localhost") ? "http" : "https";
  const printUrl = `${proto}://${host}/print/quotes/${quoteId}`;

  try {
    const pdfBuffer = renderedBuffer ?? await renderPageAsPdf(printUrl, cookie);
    if (!pdfBuffer) return null;

    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { company: { select: { slug: true, branding: true } } } });
    if (!quote) return null;
    const blob = await put(quotePdfCachePath("offerte", quoteId, quote.company), pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    await prisma.quote.update({
      where: { id: quoteId },
      data: { pdfUrl: blob.url },
    });

    console.log(`[PDF] Generated and stored: ${blob.url}`);
    return blob.url;
  } catch (err) {
    console.error("[PDF] Background generation failed:", err);
    return null;
  }
}

export async function generateAndStorePortalPdf(
  shareToken: string,
  host: string,
  renderedBuffer?: Buffer,
): Promise<string | null> {
  const result = await generatePortalPdfWithBuffer(shareToken, host, renderedBuffer);
  return result?.url ?? null;
}

// Zelfde als generateAndStorePortalPdf, maar geeft ook de ruwe buffer terug
// zodat de PDF direct als e-mailbijlage meegestuurd kan worden.
export async function generatePortalPdfWithBuffer(
  shareToken: string,
  host: string,
  renderedBuffer?: Buffer,
): Promise<{ url?: string; buffer: Buffer } | null> {

  const proto = host.startsWith("localhost") ? "http" : "https";
  const printUrl = `${proto}://${host}/print/portal/${shareToken}`;

  const pdfBuffer = renderedBuffer ?? await renderPageAsPdf(printUrl);
  if (!pdfBuffer) return null;

  // De bijlage moet niet afhankelijk zijn van de optionele Blob-cache. Als het
  // opslaan faalt, kan de zojuist gerenderde PDF nog altijd worden gemaild.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[PDF] BLOB_READ_WRITE_TOKEN not set — PDF is not cached");
    return { buffer: pdfBuffer };
  }

  try {
    const share = await prisma.quoteShare.findUnique({ where: { token: shareToken }, select: { quote: { select: { company: { select: { slug: true, branding: true } } } } } });
    if (!share) return { buffer: pdfBuffer };
    const blob = await put(quotePdfCachePath("portal", shareToken, share.quote.company), pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    await prisma.quoteShare.update({
      where: { token: shareToken },
      data: { portalPdfUrl: blob.url },
    });

    console.log(`[PDF] Portal PDF generated and stored: ${blob.url}`);
    return { url: blob.url, buffer: pdfBuffer };
  } catch (err) {
    console.error("[PDF] Portal PDF could not be cached; continuing with the generated PDF:", err);
    return { buffer: pdfBuffer };
  }
}
