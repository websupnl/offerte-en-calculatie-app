import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { downloadObject, isStorageConfigured, uploadObject } from "@/lib/storage";
import { put } from "@vercel/blob";
import { quotePdfCachePath } from "./cache";

/** Fingerprint van alle documentbronnen, onafhankelijk van cachewrites en views. */
export async function pdfCacheState(kind: "offerte" | "portal", id: string) {
  const quote = await prisma.quote.findFirst({
    where: kind === "offerte" ? { id } : { share: { token: id } },
    include: {
      company: true, customer: true,
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      modules: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      contentBlocks: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      attachments: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      calculations: { where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
      documents: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { productDocument: true } },
      share: true,
    },
  });
  if (!quote) return null;
  const source = { ...quote, share: kind === "portal" ? quote.share : null };
  const content = JSON.stringify(source, (key, value) =>
    ["pdfUrl", "portalPdfUrl", "updatedAt", "viewedAt", "lastViewedAt", "viewCount"].includes(key) ? undefined : value);
  const revision = createHash("sha256").update(content).digest("hex").slice(0, 24);
  return { quoteId: quote.id, companyId: quote.companyId, shareToken: quote.share?.token,
    path: quotePdfCachePath(kind, id, quote.company, revision),
    url: kind === "offerte" ? quote.pdfUrl : quote.share?.portalPdfUrl ?? null };
}

export async function cachedPdfBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("s3://pdfs/")) return await downloadObject(url.slice(5));
    if (!url.startsWith("https://")) return null;
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  } catch { return null; }
}

export async function storePdfBuffer(path: string, buffer: Buffer): Promise<string | null> {
  if (isStorageConfigured()) {
    await uploadObject(path, buffer, "application/pdf");
    return `s3://${path}`;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const blob = await put(path, buffer, { access: "public", contentType: "application/pdf", addRandomSuffix: false });
  return blob.url;
}
