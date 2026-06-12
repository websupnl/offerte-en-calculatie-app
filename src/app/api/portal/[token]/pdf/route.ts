import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePDF } from "@/lib/pdf/quote-template";
import { formatDate } from "@/lib/format";
import { createElement } from "react";
import { DEFAULT_BRANDING } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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
  const companySlug = quote.company.slug;
  const branding = DEFAULT_BRANDING[companySlug] ?? DEFAULT_BRANDING.websup;

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
    intro: quote.intro ?? undefined,
    outro: quote.outro ?? undefined,
    notes: quote.notes ?? undefined,
    flow: (quote.flow as any[]) || [],
    approach: (quote.approach as any[]) || [],
    options: (quote.options as any[]) || [],
    exclusions: (quote.exclusions as string[]) || [],
    attachments: quote.attachments.map((attachment) => ({
      title: attachment.title ?? undefined,
      imageUrl: attachment.imageUrl,
      caption: attachment.caption ?? undefined,
    })),
    itemsHeader: quote.itemsHeader || "Onderdelen",
    status: quote.status,
    acceptedAt: share.acceptedAt ? formatDate(share.acceptedAt) : undefined,
    items: quote.items.map((i) => ({
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
  const pdfBuffer: Buffer = await renderToBuffer(element as any);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.number}.pdf"`,
    },
  });
}
