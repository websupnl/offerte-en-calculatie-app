import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  const companySlug = session?.user?.companies?.find((c) => c.id === companyId)?.slug ?? "websup";

  const [products, productSets] = companyId
    ? await Promise.all([
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
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  // Serialize Decimal and Date types for client component
  const serialized = JSON.parse(JSON.stringify({ products, productSets }));

  return (
    <ProductsClient
      initialProducts={serialized.products}
      initialSets={serialized.productSets}
      companySlug={companySlug}
    />
  );
}
