import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditQuotePrices } from "@/lib/quote-price-audit";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: {
      number: true,
      validUntil: true,
      items: {
        select: {
          description: true, qty: true, costPrice: true, unitPrice: true,
          product: { select: { active: true, costPrice: true, priceUpdatedAt: true } },
        },
      },
      calculations: {
        where: { archivedAt: null },
        select: {
          id: true, number: true,
          items: {
            select: {
              type: true, description: true, qty: true, costPrice: true,
              unitPrice: true, markupPercent: true,
              product: { select: { active: true, costPrice: true, priceUpdatedAt: true } },
            },
          },
        },
      },
    },
  });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });

  const lines = auditQuotePrices({
    calculations: quote.calculations.map((calculation) => ({
      id: calculation.id,
      number: calculation.number,
      items: calculation.items.map((item) => ({
        ...item,
        qty: Number(item.qty),
        costPrice: Number(item.costPrice),
        unitPrice: Number(item.unitPrice),
        markupPercent: Number(item.markupPercent),
        product: item.product ? { ...item.product, costPrice: item.product.costPrice === null ? null : Number(item.product.costPrice) } : null,
      })),
    })),
    items: quote.items.map((item) => ({
      ...item,
      qty: Number(item.qty),
      costPrice: item.costPrice === null ? null : Number(item.costPrice),
      unitPrice: Number(item.unitPrice),
      product: item.product ? { ...item.product, costPrice: item.product.costPrice === null ? null : Number(item.product.costPrice) } : null,
    })),
  });

  return NextResponse.json({
    quoteNumber: quote.number,
    validUntil: quote.validUntil,
    checkedAt: new Date().toISOString(),
    lines,
  });
}
