import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Check for pre-generated PDF first
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { pdfUrl: true, number: true },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quote.pdfUrl) {
    // Serve the cached PDF as a download
    const res = await fetch(quote.pdfUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="offerte-${quote.number || id}.pdf"`,
        },
      });
    }
  }

  // Fall back: generate on-demand and store
  const host = req.headers.get("host") ?? "localhost:3000";
  const cookie = req.headers.get("cookie") ?? "";
  const url = await generateAndStorePdf(id, host, cookie);

  if (!url) {
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="offerte-${quote.number || id}.pdf"`,
    },
  });
}
