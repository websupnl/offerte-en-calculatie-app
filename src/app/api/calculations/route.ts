import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateCalculationNumber } from "@/lib/format";

const calculationItemSchema = z.object({
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
});

const schema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  description: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  vatRate: z.coerce.number().default(21),
  notes: z.string().optional().nullable(),
  items: z.array(calculationItemSchema).default([]),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const calculations = await prisma.calculation.findMany({
    where: { companyId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, number: true, title: true } },
      quote: { select: { id: true, number: true, status: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: { select: { id: true, name: true, supplier: true, sku: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(calculations);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, customerId, projectId, vatRate, notes, items } = parsed.data;

  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) return NextResponse.json({ error: "Klant bestaat niet binnen dit bedrijf" }, { status: 400 });
  }

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: "Project bestaat niet binnen dit bedrijf" }, { status: 400 });
  }

  const count = await prisma.calculation.count({ where: { companyId } });
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const number = generateCalculationNumber(company?.slug ?? "xx", count + 1);

  // Recalculate totals
  let totalCostPrice = 0;
  let totalSalesPrice = 0;

  const itemsToCreate = items.map((item, index) => {
    const itemCost = item.qty * item.costPrice;
    // Calculate unitPrice if markupPercent is specified or fallback to unitPrice
    const calculatedUnitPrice = item.unitPrice > 0 
      ? item.unitPrice 
      : Math.round(item.costPrice * (1 + item.markupPercent / 100) * 100) / 100;
    const itemSales = item.qty * calculatedUnitPrice;

    totalCostPrice += itemCost;
    totalSalesPrice += itemSales;

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
      sortOrder: index,
    };
  });

  const marginAmount = totalSalesPrice - totalCostPrice;
  const marginPercent = totalSalesPrice > 0 ? (marginAmount / totalSalesPrice) * 100 : 0;

  const calculation = await prisma.calculation.create({
    data: {
      companyId,
      number,
      title,
      description,
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
      items: true,
    },
  });

  return NextResponse.json(calculation, { status: 201 });
}
