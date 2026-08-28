import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QuoteDetailClient } from "./quote-detail-client";
import { resolveQuoteAttachmentImages, resolveChoiceGroupImages } from "@/lib/quote-attachments";
import { isStorageConfigured, presignDownload } from "@/lib/storage";
import { DEFAULT_SETTINGS, type TravelPricingTier } from "@/lib/branding";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const [quote, company, products, productSets, calculations, quoteTemplates] = await Promise.all([
    prisma.quote.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: "asc" } },
        attachments: { orderBy: { sortOrder: "asc" } },
        adviceDocuments: { orderBy: { createdAt: "desc" } },
        documents: { include: { productDocument: true }, orderBy: { sortOrder: "asc" } },
        share: true,
        events: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    }),
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.product.findMany({ where: { companyId, active: true }, orderBy: [{ category: "asc" }, { name: "asc" }], take: 500 }),
    prisma.productSet.findMany({
      where: { companyId, active: true },
      include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.calculation.findMany({
      where: { companyId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.quoteTemplate.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  if (!quote) notFound();

  const companySlug = session?.user?.companies?.find((c) => c.id === companyId)?.slug ?? "websup";
  const companySettings = (company?.settings ?? {}) as Record<string, unknown>;
  const homeBaseZipCode = (companySettings.homeBaseZipCode as string) ?? DEFAULT_SETTINGS.homeBaseZipCode;
  const travelPricingTiers = (companySettings.travelPricingTiers as TravelPricingTier[]) ?? DEFAULT_SETTINGS.travelPricingTiers;
  const customers = await prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" }, take: 500 });
  const attachments = await resolveQuoteAttachmentImages(quote.attachments, {
    expiresIn: 21600,
    includeStorageRef: true,
  });
  const choiceGroups = await resolveChoiceGroupImages(
    (Array.isArray(quote.choiceGroups) ? quote.choiceGroups : []) as Array<{
      choices: Array<{ image?: string | null; imageUrl?: string | null }>;
    }>,
    { expiresIn: 21600 },
  );
  const documents = await Promise.all(
    quote.documents.map(async (d) => ({
      id: d.id,
      productDocument: {
        ...d.productDocument,
        url: isStorageConfigured() ? await presignDownload(d.productDocument.objectKey, 3600) : null,
      },
    })),
  );

  const serialized = JSON.parse(JSON.stringify({
    quote: { ...quote, attachments, choiceGroups, documents },
    company,
    customers,
    products,
    productSets,
    calculations: calculations.map((calculation) => ({
      ...calculation,
      vatRate: Number(calculation.vatRate),
      totalCostPrice: Number(calculation.totalCostPrice),
      totalSalesPrice: Number(calculation.totalSalesPrice),
      marginAmount: Number(calculation.marginAmount),
      marginPercent: Number(calculation.marginPercent),
      items: calculation.items.map((item) => ({
        ...item,
        qty: Number(item.qty),
        costPrice: Number(item.costPrice),
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.vatRate),
      })),
    })),
    quoteTemplates,
  }));

  return (
    <QuoteDetailClient
      quote={serialized.quote}
      company={serialized.company}
      companySlug={companySlug}
      homeBaseZipCode={homeBaseZipCode}
      travelPricingTiers={travelPricingTiers}
      customers={serialized.customers}
      products={serialized.products}
      productSets={serialized.productSets}
      calculations={serialized.calculations}
      quoteTemplates={serialized.quoteTemplates}
    />
  );
}
