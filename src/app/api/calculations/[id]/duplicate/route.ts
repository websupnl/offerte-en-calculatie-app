import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextCalculationNumber } from "@/lib/calculation-number";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const source = await prisma.calculation.findFirst({
    where: { id, companyId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // { asVariant: true } houdt de kopie aan dezelfde offerte hangen als keuze
  // voor de klant. Zonder die vlag is het een losse calculatie, zoals voorheen.
  const body = await req.json().catch(() => ({}));
  const asVariant = Boolean(body?.asVariant) && Boolean(source.quoteId);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const number = await nextCalculationNumber(companyId, company?.slug ?? "xx");

  const hoogsteVolgorde = asVariant
    ? await prisma.calculation.aggregate({
        where: { quoteId: source.quoteId },
        _max: { sortOrder: true },
      })
    : null;

  const duplicate = await prisma.calculation.create({
    data: {
      companyId,
      customerId: source.customerId,
      projectId: source.projectId,
      quoteId: asVariant ? source.quoteId : null,
      role: asVariant ? "VARIANT" : source.role,
      sortOrder: asVariant ? (hoogsteVolgorde?._max.sortOrder ?? 0) + 1 : 0,
      number,
      title: asVariant ? `${source.title} (variant)` : source.title,
      description: source.description,
      status: "DRAFT",
      vatRate: source.vatRate,
      totalCostPrice: source.totalCostPrice,
      totalSalesPrice: source.totalSalesPrice,
      marginAmount: source.marginAmount,
      marginPercent: source.marginPercent,
      notes: source.notes,
      items: source.items.length
        ? {
            create: source.items.map((item) => ({
              productId: item.productId,
              type: item.type,
              supplier: item.supplier,
              sku: item.sku,
              description: item.description,
              qty: item.qty,
              unit: item.unit,
              costPrice: item.costPrice,
              markupPercent: item.markupPercent,
              unitPrice: item.unitPrice,
              totalCostPrice: item.totalCostPrice,
              totalSalesPrice: item.totalSalesPrice,
              vatRate: item.vatRate,
              optional: item.optional,
              hiddenOnQuote: item.hiddenOnQuote,
              recurringInterval: item.recurringInterval,
              quoteNote: item.quoteNote,
              sortOrder: item.sortOrder,
            })),
          }
        : undefined,
    },
    include: { customer: true, project: true, items: true },
  });

  await syncQuoteTotalsFromCalculations(duplicate.quoteId);

  return NextResponse.json(duplicate, { status: 201 });
}
