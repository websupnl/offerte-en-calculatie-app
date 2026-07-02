import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { AdvicePDF } from "@/lib/pdf/advice-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createElement } from "react";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { pdfFilename } from "@/lib/pdf/filename";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const doc = await prisma.adviceDocument.findFirst({
    where: { id },
    include: {
      quote: {
        include: {
          customer: true,
          company: true,
        },
      },
    },
  });

  if (!doc?.quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify access via company
  if (doc.quote.companyId !== session.user.activeCompanyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const companySlug = doc.quote.company.slug ?? "websup";
  const branding = DEFAULT_BRANDING[companySlug] ?? DEFAULT_BRANDING.websup;

  const element = createElement(AdvicePDF, {
    companyName: doc.quote.company.name,
    companySlug,
    companyTagline: branding.tagline ?? "",
    customerName: doc.quote.customer.name,
    adviceType: doc.type,
    content: doc.content ?? "",
    createdAt: doc.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer: Buffer = await renderToBuffer(element as any);

  const filename = pdfFilename("Advies", doc.type, doc.quote.customer.name);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
