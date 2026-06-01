import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require("@react-pdf/renderer");
import { AdvicePDF } from "@/lib/pdf/advice-template";
import { createElement } from "react";
import { DEFAULT_BRANDING } from "@/lib/branding";

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

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify access via company
  if (doc.quote.companyId !== session.user.activeCompanyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const companySlug = doc.quote.company.slug;
  const branding = DEFAULT_BRANDING[companySlug] ?? DEFAULT_BRANDING.websup;

  const element = createElement(AdvicePDF, {
    companyName: doc.quote.company.name,
    companySlug,
    companyTagline: branding.tagline ?? "",
    customerName: doc.quote.customer.name,
    adviceType: doc.type,
    content: doc.content,
    createdAt: doc.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
  });

  const pdfBuffer: Buffer = await renderToBuffer(element);

  const filename = `advies-${doc.type.toLowerCase()}-${doc.quote.customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
