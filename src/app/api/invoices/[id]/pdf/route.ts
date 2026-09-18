import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderPageAsPdf } from "@/lib/pdf/render-page-as-pdf";
import { pdfFilename } from "@/lib/pdf/filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Factuur als PDF: de printpagina door headless Chromium, net als de offerte.
 * Geen react-pdf-terugval: de factuur bestaat maar in één opmaak, en een
 * afwijkende PDF naar een klant is erger dan een foutmelding hier.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { number: true, customer: { select: { name: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const host = req.headers.get("host") ?? "localhost:3001";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const variant = req.nextUrl.searchParams.get("variant");
  const printUrl = `${proto}://${host}/print/invoices/${id}${variant ? `?variant=${encodeURIComponent(variant)}` : ""}`;

  const pdf = await renderPageAsPdf(printUrl, req.headers.get("cookie") ?? "", {
    waitForSelector: "html[data-invoice-ready='1']",
  });
  if (!pdf) {
    return NextResponse.json({ error: "PDF maken mislukt, probeer het opnieuw." }, { status: 502 });
  }

  const filename = pdfFilename("Factuur", invoice.number, invoice.customer.name);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
