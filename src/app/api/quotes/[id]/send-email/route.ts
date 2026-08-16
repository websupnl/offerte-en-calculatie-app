import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendQuoteEmail } from "@/lib/email";
import { escapeTelegramHtml, sendTelegramMessage } from "@/lib/notifications";
import { formatCurrency, formatDateLong } from "@/lib/format";
import { generatePortalPdfWithBuffer } from "@/lib/pdf/generate-and-store";
import { pdfFilename } from "@/lib/pdf/filename";
import { downloadObject, isStorageConfigured } from "@/lib/storage";
import { defaultQuoteEmailMessage } from "@/lib/quote-email-copy";
import { calculateQuotePriceSummary, quoteChoiceGroupSchema } from "@/lib/quote-selection";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let customMessage: string | undefined;
  const requestBody = await req.text();
  if (requestBody) {
    try {
      const parsed = JSON.parse(requestBody) as { message?: unknown };
      if (typeof parsed.message !== "undefined" && typeof parsed.message !== "string") {
        return NextResponse.json({ error: "Ongeldige e-mailtekst" }, { status: 400 });
      }
      customMessage = parsed.message?.trim();
      if (customMessage && customMessage.length > 2000) {
        return NextResponse.json({ error: "De e-mailtekst mag maximaal 2.000 tekens bevatten" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
    }
  }

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      customer: true,
      company: true,
      documents: { include: { productDocument: true }, orderBy: { sortOrder: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const quoteUrl = `${appUrl}/q/${share.token}`;

  // PDF vooraf renderen zodat 'm als echte bijlage kan meesturen (kost een paar
  // seconden Puppeteer-tijd, vandaar maxDuration=60 hierboven).
  const host = req.headers.get("host") ?? "localhost:3001";
  const portalPdf = await generatePortalPdfWithBuffer(share.token, host);

  const filename = pdfFilename("Offerte", quote.number, quote.customer.name);

  // Bij keuzegroepen ("kies uw optie") klopt een vast totaal niet — de klant
  // kiest pas in het portaal. Toon dan het laagste bedrag als "Vanaf".
  const parsedGroups = z.array(quoteChoiceGroupSchema).safeParse(quote.choiceGroups ?? []);
  const choiceGroups = parsedGroups.success ? parsedGroups.data : [];
  const priceItems = quote.items.map((item) => ({
    ...item,
    qty: Number(item.qty),
    unitPrice: Number(item.unitPrice),
    vatRate: Number(item.vatRate),
    total: Number(item.total),
  }));
  const pricing = calculateQuotePriceSummary(priceItems, choiceGroups);
  const totalLabel = pricing.hasChoices
    ? `Vanaf ${formatCurrency(pricing.minimum.totalIncVat)}`
    : formatCurrency(Number(quote.totalIncVat));

  const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
  if (portalPdf) {
    attachments.push({ filename, content: portalPdf.buffer });
  } else {
    console.error(`[send-email] Offerte-PDF kon niet gegenereerd worden voor quote ${id} — mail gaat zonder PDF-bijlage`);
  }

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
    totalIncVat: totalLabel,
    validUntil: quote.validUntil ? formatDateLong(quote.validUntil) : undefined,
    introLine: customMessage || defaultQuoteEmailMessage(quote.company.slug),
    attachments,
  });

  if (!result.sent) {
    return NextResponse.json({ error: result.reason ?? "Versturen mislukt" }, { status: 500 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.quote.update({
      where: { id },
      data: {
        status: quote.status === "DRAFT" ? "SENT" : quote.status,
        sentAt: quote.sentAt ?? now,
        lastSentAt: now,
        sendCount: { increment: 1 },
      },
    }),
    prisma.quoteEvent.create({
      data: {
        quoteId: id,
        type: "SENT",
        actor: session.user.name ?? session.user.email ?? undefined,
        detail: `Verstuurd naar ${quote.customer.email}${customMessage ? " met eigen bericht" : ""}`,
      },
    }),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
  const quoteLabel = quote.title || quote.number;
  sendTelegramMessage(
    [
      "📤 <b>OFFERTE VERSTUURD</b>",
      `👤 <b>Klant:</b> ${escapeTelegramHtml(quote.customer.name)}`,
      `📄 <b>Offerte:</b> ${escapeTelegramHtml(quoteLabel)}`,
      `✉️ <b>Naar:</b> ${escapeTelegramHtml(quote.customer.email)}`,
      `🔗 <a href=\"${appUrl}/quotes/${quote.id}\">Open offerte in dashboard</a>`,
    ].join("\n"),
  ).catch(console.error);

  return NextResponse.json({
    ok: true,
    url: quoteUrl,
    warning: portalPdf ? undefined : "Offerte-PDF kon niet gegenereerd worden — mail is verstuurd zonder PDF-bijlage.",
  });
}
