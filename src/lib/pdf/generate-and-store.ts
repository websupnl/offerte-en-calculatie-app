import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { renderPageAsPdf } from "./render-page-as-pdf";

export async function generateAndStorePdf(
  quoteId: string,
  host: string,
  cookie: string
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[PDF] BLOB_READ_WRITE_TOKEN not set — skipping PDF pre-generation");
    return null;
  }

  const proto = host.startsWith("localhost") ? "http" : "https";
  const printUrl = `${proto}://${host}/print/quotes/${quoteId}`;

  try {
    const pdfBuffer = await renderPageAsPdf(printUrl, cookie);
    if (!pdfBuffer) return null;

    const blob = await put(`pdfs/offerte-${quoteId}.pdf`, pdfBuffer, {
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
  host: string
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[PDF] BLOB_READ_WRITE_TOKEN not set — skipping portal PDF pre-generation");
    return null;
  }

  const proto = host.startsWith("localhost") ? "http" : "https";
  const printUrl = `${proto}://${host}/print/portal/${shareToken}`;

  try {
    const pdfBuffer = await renderPageAsPdf(printUrl);
    if (!pdfBuffer) return null;

    const blob = await put(`pdfs/portal-${shareToken}.pdf`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    await prisma.quoteShare.update({
      where: { token: shareToken },
      data: { portalPdfUrl: blob.url },
    });

    console.log(`[PDF] Portal PDF generated and stored: ${blob.url}`);
    return blob.url;
  } catch (err) {
    console.error("[PDF] Portal background generation failed:", err);
    return null;
  }
}
