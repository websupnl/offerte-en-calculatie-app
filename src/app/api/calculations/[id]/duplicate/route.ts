import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextCalculationNumber } from "@/lib/calculation-number";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";

class ForkError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const companyId = session.user.activeCompanyId;
  const body = await req.json().catch(() => ({}));
  const asAlternative = body?.asAlternative === true;
  const asVariant = body?.asVariant === true;
  const company = await prisma.company.findUnique({ where: { id: companyId } });

  try {
    const duplicate = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
      const number = await nextCalculationNumber(companyId, company?.slug ?? "xx", tx);
      // Serialize forks of this calculation so a concurrent fork cannot create
      // multiple concept quotes for the same source.
      await tx.$queryRaw`SELECT id FROM "Calculation" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
      const source = await tx.calculation.findFirst({
        where: { id, companyId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      if (!source) throw new ForkError("Calculatie niet gevonden", 404);
      let quoteId = source.quoteId;
      const linkedCopy = asAlternative || (asVariant && Boolean(quoteId));
      if (linkedCopy && quoteId) {
        await tx.$queryRaw`SELECT id FROM "Quote" WHERE id = ${quoteId} AND "companyId" = ${companyId} FOR UPDATE`;
        const quote = await tx.quote.findFirst({
          where: { id: quoteId, companyId },
          select: { status: true, items: { select: { id: true }, take: 1 } },
        });
        if (!quote || quote.status !== "DRAFT") throw new ForkError("Alternatieven kunnen alleen aan een conceptofferte worden toegevoegd. Maak een losse kopie voor een nieuwe offerte.", 409);
        if (asAlternative && quote.items.length) throw new ForkError("Zet de losse offerteregels eerst om naar calculaties voordat je alternatieven toevoegt.", 409);
      }
      if (asAlternative && !quoteId) {
        if (!source.customerId) throw new ForkError("Koppel eerst een klant aan deze calculatie", 400);
        const quote = await tx.quote.create({ data: {
          companyId, customerId: source.customerId, createdById: session.user.id,
          title: source.title, notes: source.notes, vatRate: source.vatRate, projectId: source.projectId,
        } });
        quoteId = quote.id;
      }
      // Two full executions are alternatives. Turning only the copy into a
      // variant would add the original BASE price to every customer choice.
      if (asAlternative) await tx.calculation.update({
        where: { id: source.id }, data: { quoteId, role: "VARIANT", status: "QUOTED" },
      });
      const highestOrder = linkedCopy ? await tx.calculation.aggregate({
        where: { quoteId, companyId }, _max: { sortOrder: true },
      }) : null;
      return tx.calculation.create({
        data: {
          companyId, customerId: source.customerId, projectId: source.projectId,
          quoteId: linkedCopy ? quoteId : null,
          role: linkedCopy ? "VARIANT" : "BASE",
          sortOrder: linkedCopy ? (highestOrder?._max.sortOrder ?? 0) + 1 : 0,
          number, title: linkedCopy ? `${source.title} (alternatief)` : `${source.title} (kopie)`,
          description: source.description, status: "DRAFT", vatRate: source.vatRate,
          totalCostPrice: source.totalCostPrice, totalSalesPrice: source.totalSalesPrice,
          marginAmount: source.marginAmount, marginPercent: source.marginPercent, notes: source.notes,
          items: source.items.length ? { create: source.items.map(item => ({
            productId: item.productId, type: item.type, supplier: item.supplier, sku: item.sku,
            description: item.description, qty: item.qty, unit: item.unit, costPrice: item.costPrice,
            markupPercent: item.markupPercent, unitPrice: item.unitPrice,
            totalCostPrice: item.totalCostPrice, totalSalesPrice: item.totalSalesPrice,
            vatRate: item.vatRate, optional: item.optional, hiddenOnQuote: item.hiddenOnQuote,
            recurringInterval: item.recurringInterval, lineType: item.lineType, billingCycle: item.billingCycle,
            quoteNote: item.quoteNote, sortOrder: item.sortOrder,
          })) } : undefined,
        },
        include: { customer: true, project: true, items: true },
      });
    });
    await syncQuoteTotalsFromCalculations(duplicate.quoteId);
    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    if (error instanceof ForkError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Calculation fork failed", error);
    return NextResponse.json({ error: "Calculatie kopiëren mislukt" }, { status: 500 });
  }
}
