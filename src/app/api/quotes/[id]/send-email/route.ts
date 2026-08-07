import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendQuoteEmail } from "@/lib/email";
import { formatCurrency, formatDate } from "@/lib/format";
import { generateAndStorePortalPdf } from "@/lib/pdf/generate-and-store";

function introLineFor(companySlug: string) {
  return companySlug === "koolhaas"
    ? "Hierbij stuur ik je de offerte toe. Via onderstaande knop kun je 'm rustig bekijken en accorderen."
    : "Zoals besproken heb ik de offerte voor je klaargezet. Via onderstaande knop kun je 'm rustig bekijken en accorderen.";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: { customer: true, company: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!quote.customer.email) {
    return NextResponse.json({ error: "Deze klant heeft geen e-mailadres" }, { status: 422 });
  }

  const share = await prisma.quoteShare.upsert({
    where: { quoteId: id },
    create: { quoteId: id },
    update: {},
  });

  if (quote.status === "DRAFT") {
    await prisma.quote.update({ where: { id }, data: { status: "SENT" } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const quoteUrl = `${appUrl}/q/${share.token}`;

  const result = await sendQuoteEmail({
    to: quote.customer.email,
    customerName: quote.customer.name,
    companySlug: quote.company.slug,
    quoteNumber: quote.number,
    quoteTitle: quote.title ?? undefined,
    quoteUrl,
    totalIncVat: formatCurrency(Number(quote.totalIncVat)),
    validUntil: quote.validUntil ? formatDate(quote.validUntil) : undefined,
    introLine: introLineFor(quote.company.slug),
  });

  if (!result.sent) {
    return NextResponse.json({ error: result.reason ?? "Versturen mislukt" }, { status: 500 });
  }

  // Portal-PDF alvast klaarzetten zodat die direct beschikbaar is als de klant de link opent
  const host = req.headers.get("host") ?? "localhost:3001";
  after(async () => {
    await generateAndStorePortalPdf(share.token, host);
  });

  return NextResponse.json({ ok: true, url: quoteUrl });
}
