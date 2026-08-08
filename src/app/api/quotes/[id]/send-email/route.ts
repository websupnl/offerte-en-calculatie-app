import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendQuoteEmail } from "@/lib/email";
import { formatCurrency, formatDateLong } from "@/lib/format";
import { generatePortalPdfWithBuffer } from "@/lib/pdf/generate-and-store";
import { pdfFilename } from "@/lib/pdf/filename";
import { downloadObject, isStorageConfigured } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    include: {
      customer: true,
      company: true,
      documents: { include: { productDocument: true }, orderBy: { sortOrder: "asc" } },
    },
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

  // PDF vooraf renderen zodat 'm als echte bijlage kan meesturen (kost een paar
  // seconden Puppeteer-tijd, vandaar maxDuration=60 hierboven).
  const host = req.headers.get("host") ?? "localhost:3001";
  const portalPdf = await generatePortalPdfWithBuffer(share.token, host);

  const filename = pdfFilename("Offerte", quote.number, quote.customer.name);

  const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
  if (portalPdf) attachments.push({ filename, content: portalPdf.buffer });

  if (isStorageConfigured()) {
    for (const doc of quote.documents) {
      try {
        const content = await downloadObject(doc.productDocument.objectKey);
        attachments.push({
          filename: doc.productDocument.name,
          content,
          contentType: doc.productDocument.mimeType ?? undefined,
        });
      } catch (err) {
        console.error(`[send-email] Kon datasheet niet ophalen: ${doc.productDocument.name}`, err);
      }
    }
  }

  const result = await sendQuoteEmail({
    to: quote.customer.email,
    customerName: quote.customer.name,
    companySlug: quote.company.slug,
    quoteNumber: quote.number,
    quoteTitle: quote.title ?? undefined,
    quoteUrl,
    totalIncVat: formatCurrency(Number(quote.totalIncVat)),
    validUntil: quote.validUntil ? formatDateLong(quote.validUntil) : undefined,
    introLine: introLineFor(quote.company.slug),
    attachments,
  });

  if (!result.sent) {
    return NextResponse.json({ error: result.reason ?? "Versturen mislukt" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: quoteUrl });
}
