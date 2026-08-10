import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCalculationNumber } from "@/lib/format";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const source = await prisma.calculation.findFirst({
    where: { id, companyId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const count = await prisma.calculation.count({ where: { companyId } });
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const number = generateCalculationNumber(company?.slug ?? "xx", count + 1);

  const duplicate = await prisma.calculation.create({
    data: {
      companyId,
      customerId: source.customerId,
      projectId: source.projectId,
      // quoteId is uniek per Calculation — een kopie mag niet aan dezelfde offerte hangen
      quoteId: null,
      number,
      title: source.title,
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
              sortOrder: item.sortOrder,
            })),
          }
        : undefined,
    },
    include: { customer: true, project: true, items: true },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
