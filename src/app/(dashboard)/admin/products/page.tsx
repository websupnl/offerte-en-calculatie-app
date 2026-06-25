import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductsClient } from "./products-client";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: selectedProductId } = await searchParams;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  const companySlug = session?.user?.companies?.find((c) => c.id === companyId)?.slug ?? "websup";

  const [products, productSets, rawDatasheets] = companyId
    ? await Promise.all([
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
          orderBy: { name: "asc" },
          take: 200,
        }),
        prisma.datasheet.findMany({
          where: { companyId },
          orderBy: [{ brand: "asc" }, { model: "asc" }],
          take: 500,
        }),
      ])
    : [[], [], []];

  const productsByDatasheetId = new Map(
    products
      .filter((product) => product.datasheetId)
      .map((product) => [
        product.datasheetId,
        {
          id: product.id,
          name: product.name,
          basePrice: product.basePrice,
          costPrice: product.costPrice,
        },
      ]),
  );
  const datasheets = rawDatasheets.map((datasheet) => ({
    ...datasheet,
    product: productsByDatasheetId.get(datasheet.id) ?? null,
  }));

  // Serialize Decimal and Date types for client component
  const serialized = JSON.parse(JSON.stringify({ products, productSets, datasheets }));

  return (
    <ProductsClient
      initialProducts={serialized.products}
      initialSets={serialized.productSets}
      initialDatasheets={serialized.datasheets}
      companySlug={companySlug}
      initialProductId={selectedProductId}
    />
  );
}
