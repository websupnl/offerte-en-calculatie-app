import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteBuilder } from "@/components/forms/quote-builder";
import { redirect } from "next/navigation";

export default async function NewQuotePage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) redirect("/dashboard");

  const companySlug = session?.user?.companies?.find((c) => c.id === companyId)?.slug ?? "websup";

  const [customers, products, productSets] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { companyId, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.productSet.findMany({
      where: { companyId, active: true },
      include: {
        items: {
          include: { product: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
  ]);

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  const serialized = JSON.parse(JSON.stringify({ customers, products, productSets }));

  return (
    <QuoteBuilder
      customers={serialized.customers}
      products={serialized.products}
      productSets={serialized.productSets}
      companySlug={companySlug}
      companyName={company?.name ?? ""}
    />
  );
}
