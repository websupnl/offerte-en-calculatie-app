import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";
import { renderPageAsPdf } from "@/lib/pdf/render-page-as-pdf";
// Fallback if Chromium not available
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePDF } from "@/lib/pdf/quote-template";
import { modulesToOptions } from "@/lib/quote-modules";
import { applyCalculationPricing } from "@/lib/quote-with-pricing";
import { formatDate } from "@/lib/format";
import { createElement } from "react";
import { getBranding } from "@/lib/branding";
import { getQuoteAttachmentStorageKey, resolveQuoteAttachmentImages, resolveChoiceGroupImages } from "@/lib/quote-attachments";
import { presignDownload, isStorageConfigured } from "@/lib/storage";
import { pdfFilename } from "@/lib/pdf/filename";
import { isCurrentPdfCache } from "@/lib/pdf/cache";
import { cachedPdfBuffer, pdfCacheState } from "@/lib/pdf/cache-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quoteCheck = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { pdfUrl: true, number: true, customer: { select: { name: true } }, company: { select: { slug: true, branding: true } } },
  });

  if (!quoteCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filename = pdfFilename("Offerte", quoteCheck.number || id, quoteCheck.customer?.name);

  // 1. Actuele opgeslagen PDF
  const cacheState = await pdfCacheState("offerte", id);
  if (cacheState && isCurrentPdfCache(cacheState.url, cacheState.path)) {
    const buffer = await cachedPdfBuffer(cacheState.url);
    if (buffer) {
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  }

  // 2. Render print page via headless Chromium (pixel-perfect match with preview)
  const host = req.headers.get("host") ?? "localhost:3001";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const cookie = req.headers.get("cookie") ?? "";
  const printUrl = `${proto}://${host}/print/quotes/${id}`;
  const pdfBuffer = await renderPageAsPdf(printUrl, cookie);

  if (pdfBuffer) {
    // Bewaar dezelfde render in MinIO of Blob na de response
    after(async () => { await generateAndStorePdf(id, host, cookie, pdfBuffer, cacheState?.path); });
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
          "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // 3. Fallback: @react-pdf/renderer (if Chromium not available)
  console.warn("[PDF] Chromium unavailable — falling back to react-pdf for admin PDF");
  const rawQuote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      modules: { orderBy: { sortOrder: "asc" } },
      calculations: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
      attachments: { orderBy: { sortOrder: "asc" } },
      company: true,
    },
  });

  if (!rawQuote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Nieuwe offertes halen prijs en artikelen uit hun calculaties.
  const quote = applyCalculationPricing(rawQuote);

  const attachments = await resolveQuoteAttachmentImages(quote.attachments, { expiresIn: 3600 });
  const resolvedChoiceGroups = await resolveChoiceGroupImages(
    (Array.isArray(quote.choiceGroups) ? quote.choiceGroups : []) as Array<{
      title: string;
      description?: string;
      choices: Array<{
        label?: string;
        title: string;
        summary?: string;
        image?: string | null;
        imageUrl?: string | null;
        items: Array<{ description: string; qty: number; unitPrice: number; indent?: number }>;
      }>;
    }>,
    { expiresIn: 3600 },
  );
  const companySlug = quote.company.slug;
  const storedBranding = (quote.company.branding ?? {}) as Record<string, string>;
  const branding = getBranding(companySlug, storedBranding);
  const logoKey = storedBranding.logoUrl ? getQuoteAttachmentStorageKey(storedBranding.logoUrl) : null;
  const customLogoUrl = logoKey && isStorageConfigured()
    ? await presignDownload(logoKey, 300)
    : branding.logoUrl;

  const element = createElement(QuotePDF, {
    companyName: quote.company.name,
    companySlug,
    companyTagline: branding.tagline,
    brandOverrides: {
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
      gradient: branding.gradient,
      backgroundColor: branding.backgroundColor,
      textColor: branding.textColor,
      // Laat de bestaande witte variant op de donkere WebsUp-cover staan als
      // er geen afwijkend logo is ingesteld.
      ...(storedBranding.logoUrl ? { logoUrl: customLogoUrl } : {}),
    },
    quoteNumber: quote.number ?? "CONCEPT",
    quoteDate: formatDate(quote.createdAt),
    validUntil: quote.validUntil ? formatDate(quote.validUntil) : undefined,
    customerName: quote.customer.name,
    customerEmail: quote.customer.email ?? undefined,
    customerPhone: quote.customer.phone ?? undefined,
    customerAddress: quote.customer.address ?? undefined,
    customerCity: quote.customer.city ?? undefined,
    customerZip: quote.customer.zipCode ?? undefined,
    title: quote.title ?? undefined,
    category: quote.category ?? undefined,
    tagline: quote.tagline ?? undefined,
    intro: quote.intro ?? undefined,
    outro: quote.outro ?? undefined,
    notes: quote.notes ?? undefined,
    flow: (quote.flow as Array<{ n: number; t: string; d: string }> | null) || [],
    approach: (quote.approach as Array<{ n: string; t: string; d: string }> | null) || [],
    options: quote.usesCalculations
      ? (quote.options as ReturnType<typeof modulesToOptions>)
      : modulesToOptions(quote.modules),
    selectedOptionIds: [],
    exclusions: (quote.exclusions as string[]) || [],
    choiceGroups: resolvedChoiceGroups.map((group) => ({
      title: group.title,
      description: group.description,
      choices: group.choices.map((choice) => ({
        label: choice.label,
        title: choice.title,
        summary: choice.summary,
        image: choice.imageUrl ?? choice.image ?? undefined,
        items: choice.items,
      })),
    })),
    technicalNotes: (quote.technicalNotes as string[] | null) || [],
    assumptions: (quote.assumptions as string[] | null) || [],
    planning: (quote.planning as { leadTime?: string; executionDuration?: string } | null) ?? undefined,
    commercial: (quote.commercial as { paymentTerms?: string; warranty?: string; priceDisplayMode?: "incl" | "excl" } | null) ?? undefined,
    attachments: attachments.map((a) => ({
      title: a.title ?? undefined,
      imageUrl: a.imageUrl,
      liveUrl: a.liveUrl ?? undefined,
      caption: a.caption ?? undefined,
      section: a.section ?? undefined,
    })),
    itemsHeader: quote.itemsHeader || "Onderdelen",
    status: quote.status,
    items: quote.items.filter((i) => !i.hiddenOnQuote).map((i) => ({
      description: i.description,
      qty: Number(i.qty),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    totalExVat: Number(quote.totalExVat),
    totalVat: Number(quote.totalVat),
    totalIncVat: Number(quote.totalIncVat),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallbackBuffer: Buffer = await renderToBuffer(element as any);
  after(async () => { await generateAndStorePdf(id, host, cookie, fallbackBuffer, cacheState?.path); });
  return new NextResponse(new Uint8Array(fallbackBuffer), {
    headers: {
      "Content-Type": "application/pdf",
          "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
