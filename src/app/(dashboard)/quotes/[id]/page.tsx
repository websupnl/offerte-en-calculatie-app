import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QuoteDetailClient } from "./quote-detail-client";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const [quote, company, products, productSets] = await Promise.all([
    prisma.quote.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: "asc" } },
        attachments: { orderBy: { sortOrder: "asc" } },
        adviceDocuments: { orderBy: { createdAt: "desc" } },
        share: true,
      },
    }),
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.product.findMany({ where: { companyId, active: true }, orderBy: [{ category: "asc" }, { name: "asc" }], take: 500 }),
    prisma.productSet.findMany({
      where: { companyId, active: true },
      include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  if (!quote) notFound();

  const companySlug = session?.user?.companies?.find((c) => c.id === companyId)?.slug ?? "websup";
  const customers = await prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" }, take: 500 });
  const serialized = JSON.parse(JSON.stringify({ quote, company, customers, products, productSets }));

  return (
    <QuoteDetailClient
      quote={serialized.quote}
      company={serialized.company}
      companySlug={companySlug}
      customers={serialized.customers}
      products={serialized.products}
      productSets={serialized.productSets}
    />
  );
}
