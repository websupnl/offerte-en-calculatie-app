import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePDF } from "@/lib/pdf/quote-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { formatDate } from "@/lib/format";
import { createElement } from "react";
import { DEFAULT_BRANDING } from "@/lib/branding";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      company: true,
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    customerAddress: quote.customer.address ?? undefined,
    customerCity: quote.customer.city ?? undefined,
    intro: quote.intro ?? undefined,
    outro: quote.outro ?? undefined,
    items: quote.items.map((i: { description: string; qty: unknown; unitPrice: unknown; total: unknown }) => ({
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
