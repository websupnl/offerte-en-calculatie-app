import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteBuilder } from "@/components/forms/quote-builder";
import { redirect } from "next/navigation";
import { DEFAULT_SETTINGS, type TravelPricingTier } from "@/lib/branding";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ adviceId?: string; customerId?: string }>;
}) {
  const { adviceId, customerId } = await searchParams;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) redirect("/dashboard");

  const companySlug = session?.user?.companies?.find((c) => c.id === companyId)?.slug ?? "websup";

  const [customers, products, productSets, adviceReport] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.product.findMany({
      where: { companyId, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 500,
    }),
    prisma.productSet.findMany({
      where: { companyId, active: true },
      include: {
        items: {
          include: { product: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      take: 200,
    }),
    adviceId ? prisma.adviceDocument.findUnique({
      where: { id: adviceId },
      include: { customer: true }
    }) : null
  ]);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const companySettings = (company?.settings ?? {}) as Record<string, unknown>;

  const serialized = JSON.parse(JSON.stringify({
    customers,
    products,
    productSets,
    initialAdvice: adviceReport
  }));

  return (
    <QuoteBuilder
      customers={serialized.customers}
      products={serialized.products}
      productSets={serialized.productSets}
      companySlug={companySlug}
      companyName={company?.name ?? ""}
      homeBaseZipCode={(companySettings.homeBaseZipCode as string) ?? DEFAULT_SETTINGS.homeBaseZipCode}
      travelPricingTiers={(companySettings.travelPricingTiers as TravelPricingTier[]) ?? DEFAULT_SETTINGS.travelPricingTiers}
      initialAdvice={serialized.initialAdvice}
      initialQuote={customerId ? { customerId } : undefined}
    />
  );
}
