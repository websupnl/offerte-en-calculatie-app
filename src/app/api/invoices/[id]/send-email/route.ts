import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureInvoicePaymentLink, invoiceMollieKey, invoiceMollieMode } from "@/lib/mollie-invoices";
import { invoiceEmailConfigured, sendInvoiceEmail } from "@/lib/email";
import { renderPageAsPdf } from "@/lib/pdf/render-page-as-pdf";
import { pdfFilename } from "@/lib/pdf/filename";
import { formatCurrency, formatDate } from "@/lib/format";
import { getInvoiceSettings } from "@/lib/branding";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: { customer: true, company: { select: { slug: true, settings: true } }, lines: { select: { id: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  if (!["CONCEPT", "GEREED", "VERZONDEN"].includes(invoice.status)) {
    return NextResponse.json({ error: "Deze factuur kan niet worden verstuurd" }, { status: 409 });
  }
  if (!invoice.customer.email) return NextResponse.json({ error: "Deze klant heeft geen e-mailadres" }, { status: 422 });
  const companySettings = getInvoiceSettings(invoice.company.settings);
  if (!companySettings.address || !companySettings.kvk || !companySettings.vatNumber) {
    return NextResponse.json({ error: "Vul eerst het bedrijfsadres, KvK-nummer en btw-id in" }, { status: 422 });
  }
  if (!invoice.lines.length || Number(invoice.totalIncVat) <= 0) {
    return NextResponse.json({ error: "De factuur moet regels en een positief bedrag hebben" }, { status: 422 });
  }
  if (invoice.dueDate && invoice.dueDate < new Date(new Date().toDateString())) {
    return NextResponse.json({ error: "De vervaldatum ligt in het verleden. Pas de factuur aan voordat je hem verstuurt." }, { status: 422 });
  }
  const key = invoiceMollieKey(invoice.company.slug);
  if (!key) return NextResponse.json({ error: "Mollie is voor dit bedrijf nog niet ingesteld" }, { status: 503 });
  let liveKey = false;
  try { liveKey = invoiceMollieMode(key) === "live"; } catch { /* ongeldige sleutel */ }
  if (!liveKey || process.env.NODE_ENV !== "production") {
    return NextResponse.json({ error: "Klantenmail vereist een live Mollie-betaallink op productie" }, { status: 409 });
  }
  if (!invoiceEmailConfigured()) return NextResponse.json({ error: "E-mail is nog niet ingesteld" }, { status: 503 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl?.startsWith("https://")) {
    return NextResponse.json({ error: "Een publieke HTTPS-app-URL is nodig" }, { status: 503 });
  }

  // Claim de factuur atomair. Een dubbele klik of twee open tabbladen mogen niet dubbel mailen.
  const claim = await prisma.salesInvoice.updateMany({
    where: { id, companyId: invoice.companyId, status: invoice.status },
    data: { status: "VERZENDEN" },
  });
  if (!claim.count) return NextResponse.json({ error: "De factuur wordt al verwerkt" }, { status: 409 });

  let emailAccepted = false;
  try {
    const payment = await ensureInvoicePaymentLink(invoice);
    if (payment.mode !== "live") throw new Error("De betaallink staat niet in live-modus");

    const printUrl = `${appUrl}/print/invoices/${id}`;
    const pdf = await renderPageAsPdf(printUrl, req.headers.get("cookie") ?? "", ".inv-sheet");
    if (!pdf) throw new Error("De factuur-PDF kon niet worden gemaakt. Er is geen e-mail verstuurd.");

    await sendInvoiceEmail({
      to: invoice.customer.email,
      customerName: invoice.customer.name,
      companySlug: invoice.company.slug,
      invoiceNumber: invoice.number,
      amount: formatCurrency(Number(invoice.totalIncVat)),
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : null,
      paymentUrl: payment.url,
      pdf,
      filename: pdfFilename("Factuur", invoice.number, invoice.customer.name),
    });
    emailAccepted = true;
    await prisma.salesInvoice.updateMany({
      where: { id, companyId: invoice.companyId, status: "VERZENDEN" },
      data: { status: "VERZONDEN" },
    });
    return NextResponse.json({ ok: true, to: invoice.customer.email, paymentUrl: payment.url });
  } catch (error) {
    console.error("Factuur verzenden mislukt:", error);
    if (!emailAccepted) {
      // De link kan inmiddels bestaan. Houd de regels dan vergrendeld en laat opnieuw proberen toe.
      await prisma.salesInvoice.updateMany({
        where: { id, companyId: invoice.companyId, status: "VERZENDEN" },
        data: { status: invoice.status === "CONCEPT" ? "GEREED" : invoice.status },
      }).catch((resetError) => console.error("Factuurstatus herstellen mislukt:", resetError));
    }
    return NextResponse.json({
      error: emailAccepted
        ? "Mail is geaccepteerd, maar de factuurstatus kon niet worden bijgewerkt. Controleer de verzending voordat je opnieuw probeert."
        : error instanceof Error ? error.message : "Factuur verzenden mislukt",
    }, { status: 502 });
  }
}
