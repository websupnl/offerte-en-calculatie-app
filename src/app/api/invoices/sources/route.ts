import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Offertes, calculaties en werkbonnen waar een factuur van gemaakt kan worden. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = session.user.activeCompanyId;
  const customerId = req.nextUrl.searchParams.get("customerId") || undefined;

  const [quotes, calculations, workOrders, invoiced] = await Promise.all([
    prisma.quote.findMany({
      where: { companyId, customerId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, number: true, title: true, status: true, totalIncVat: true, customerId: true, customer: { select: { name: true } } },
    }),
    prisma.calculation.findMany({
      where: { companyId, customerId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, number: true, title: true, status: true, totalSalesPrice: true, customerId: true, customer: { select: { name: true } } },
    }),
    prisma.workOrder.findMany({
      where: { companyId, project: customerId ? { customerId } : undefined },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, number: true, title: true, status: true, project: { select: { customerId: true, customer: { select: { name: true } } } } },
    }),
    prisma.salesInvoice.findMany({
      where: { companyId, OR: [{ quoteId: { not: null } }, { workOrderId: { not: null } }] },
      select: { quoteId: true, workOrderId: true, number: true },
    }),
  ]);

  const invoicedQuote = new Map(invoiced.filter((i) => i.quoteId).map((i) => [i.quoteId!, i.number]));
  const invoicedWo = new Map(invoiced.filter((i) => i.workOrderId).map((i) => [i.workOrderId!, i.number]));

  return NextResponse.json({
    // Geaccepteerde offertes eerst: dat zijn degene die je factureert.
    quotes: [...quotes].sort((a, b) => Number(b.status === "ACCEPTED") - Number(a.status === "ACCEPTED")).map((q) => ({
      id: q.id, number: q.number, title: q.title, status: q.status, amount: Number(q.totalIncVat),
      customerId: q.customerId, customerName: q.customer.name, invoicedAs: invoicedQuote.get(q.id) ?? null,
    })),
    calculations: calculations.map((c) => ({
      id: c.id, number: c.number, title: c.title, status: c.status, amount: Number(c.totalSalesPrice),
      customerId: c.customerId, customerName: c.customer?.name ?? null, invoicedAs: null,
    })),
    workOrders: workOrders.map((w) => ({
      id: w.id, number: w.number, title: w.title, status: w.status, amount: null,
      customerId: w.project.customerId, customerName: w.project.customer.name, invoicedAs: invoicedWo.get(w.id) ?? null,
    })),
  });
}
