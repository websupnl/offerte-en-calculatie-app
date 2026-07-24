import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { QuotePortalClient } from "./quote-portal-client";
import { sendTelegramMessage } from "@/lib/notifications";
import { quoteChoiceGroupSchema, quoteOptionSchema } from "@/lib/quote-selection";
import { z } from "zod";
import { resolveQuoteAttachmentImages, resolveChoiceGroupImages } from "@/lib/quote-attachments";
import { isStorageConfigured, presignDownload } from "@/lib/storage";

export default async function QuotePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headerList = await headers();
  
  const userAgent = headerList.get("user-agent") || "Onbekend apparaat";
  const city = headerList.get("x-vercel-ip-city") || "Onbekende locatie";
  const isMobile = /mobile/i.test(userAgent) ? "📱 Mobiel" : "💻 Desktop";

  const share = await prisma.quoteShare.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          customer: true,
          items: { orderBy: { sortOrder: "asc" } },
          attachments: { orderBy: { sortOrder: "asc" } },
          documents: { include: { productDocument: true }, orderBy: { sortOrder: "asc" } },
          adviceDocuments: { orderBy: { createdAt: "desc" } },
          company: true,
        },
      },
    },
  });

  if (!share) notFound();

  // "The Stalker" Logic: Send Telegram Notification
  const isFirstView = !share.viewedAt;
  const customerName = share.quote.customer.name;
  const quoteTitle = share.quote.title || share.quote.number;
  
  const telegramMsg = `
🔔 <b>${isFirstView ? "NIEUWE VIEW!" : "KLANT KIJKT WEER!"}</b>
👤 <b>Klant:</b> ${customerName}
📄 <b>Offerte:</b> ${quoteTitle}
📍 <b>Locatie:</b> ${city}
💻 <b>Apparaat:</b> ${isMobile}
  `.trim();

  // We use after() or just fire and forget if not using after
  // Since it's a server component, we can just await it or not.
  // We'll await it to be sure, or use after if available in this context.
  sendTelegramMessage(telegramMsg).catch(console.error);

  // Mark as viewed if not yet
  if (!share.viewedAt && !share.acceptedAt && !share.declinedAt) {
    await prisma.quoteShare.update({
      where: { id: share.id },
      data: { viewedAt: new Date() },
    });
    // Update quote status to VIEWED
    await prisma.quote.update({
      where: { id: share.quoteId },
      data: { status: "VIEWED" },
    });
  }

  const branding = (share.quote.company.branding ?? {}) as Record<string, string>;
  const slug = share.quote.company.slug;
  const serialized = JSON.parse(JSON.stringify(share));
  serialized.quote.attachments = await resolveQuoteAttachmentImages(
    serialized.quote.attachments,
    { expiresIn: 21600 },
  );
  const parsedChoiceGroups = z.array(quoteChoiceGroupSchema).safeParse(serialized.quote.choiceGroups);
  const parsedOptions = z.array(quoteOptionSchema).safeParse(serialized.quote.options);
  serialized.quote.choiceGroups = parsedChoiceGroups.success
    ? await resolveChoiceGroupImages(parsedChoiceGroups.data, { expiresIn: 21600 })
    : [];
  serialized.quote.options = parsedOptions.success ? parsedOptions.data : [];
  serialized.quote.documents = await Promise.all(
    serialized.quote.documents.map(async (d: { id: string; productDocument: { name: string; type: string; objectKey: string } }) => ({
      id: d.id,
      name: d.productDocument.name,
      type: d.productDocument.type,
      url: isStorageConfigured() ? await presignDownload(d.productDocument.objectKey, 21600) : null,
    })),
  );

  return (
    <QuotePortalClient
      quote={serialized.quote}
      share={serialized}
      companySlug={slug}
      branding={branding}
    />
  );
}
