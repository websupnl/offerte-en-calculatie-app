import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const calculationItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional().nullable(),
  type: z.enum(["MATERIAL", "LABOR", "CUSTOM", "SET"]).default("MATERIAL"),
  supplier: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  description: z.string().min(1, "Omschrijving is verplicht"),
  qty: z.coerce.number().min(0.01),
  unit: z.string().optional().default("stuk"),
  costPrice: z.coerce.number().min(0),
  markupPercent: z.coerce.number().default(0),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().default(21),
  optional: z.boolean().default(false),
});

const schema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  description: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "COMPLETED", "QUOTED"]).optional(),
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  vatRate: z.coerce.number().default(21),
  notes: z.string().optional().nullable(),
  items: z.array(calculationItemSchema).default([]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const calculation = await prisma.calculation.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      project: true,
      quote: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: true },
      },
    },
  });

  if (!calculation) {
    return NextResponse.json({ error: "Calculatie niet gevonden" }, { status: 404 });
  }

  return NextResponse.json(calculation);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;
  const body = await req.json();

  const existing = await prisma.calculation.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Calculatie niet gevonden" }, { status: 404 });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, status, customerId, projectId, vatRate, notes, items } = parsed.data;

  // Calculate totals
  let totalCostPrice = 0;
  let totalSalesPrice = 0;

  const itemsToCreate = items.map((item, index) => {
    const itemCost = item.qty * item.costPrice;
    const calculatedUnitPrice = item.unitPrice > 0 
      ? item.unitPrice 
      : Math.round(item.costPrice * (1 + item.markupPercent / 100) * 100) / 100;
    const itemSales = item.qty * calculatedUnitPrice;

    if (!item.optional) {
      totalCostPrice += itemCost;
      totalSalesPrice += itemSales;
    }

    return {
      productId: item.productId || null,
      type: item.type,
      supplier: item.supplier || null,
      sku: item.sku || null,
      description: item.description,
      qty: item.qty,
      unit: item.unit || "stuk",
      costPrice: item.costPrice,
      markupPercent: item.markupPercent,
      unitPrice: calculatedUnitPrice,
      totalCostPrice: itemCost,
      totalSalesPrice: itemSales,
      vatRate: item.vatRate,
      optional: item.optional,
      sortOrder: index,
    };
  });

  const marginAmount = totalSalesPrice - totalCostPrice;
  const marginPercent = totalSalesPrice > 0 ? (marginAmount / totalSalesPrice) * 100 : 0;

  // Transaction: delete old items, create new items, update calculation
  const updated = await prisma.$transaction(async (tx) => {
    await tx.calculationItem.deleteMany({ where: { calculationId: id } });

    return tx.calculation.update({
      where: { id },
      data: {
        title,
        description,
        status: status ?? existing.status,
        customerId: customerId || null,
        projectId: projectId || null,
        vatRate,
        totalCostPrice,
        totalSalesPrice,
        marginAmount,
        marginPercent,
        notes,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        customer: true,
        project: true,
        quote: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const existing = await prisma.calculation.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Calculatie niet gevonden" }, { status: 404 });

  await prisma.calculation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
