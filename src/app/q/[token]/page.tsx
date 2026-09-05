import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { QuotePortalClient } from "./quote-portal-client";
import { sendTelegramMessage } from "@/lib/notifications";
import { quoteChoiceGroupSchema, quoteOptionSchema } from "@/lib/quote-selection";
import { z } from "zod";
import { resolveQuoteAttachmentImages, resolveChoiceGroupImages } from "@/lib/quote-attachments";
import { isStorageConfigured, presignDownload } from "@/lib/storage";
import { modulesToOptions } from "@/lib/quote-modules";
import { applyCalculationPricing } from "@/lib/quote-with-pricing";

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
          modules: { orderBy: { sortOrder: "asc" } },
          calculations: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
          contentBlocks: { orderBy: { sortOrder: "asc" } },
          attachments: { orderBy: { sortOrder: "asc" } },
          documents: { include: { productDocument: true }, orderBy: { sortOrder: "asc" } },
          adviceDocuments: { orderBy: { createdAt: "desc" } },
          company: true,
        },
      },
    },
  });

  if (!share) notFound();

  // Interne preview: als je ingelogd bent in het dashboard tel je niet mee als
  // klantweergave — geen Telegram, geen view-log, geen statuswissel.
  const session = await auth();
  const isInternalPreview = Boolean(session?.user);

  if (!isInternalPreview) {
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
    sendTelegramMessage(telegramMsg).catch(console.error);

    // Elke view loggen (niet alleen de eerste) zodat de tracker het volledige
    // bezoekpatroon laat zien.
    const now = new Date();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await prisma.$transaction([
      prisma.quoteShare.update({
        where: { id: share.id },
        data: {
          viewedAt: share.viewedAt ?? now,
          lastViewedAt: now,
          viewCount: { increment: 1 },
        },
      }),
      prisma.quoteEvent.create({
        data: {
          quoteId: share.quoteId,
          type: "VIEWED",
          detail: `${city} · ${isMobile}`,
          userAgent,
          ip: ip ?? undefined,
        },
      }),
    ]);
    if (share.quote.status === "SENT") {
      await prisma.quote.update({
        where: { id: share.quoteId },
        data: { status: "VIEWED" },
      });
    }
  }

  const branding = (share.quote.company.branding ?? {}) as Record<string, string>;
  const slug = share.quote.company.slug;
  const serialized = JSON.parse(JSON.stringify(share));
  serialized.quote.attachments = await resolveQuoteAttachmentImages(
    serialized.quote.attachments,
    { expiresIn: 21600 },
  );
  const parsedChoiceGroups = z.array(quoteChoiceGroupSchema).safeParse(serialized.quote.choiceGroups);
  // Modules komen uit de QuoteModule-tabel; het portaal leest ze verder als `options`.
  const parsedOptions = z.array(quoteOptionSchema).safeParse(modulesToOptions(share.quote.modules));
  serialized.quote.choiceGroups = parsedChoiceGroups.success
    ? await resolveChoiceGroupImages(parsedChoiceGroups.data, { expiresIn: 21600 })
    : [];
  serialized.quote.options = parsedOptions.success ? parsedOptions.data : [];
  // Nieuwe offertes: prijs, artikelen, varianten en extra’s komen uit de gekoppelde
  // calculaties. Oude offertes houden wat hierboven is opgebouwd.
  Object.assign(serialized.quote, applyCalculationPricing(serialized.quote));
  // Expliciet meegeven, net als options: anders verschilt de client-render van de
  // server-render en telt de klant een pagina minder (hydration-mismatch).
  serialized.quote.contentBlocks = share.quote.contentBlocks.map((block) => ({
    id: block.id,
    type: block.type,
    title: block.title,
    body: block.body,
    items: block.items,
    tone: block.tone,
    imageUrl: block.imageUrl,
    caption: block.caption,
  }));
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
