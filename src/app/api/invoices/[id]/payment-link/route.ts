import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceAmountMatches, invoiceMollieKey, invoiceMollieMode, mollieInvoiceRequest } from "@/lib/mollie-invoices";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: { company: { select: { slug: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  if (invoice.molliePaymentLinkId && invoice.molliePaymentUrl) {
    return NextResponse.json({ url: invoice.molliePaymentUrl, mode: invoice.molliePaymentMode });
  }
  if (invoice.status === "CONCEPT" || invoice.status === "BETAALD") {
    return NextResponse.json({ error: "Maak de factuur eerst definitief" }, { status: 409 });
  }
  if (Number(invoice.totalIncVat) <= 0) {
    return NextResponse.json({ error: "Het te betalen bedrag moet groter zijn dan nul" }, { status: 400 });
  }

  const key = invoiceMollieKey(invoice.company.slug);
  if (!key) return NextResponse.json({ error: "Mollie is voor dit bedrijf nog niet ingesteld" }, { status: 503 });
  let mode: "test" | "live";
  try {
    mode = invoiceMollieMode(key);
  } catch {
    return NextResponse.json({ error: "Ongeldige Mollie-key voor dit bedrijf" }, { status: 503 });
  }
  if (process.env.NODE_ENV !== "production" && mode === "live") {
    return NextResponse.json({ error: "Gebruik lokaal een Mollie-testkey" }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || !appUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Een publieke HTTPS-app-URL is nodig voor Mollie-webhooks" }, { status: 503 });
  }

  try {
    const link = await mollieInvoiceRequest(key, "payment-links", {
      method: "POST",
      idempotencyKey: `sales-invoice-${invoice.id}`,
      body: {
        description: `Factuur ${invoice.number}`,
        amount: { currency: "EUR", value: Number(invoice.totalIncVat).toFixed(2) },
        webhookUrl: `${appUrl.replace(/\/$/, "")}/api/webhooks/mollie-invoices/${invoice.id}`,
        reusable: false,
      },
    });
    const url = link._links?.paymentLink.href;
    if (!url || !invoiceAmountMatches(link, invoice.totalIncVat, mode)) throw new Error("Ongeldige reactie van Mollie");

    // Bij dubbele klikken wordt maar één link aan de factuur gekoppeld.
    const { count } = await prisma.salesInvoice.updateMany({
      where: { id, companyId: invoice.companyId, molliePaymentLinkId: null, status: { in: ["VERZONDEN", "VERVALLEN"] } },
      data: { molliePaymentLinkId: link.id, molliePaymentUrl: url, molliePaymentMode: link.mode },
    });
    if (!count) {
      const current = await prisma.salesInvoice.findUnique({ where: { id }, select: { molliePaymentUrl: true } });
      if (current?.molliePaymentUrl) return NextResponse.json({ url: current.molliePaymentUrl, mode: link.mode });
      return NextResponse.json({ error: "Factuurstatus is ondertussen gewijzigd" }, { status: 409 });
    }
    return NextResponse.json({ url, mode: link.mode });
  } catch (error) {
    console.error("Mollie-betaallink aanmaken mislukt:", error);
    return NextResponse.json({ error: "Betaallink aanmaken mislukt. Controleer de Mollie-configuratie." }, { status: 502 });
  }
}
