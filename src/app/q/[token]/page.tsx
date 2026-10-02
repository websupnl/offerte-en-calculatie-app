import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { isEigenVerkeer } from "@/lib/portal-visitor";
import { QuotePortalClient } from "./quote-portal-client";
import { sendTelegramMessage } from "@/lib/notifications";
import { quoteChoiceGroupSchema, quoteOptionSchema } from "@/lib/quote-selection";
import { z } from "zod";
import { resolveQuoteAttachmentImages, resolveChoiceGroupImages } from "@/lib/quote-attachments";
import { isStorageConfigured, presignDownload } from "@/lib/storage";
import { modulesToOptions } from "@/lib/quote-modules";
import { applyCalculationPricing } from "@/lib/quote-with-pricing";
import { getBranding } from "@/lib/branding";
import { publicQuoteItems } from "@/lib/public-quote-items";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const share = await prisma.quoteShare.findUnique({
    where: { token },
    select: {
      quote: {
        select: {
          title: true,
          number: true,
          company: { select: { id: true, name: true, updatedAt: true } },
        },
      },
    },
  });

  if (!share) return { title: "Offerte" };

  const companyName = share.quote.company.name;
  const quoteTitle = share.quote.title?.trim() || share.quote.number || "Offerte";
  const title = `${quoteTitle} | ${companyName}`;
  const description = `Bekijk de offerte van ${companyName}.`;
  const assetVersion = share.quote.company.updatedAt.getTime();

  return {
    title: { absolute: title },
    description,
    icons: {
      icon: `/api/brand-assets/${share.quote.company.id}/favicon?v=${assetVersion}`,
    },
    openGraph: {
      title,
      description,
      siteName: companyName,
      type: "website",
      images: [`/q/${token}/opengraph-image?v=${assetVersion}`],
    },
    twitter: { card: "summary", title: { absolute: title }, description },
  };
}

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
          calculations: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
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
  // klantweergave — geen Telegram, geen view-log, geen statuswissel. Datzelfde
  // geldt voor verkeer vanaf de eigen machine of vanuit een hulpmiddel: dat
  // heeft geen sessie en telde daardoor jarenlang mee als klant.
  const session = await auth();
  const eigenVerkeer = isEigenVerkeer({
    ip: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent"),
  });
  const isInternalPreview = Boolean(session?.user) || eigenVerkeer;

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
    // In after(): het renderen van de pagina is klaar zodra de klant zijn offerte
    // ziet, en op Vercel wordt de functie dan bevroren. Een fetch die daar nog
    // loopt wordt afgekapt, en dan mis je de melding dat er iemand kijkt.
    after(async () => {
      await sendTelegramMessage(telegramMsg);
    });

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

  const slug = share.quote.company.slug;
  const branding = getBranding(slug, (share.quote.company.branding ?? {}) as Record<string, string>);
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
  //
  // Eerst de klantregels opbouwen uit de calculatie. De vervanger laat de ruwe
  // calculaties en interne prijsgegevens weg; vervang het volledige object,
  // zodat leverancier, inkoop en marge nooit in de klantpagina terechtkomen.
  serialized.quote = applyCalculationPricing(serialized.quote);
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

  // De share-token is openbaar toegangsbewijs. Geef daarom alleen velden door
  // die de offerteweergave nodig heeft. De brede Prisma-resultaten bevatten ook
  // interne notities, akkoordberichten, PDF-url's en bedrijfsinstellingen.
  const publicItems = publicQuoteItems(serialized.quote);
  const publicQuote = {
    id: serialized.quote.id,
    number: serialized.quote.number,
    title: serialized.quote.title,
    category: serialized.quote.category,
    tagline: serialized.quote.tagline,
    itemsHeader: serialized.quote.itemsHeader,
    status: serialized.quote.status,
    intro: serialized.quote.intro,
    outro: serialized.quote.outro,
    validUntil: serialized.quote.validUntil,
    createdAt: serialized.quote.createdAt,
    totalExVat: serialized.quote.totalExVat,
    totalVat: serialized.quote.totalVat,
    totalIncVat: serialized.quote.totalIncVat,
    items: publicItems,
    customer: {
      name: serialized.quote.customer.name,
      email: serialized.quote.customer.email,
      address: serialized.quote.customer.address,
      city: serialized.quote.customer.city,
      zipCode: serialized.quote.customer.zipCode,
    },
    company: {
      id: serialized.quote.company.id,
      name: serialized.quote.company.name,
      slug: serialized.quote.company.slug,
    },
    flow: serialized.quote.flow,
    approach: serialized.quote.approach,
    options: serialized.quote.options,
    exclusions: serialized.quote.exclusions,
    assumptions: serialized.quote.assumptions,
    technicalNotes: serialized.quote.technicalNotes,
    customerResponsibilities: serialized.quote.customerResponsibilities,
    planning: serialized.quote.planning,
    commercial: serialized.quote.commercial,
    batteryAdvice: serialized.quote.batteryAdvice,
    choiceGroups: serialized.quote.choiceGroups.map((group: {
      id: string;
      title: string;
      type: "SINGLE_SELECT";
      description?: string;
      recommendedChoiceId?: string;
      choices: Array<{
        id: string;
        label?: string;
        title: string;
        summary?: string;
        tag?: string;
        imageUrl?: string;
        items: Array<{
          description: string;
          qty: number;
          unitPrice: number;
          vatRate: number;
          indent?: number;
          hiddenOnQuote?: boolean;
        }>;
      }>;
    }) => ({
      id: group.id,
      title: group.title,
      type: group.type,
      description: group.description,
      recommendedChoiceId: group.recommendedChoiceId,
      choices: group.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        title: choice.title,
        summary: choice.summary,
        tag: choice.tag,
        imageUrl: choice.imageUrl,
        items: choice.items
          .filter((item) => !item.hiddenOnQuote)
          .map((item) => ({
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            indent: item.indent,
          })),
      })),
    })),
    hiddenSections: serialized.quote.hiddenSections,
    contentBlocks: serialized.quote.contentBlocks,
    attachments: serialized.quote.attachments,
    documents: serialized.quote.documents,
    adviceDocuments: [],
  };
  const publicShare = {
    id: serialized.id,
    token: share.token,
    acceptedAt: serialized.acceptedAt,
    declinedAt: serialized.declinedAt,
    selectedChoiceIds: serialized.selectedChoiceIds,
    selectedOptionIds: serialized.selectedOptionIds,
    acceptedTotalExVat: serialized.acceptedTotalExVat,
    acceptedTotalIncVat: serialized.acceptedTotalIncVat,
  };
  return (
    <QuotePortalClient
      quote={publicQuote}
      share={publicShare}
      companySlug={slug}
      branding={branding}
    />
  );
}
