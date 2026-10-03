import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });

  const [customers, products, productSets] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" }, take: 500 }),
    prisma.product.findMany({ where: { companyId, active: true }, orderBy: [{ category: "asc" }, { name: "asc" }], take: 500 }),
    prisma.productSet.findMany({
      where: { companyId, active: true },
      include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  return NextResponse.json({ customers, products, productSets });
}
