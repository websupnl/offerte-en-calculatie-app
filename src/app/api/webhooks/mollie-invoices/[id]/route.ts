import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceAmountMatches, invoiceMollieKey, mollieInvoiceRequest } from "@/lib/mollie-invoices";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    include: { company: { select: { slug: true } } },
  });
  if (!invoice?.molliePaymentLinkId || !invoice.molliePaymentMode) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }
  // Legacy Mollie-webhooks bevatten een payment-ID. De webhook zelf is geen
  // bewijs van betaling: haal de bij deze factuur opgeslagen link op bij Mollie.
  const payload = await req.text();
  if (payload.length > 4096) return NextResponse.json({ error: "Payload te groot" }, { status: 413 });
  const key = invoiceMollieKey(invoice.company.slug);
  if (!key) return NextResponse.json({ error: "Mollie-key ontbreekt" }, { status: 503 });

  try {
    const link = await mollieInvoiceRequest(key, `payment-links/${invoice.molliePaymentLinkId}`);
    if (link.id !== invoice.molliePaymentLinkId || !invoiceAmountMatches(link, invoice.totalIncVat, invoice.molliePaymentMode)) {
      return NextResponse.json({ error: "Mollie-betaling komt niet overeen met de factuur" }, { status: 409 });
    }
    if (link.paidAt) {
      if (link.mode === "test") {
        await prisma.salesInvoice.updateMany({
          where: { id, molliePaymentLinkId: link.id },
          data: { molliePaidAt: new Date(link.paidAt) },
        });
        return new NextResponse(null, { status: 200 });
      }
      if (invoice.status === "BETAALD" && !invoice.molliePaidAt) {
        console.warn("Mollie-betaling ontvangen voor een al handmatig betaalde factuur:", invoice.number);
      }
      await prisma.salesInvoice.updateMany({
        where: { id, molliePaymentLinkId: link.id, status: { in: ["VERZONDEN", "VERVALLEN", "BETAALD"] } },
        data: { status: "BETAALD", molliePaidAt: new Date(link.paidAt) },
      });
    }
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Mollie-webhook verwerken mislukt:", error);
    return NextResponse.json({ error: "Mollie-status kon niet worden opgehaald" }, { status: 502 });
  }
}
