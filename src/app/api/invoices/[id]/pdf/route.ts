import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderPageAsPdf } from "@/lib/pdf/render-page-as-pdf";
import { pdfFilename } from "@/lib/pdf/filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId },
    select: { number: true, customer: { select: { name: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });

  const origin = req.nextUrl.origin;
  const pdf = await renderPageAsPdf(
    `${origin}/print/invoices/${encodeURIComponent(id)}`,
    req.headers.get("cookie") ?? "",
    ".inv-sheet",
  );
  if (!pdf) return NextResponse.json({ error: "Factuur-PDF kon niet worden gemaakt" }, { status: 502 });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename("Factuur", invoice.number, invoice.customer?.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
