import { prisma } from "@/lib/prisma";
import { renderPageAsPdf } from "./render-page-as-pdf";
import { isCurrentPdfCache } from "./cache";
import { cachedPdfBuffer, pdfCacheState, storePdfBuffer } from "./cache-state";

const pending = new Map<string, Promise<{ url?: string; buffer: Buffer } | null>>();

async function generate(kind: "offerte" | "portal", id: string, host: string, cookie = "", renderedBuffer?: Buffer, expectedPath?: string) {
  const before = await pdfCacheState(kind, id);
  if (!before || (expectedPath && before.path !== expectedPath)) return null;
  if (isCurrentPdfCache(before.url, before.path)) {
    const buffer = await cachedPdfBuffer(before.url);
    if (buffer) return { url: before.url, buffer };
  }
  const active = pending.get(before.path);
  if (active) return active;
  const work = (async () => {
    const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
    const buffer = renderedBuffer ?? await renderPageAsPdf(`${proto}://${host}/print/${kind === "portal" ? "portal" : "quotes"}/${id}`, cookie);
    if (!buffer) return null;
    try {
      const current = await pdfCacheState(kind, id);
      if (current?.path !== before.path) return { buffer };
      const url = await storePdfBuffer(before.path, buffer);
      // Een late render mag nooit als een nieuwere documentversie worden opgeslagen.
      if (url && (await pdfCacheState(kind, id))?.path === before.path) {
        if (kind === "portal") await prisma.quoteShare.update({ where: { token: id }, data: { portalPdfUrl: url } });
        else await prisma.quote.update({ where: { id }, data: { pdfUrl: url } });
        return { url, buffer };
      }
    } catch (error) { console.error("[PDF] Opslaan mislukt; gerenderde PDF blijft beschikbaar", error); }
    return { buffer };
  })();
  pending.set(before.path, work);
  try { return await work; } finally { pending.delete(before.path); }
}

export async function generateAndStorePdf(quoteId: string, host: string, cookie: string, renderedBuffer?: Buffer, expectedPath?: string): Promise<string | null> {
  try {
    const result = await generate("offerte", quoteId, host, cookie, renderedBuffer, expectedPath);
    const state = await pdfCacheState("offerte", quoteId);
    if (state?.shareToken) await generateAndStorePortalPdf(state.shareToken, host);
    return result?.url ?? null;
  } catch (error) { console.error("[PDF] Achtergrondgeneratie mislukt", error); return null; }
}

export async function generateAndStorePortalPdf(shareToken: string, host: string, renderedBuffer?: Buffer, expectedPath?: string): Promise<string | null> {
  const result = await generatePortalPdfWithBuffer(shareToken, host, renderedBuffer, expectedPath);
  return result?.url ?? null;
}

export async function generatePortalPdfWithBuffer(shareToken: string, host: string, renderedBuffer?: Buffer, expectedPath?: string): Promise<{ url?: string; buffer: Buffer } | null> {
  try { return await generate("portal", shareToken, host, "", renderedBuffer, expectedPath); }
  catch (error) { console.error("[PDF] Portaalgeneratie mislukt", error); return null; }
}
