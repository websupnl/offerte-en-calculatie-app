import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderPageAsPdf } from "@/lib/pdf/render-page-as-pdf";
import { pdfFilename } from "@/lib/pdf/filename";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { number: true, customer: { select: { name: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? req.nextUrl.origin;
  const pdf = await renderPageAsPdf(`${appUrl}/print/invoices/${id}`, req.headers.get("cookie") ?? "", ".inv-sheet");
  if (!pdf) return NextResponse.json({ error: "Factuur-PDF kon niet worden gemaakt" }, { status: 502 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename("Factuur", invoice.number, invoice.customer.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
