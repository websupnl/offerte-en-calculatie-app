import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderPageAsPdf } from "@/lib/pdf/render-page-as-pdf";
import { generateAndStorePortalPdf } from "@/lib/pdf/generate-and-store";
// Fallback if Chromium not available
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePDF } from "@/lib/pdf/quote-template";
import { formatDate } from "@/lib/format";
import { createElement } from "react";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { resolveQuoteAttachmentImages } from "@/lib/quote-attachments";
import { pdfFilename } from "@/lib/pdf/filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const share = await prisma.quoteShare.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          customer: true,
          items: { orderBy: { sortOrder: "asc" } },
          attachments: { orderBy: { sortOrder: "asc" } },
          company: true,
        },
      },
    },
  });

  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quote = share.quote;
  const filename = pdfFilename("Offerte", quote.number || token, quote.customer?.name);
  const host = req.headers.get("host") ?? "localhost:3001";

  // 1. Serve from cache if available
  if (share.portalPdfUrl) {
    const res = await fetch(share.portalPdfUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  }

  // 2. Render via headless Chromium
  const proto = host.startsWith("localhost") ? "http" : "https";
  const printUrl = `${proto}://${host}/print/portal/${token}`;
  const pdfBuffer = await renderPageAsPdf(printUrl);

  if (pdfBuffer) {
    // Cache for next request
    after(async () => {
      await generateAndStorePortalPdf(token, host);
    });
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // Fallback: @react-pdf/renderer (if Chromium not available)
  console.warn("[PDF] Chromium unavailable — falling back to react-pdf for portal PDF");
  const attachments = await resolveQuoteAttachmentImages(quote.attachments, { expiresIn: 21600 });
  const companySlug = quote.company.slug;
  const branding = DEFAULT_BRANDING[companySlug] ?? DEFAULT_BRANDING.websup;
  const snapshot = share.acceptanceSnapshot as {
    baseItems?: Array<{ description: string; qty: number; unitPrice: number; total: number }>;
    selectedChoices?: Array<{ choice: { title: string; items: Array<{ description: string; qty: number; unitPrice: number }> } }>;
    selectedOptions?: Array<{ t: string; price: number }>;
    totals?: { totalExVat: number; totalVat: number; totalIncVat: number };
  } | null;
  const snapshotItems = snapshot
    ? [
        ...(snapshot.baseItems ?? []),
        ...(snapshot.selectedChoices ?? []).flatMap(({ choice }) =>
          choice.items.map((item) => ({
            ...item,
            description: `${choice.title} · ${item.description}`,
            total: Number(item.qty) * Number(item.unitPrice),
          }))
        ),
        ...(snapshot.selectedOptions ?? []).map((option) => ({
          description: option.price == null
            ? `Optioneel meerwerk · ${option.t} (prijs op aanvraag)`
            : `Optioneel meerwerk · ${option.t}`,
          qty: 1,
          unitPrice: option.price ?? 0,
          total: option.price ?? 0,
        })),
      ]
    : null;

  const element = createElement(QuotePDF, {
    companyName: quote.company.name,
    companySlug,
    companyTagline: branding.tagline,
    quoteNumber: quote.number,
    quoteDate: formatDate(quote.createdAt),
    validUntil: quote.validUntil ? formatDate(quote.validUntil) : undefined,
    customerName: quote.customer.name,
    customerEmail: quote.customer.email ?? undefined,
    customerPhone: quote.customer.phone ?? undefined,
    customerAddress: quote.customer.address ?? undefined,
    customerCity: quote.customer.city ?? undefined,
    title: quote.title ?? undefined,
    category: quote.category ?? undefined,
    tagline: quote.tagline ?? undefined,
    intro: quote.intro ?? undefined,
    outro: quote.outro ?? undefined,
    notes: quote.notes ?? undefined,
    flow: (quote.flow as Array<{ n: number; t: string; d: string }> | null) || [],
    approach: (quote.approach as Array<{ n: string; t: string; d: string }> | null) || [],
    options: (quote.options as Array<{ id?: string; t: string; d: string; tag: string; price?: number | null; vatRate?: number }> | null) || [],
    selectedOptionIds: (share.selectedOptionIds as string[] | null) ?? [],
    signerName: share.signerName ?? undefined,
    exclusions: (quote.exclusions as string[]) || [],
    choiceGroups: (quote.choiceGroups as Array<{ title: string; description?: string; choices: Array<{ label?: string; title: string; summary?: string; items: Array<{ description: string; qty: number; unitPrice: number; indent?: number }> }> }> | null) || [],
    technicalNotes: (quote.technicalNotes as string[] | null) || [],
    assumptions: (quote.assumptions as string[] | null) || [],
    planning: (quote.planning as { leadTime?: string; executionDuration?: string } | null) ?? undefined,
    commercial: (quote.commercial as { paymentTerms?: string; warranty?: string; priceDisplayMode?: "incl" | "excl" } | null) ?? undefined,
    attachments: attachments.map((a) => ({
      title: a.title ?? undefined,
      imageUrl: a.imageUrl,
      liveUrl: a.liveUrl ?? undefined,
      caption: a.caption ?? undefined,
    })),
    itemsHeader: quote.itemsHeader || "Onderdelen",
    status: quote.status,
    acceptedAt: share.acceptedAt ? formatDate(share.acceptedAt) : undefined,
    items: (snapshotItems ?? quote.items).map((i) => ({
      description: i.description,
      qty: Number(i.qty),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    totalExVat: Number(snapshot?.totals?.totalExVat ?? quote.totalExVat),
    totalVat: Number(snapshot?.totals?.totalVat ?? quote.totalVat),
    totalIncVat: Number(snapshot?.totals?.totalIncVat ?? quote.totalIncVat),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallbackBuffer: Buffer = await renderToBuffer(element as any);
  return new NextResponse(new Uint8Array(fallbackBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
