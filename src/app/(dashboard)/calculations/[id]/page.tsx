import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { CalculationBuilderClient } from "./calculation-builder-client";
import { DEFAULT_SETTINGS, type TravelPricingTier } from "@/lib/branding";

export default async function CalculationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const [calculation, products, customers, projects, sets] = await Promise.all([
    prisma.calculation.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        project: true,
        quote: true,
        items: {
          orderBy: { sortOrder: "asc" },
          include: { product: true },
        },
      },
    }),
    prisma.product.findMany({
      where: { companyId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, zipCode: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { companyId },
      select: { id: true, number: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productSet.findMany({
      where: { companyId, active: true },
      include: {
        items: {
          include: { product: true },
        },
      },
    }),
  ]);

  if (!calculation) {
    notFound();
  }

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  const companySettings = (company?.settings ?? {}) as Record<string, unknown>;
  const homeBaseZipCode = (companySettings.homeBaseZipCode as string) ?? DEFAULT_SETTINGS.homeBaseZipCode;
  const travelPricingTiers = (companySettings.travelPricingTiers as TravelPricingTier[]) ?? DEFAULT_SETTINGS.travelPricingTiers;

  // De andere calculaties op dezelfde offerte: basis en varianten samen bepalen
  // wat de klant te zien krijgt, dus die wil je hier naast elkaar hebben.
  const siblings = calculation.quoteId
    ? await prisma.calculation.findMany({
        where: { quoteId: calculation.quoteId, id: { not: calculation.id }, archivedAt: null },
        select: { id: true, number: true, title: true, role: true },
        orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
      })
    : [];

  const serializedCalculation = {
    ...calculation,
    role: calculation.role === "VARIANT" ? ("VARIANT" as const) : ("BASE" as const),
    vatRate: Number(calculation.vatRate),
    totalCostPrice: Number(calculation.totalCostPrice),
    totalSalesPrice: Number(calculation.totalSalesPrice),
    marginAmount: Number(calculation.marginAmount),
    marginPercent: Number(calculation.marginPercent),
    createdAt: calculation.createdAt.toISOString(),
    updatedAt: calculation.updatedAt.toISOString(),
    items: calculation.items.map((item) => ({
      ...item,
      qty: Number(item.qty),
      unit: item.unit ?? "stuk",
      recurringInterval: (item.recurringInterval === "maand" || item.recurringInterval === "jaar"
        ? item.recurringInterval
        : null) as "maand" | "jaar" | null,
      costPrice: Number(item.costPrice),
      markupPercent: Number(item.markupPercent),
      unitPrice: Number(item.unitPrice),
      totalCostPrice: Number(item.totalCostPrice),
      totalSalesPrice: Number(item.totalSalesPrice),
      vatRate: Number(item.vatRate),
      product: item.product
        ? {
            ...item.product,
            basePrice: Number(item.product.basePrice),
            costPrice: item.product.costPrice ? Number(item.product.costPrice) : null,
            defaultMarkupPercent: item.product.defaultMarkupPercent ? Number(item.product.defaultMarkupPercent) : 25,
            vatRate: Number(item.product.vatRate),
          }
        : null,
    })),
  };

  const serializedProducts = products.map((p) => ({
    ...p,
    basePrice: Number(p.basePrice),
    costPrice: p.costPrice ? Number(p.costPrice) : null,
    defaultMarkupPercent: p.defaultMarkupPercent ? Number(p.defaultMarkupPercent) : 25,
    vatRate: Number(p.vatRate),
    priceUpdatedAt: p.priceUpdatedAt ? p.priceUpdatedAt.toISOString() : null,
  }));

  const serializedSets = sets.map((s) => ({
    ...s,
    laborHours: s.laborHours ? Number(s.laborHours) : 0,
    laborRate: s.laborRate ? Number(s.laborRate) : 65,
    items: s.items.map((i) => ({
      ...i,
      qty: Number(i.qty),
      product: {
        ...i.product,
        basePrice: Number(i.product.basePrice),
        costPrice: i.product.costPrice ? Number(i.product.costPrice) : null,
        defaultMarkupPercent: i.product.defaultMarkupPercent ? Number(i.product.defaultMarkupPercent) : 25,
        vatRate: Number(i.product.vatRate),
        priceUpdatedAt: i.product.priceUpdatedAt ? i.product.priceUpdatedAt.toISOString() : null,
      },
    })),
  }));

  return (
    <CalculationBuilderClient
      initialCalculation={serializedCalculation}
      siblings={siblings}
      products={serializedProducts}
      customers={customers}
      projects={projects}
      sets={serializedSets}
      homeBaseZipCode={homeBaseZipCode}
      travelPricingTiers={travelPricingTiers}
    />
  );
}
